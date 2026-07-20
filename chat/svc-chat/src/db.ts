import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const ddb = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'ChatConnections';
const CHANNELS_TABLE   = process.env.CHANNELS_TABLE   || 'ChatChannels';
const MESSAGES_TABLE   = process.env.MESSAGES_TABLE   || 'ChatMessages';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatAttachment {
  fileKey: string;   // S3 key
  fileName: string;
  fileSize: number;
  mimeType: string;
  url?: string;      // populated when serving
}

export interface ChatMessage {
  channelId: string;
  messageId: string;
  createdAt: string;   // ISO — also the SK
  content: string;
  senderId: string;
  senderName: string;
  projectId: string;
  mentions: string[];  // userIds mentioned via @
  attachments: ChatAttachment[];
  parentMessageId?: string;  // set if this is a thread reply
  edited?: boolean;
}

export interface ChatChannel {
  projectId: string;
  channelId: string;
  name: string;        // e.g. "general", "backend"
  description?: string;
  createdBy: string;
  createdAt: string;
  isDefault: boolean;
}

// ─── Connections ──────────────────────────────────────────────────────────────

export async function saveConnection(connectionId: string, userId: string, projectId: string) {
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24h
  await ddb.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: { connectionId, userId, projectId, ttl, connectedAt: new Date().toISOString() },
  }));
}

export async function deleteConnection(connectionId: string) {
  await ddb.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
}

export async function getConnectionsByProject(projectId: string): Promise<{ connectionId: string; userId: string }[]> {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const result = await ddb.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'projectId = :p',
    ExpressionAttributeValues: { ':p': projectId },
  }));
  return (result.Items || []) as any[];
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export async function createChannel(channel: ChatChannel): Promise<ChatChannel> {
  await ddb.send(new PutCommand({ TableName: CHANNELS_TABLE, Item: channel }));
  return channel;
}

export async function getChannels(projectId: string): Promise<ChatChannel[]> {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: CHANNELS_TABLE,
    KeyConditionExpression: 'projectId = :p',
    ExpressionAttributeValues: { ':p': projectId },
  }));
  return (Items || []) as ChatChannel[];
}

export async function ensureDefaultChannel(projectId: string, createdBy: string): Promise<ChatChannel> {
  const existing = await getChannels(projectId);
  const general = existing.find(c => c.name === 'general');
  if (general) return general;

  return createChannel({
    projectId,
    channelId: `${projectId}#general`,
    name: 'general',
    description: 'General project discussion',
    createdBy,
    createdAt: new Date().toISOString(),
    isDefault: true,
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(msg: ChatMessage): Promise<ChatMessage> {
  await ddb.send(new PutCommand({ TableName: MESSAGES_TABLE, Item: msg }));
  return msg;
}

export async function getMessages(channelId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
  const params: any = {
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: before
      ? 'channelId = :c AND createdAt < :b'
      : 'channelId = :c',
    ExpressionAttributeValues: { ':c': channelId, ...(before ? { ':b': before } : {}) },
    ScanIndexForward: false, // newest first
    Limit: limit,
  };
  const { Items } = await ddb.send(new QueryCommand(params));
  return ((Items || []) as ChatMessage[]).reverse(); // return oldest-first for display
}

export function buildMessage(
  channelId: string,
  projectId: string,
  senderId: string,
  senderName: string,
  content: string,
  options: { parentMessageId?: string; attachments?: ChatAttachment[] } = {}
): ChatMessage {
  const now = new Date().toISOString();
  return {
    channelId,
    messageId: uuidv4(),
    createdAt: now,
    content,
    senderId,
    senderName,
    projectId,
    mentions: parseMentions(content),
    attachments: options.attachments || [],
    ...(options.parentMessageId ? { parentMessageId: options.parentMessageId } : {}),
  };
}

function parseMentions(content: string): string[] {
  // Extract @userId patterns — frontend sends @[name:userId] format
  const regex = /@\[([^\]:]+):([^\]]+)\]/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[2]); // userId
  }
  return mentions;
}
