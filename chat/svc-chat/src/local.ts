// Local dev server using Express + ws for testing without AWS
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';
import * as db from './db.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 4003;
const LOCAL_STORE_PATH = process.env.CHAT_LOCAL_STORE_PATH || '/tmp/project-tracker-chat-store.json';

// Local development should remain fully usable even when AWS DynamoDB is not
// available. These stores are deliberately process-local and are only used as
// a fallback after a database operation fails.
interface LocalChatStore {
  channels: Record<string, db.ChatChannel[]>;
  messages: Record<string, db.ChatMessage[]>;
}

function readLocalStore(): LocalChatStore {
  try {
    if (existsSync(LOCAL_STORE_PATH)) return JSON.parse(readFileSync(LOCAL_STORE_PATH, 'utf8')) as LocalChatStore;
  } catch (error) {
    console.warn('[Chat] could not read local chat store; starting fresh.', error);
  }
  return { channels: {}, messages: {} };
}

const persistedStore = readLocalStore();
const localChannels = new Map(Object.entries(persistedStore.channels || {}));
const localMessages = new Map(Object.entries(persistedStore.messages || {}));

function persistLocalStore() {
  const channels = Object.fromEntries(localChannels);
  const messages = Object.fromEntries(localMessages);
  writeFileSync(LOCAL_STORE_PATH, JSON.stringify({ channels, messages }), { mode: 0o600 });
}

function defaultChannel(projectId: string): db.ChatChannel {
  return {
    projectId,
    channelId: `${projectId}#general`,
    name: 'general',
    description: 'General project discussion',
    createdBy: 'local',
    createdAt: new Date().toISOString(),
    isDefault: true,
  };
}

function getLocalChannels(projectId: string) {
  if (!localChannels.has(projectId)) {
    localChannels.set(projectId, [defaultChannel(projectId)]);
    persistLocalStore();
  }
  return localChannels.get(projectId)!;
}

function saveLocalMessage(message: db.ChatMessage) {
  const messages = localMessages.get(message.channelId) || [];
  messages.push(message);
  localMessages.set(message.channelId, messages);
  persistLocalStore();
}

app.get('/chat/:projectId/channels', async (req, res) => {
  res.json(getLocalChannels(req.params.projectId));
});

app.post('/chat/:projectId/channels', async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  if (!name) return res.status(400).json({ error: 'Channel name must include letters or numbers' });
  const channels = getLocalChannels(req.params.projectId);
  if (channels.some(channel => channel.name === name)) return res.status(409).json({ error: 'A channel with that name already exists' });
  const channel: db.ChatChannel = { projectId: req.params.projectId, channelId: `${req.params.projectId}#${name}`, name, description: req.body.description, createdBy: 'local', createdAt: new Date().toISOString(), isDefault: false };
  channels.push(channel);
  persistLocalStore();
  res.status(201).json(channel);
});

app.get('/chat/:projectId/channels/:channelId/messages', async (req, res) => {
  res.json(localMessages.get(req.params.channelId) || []);
});

app.post('/chat/upload-url', async (req, res) => {
  res.json({ uploadUrl: 'local-dev-no-s3', fileKey: 'local', publicUrl: 'local' });
});

// POST /events/broadcast — Internal endpoint for services to broadcast real-time events
// Called by other microservices when mutations happen (task updated, notification created, etc.)
app.post('/events/broadcast', (req, res) => {
  const event = req.body;
  if (!event || !event.type) {
    return res.status(400).json({ error: 'Event must have a type field' });
  }
  const payload = JSON.stringify(event);
  let sent = 0;
  eventSubscribers.forEach(ws => {
    if (ws.readyState === 1) { ws.send(payload); sent++; }
  });
  res.json({ sent, subscribers: eventSubscribers.size });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// projectId → Set of ws clients
const rooms = new Map<string, Set<any>>();

// Global event subscribers (for real-time dashboard updates)
const eventSubscribers = new Set<any>();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `ws://localhost:${PORT}`);
  const path = url.pathname;

  // Extract auth token from subprotocol (format: "auth-<token>")
  // This avoids exposing the token in URL/logs
  const protocols = req.headers['sec-websocket-protocol']?.split(',').map(s => s.trim()) || [];
  const authProtocol = protocols.find(p => p.startsWith('auth-'));
  const _token = authProtocol ? authProtocol.slice(5) : null;
  // TODO: Verify token with JWT library in production
  // For now, accept any non-empty token (backend services verify on their own)

  // /events endpoint — global real-time events for dashboard
  if (path === '/events') {
    eventSubscribers.add(ws);
    ws.on('close', () => eventSubscribers.delete(ws));
    ws.on('error', () => eventSubscribers.delete(ws));
    return;
  }

  // Default: project chat room
  const projectId = url.searchParams.get('projectId') || 'default';

  if (!rooms.has(projectId)) rooms.set(projectId, new Set());
  rooms.get(projectId)!.add(ws);

  ws.on('message', async (raw) => {
    const data = JSON.parse(raw.toString());
    if (data.action === 'sendMessage') {
      const msg = db.buildMessage(data.channelId, data.projectId, data.senderId, data.senderName, data.content, {
        parentMessageId: data.parentMessageId,
        attachments: data.attachments,
      });
      saveLocalMessage(msg);
      const payload = JSON.stringify({ type: 'NEW_MESSAGE', message: msg });
      rooms.get(projectId)?.forEach(client => {
        if (client.readyState === 1) client.send(payload);
      });
    }
  });

  ws.on('close', () => {
    rooms.get(projectId)?.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Chat service (local) at http://localhost:${PORT} and ws://localhost:${PORT}`);
});
