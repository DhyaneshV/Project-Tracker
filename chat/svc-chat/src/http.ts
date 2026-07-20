import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '@project-tracker/auth-library';
import * as db from './db.js';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.ATTACHMENTS_BUCKET!;
const JWT_SECRET = process.env.JWT_SECRET;
const PROJECTS_SERVICE_URL = process.env.PROJECTS_SERVICE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain']);

function getUser(event: any) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.replace('Bearer ', '');
  return verifyToken(token, JWT_SECRET!);
}

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...(FRONTEND_URL ? { 'Access-Control-Allow-Origin': FRONTEND_URL, 'Vary': 'Origin' } : {}),
      'X-Content-Type-Options': 'nosniff',
    },
    body: JSON.stringify(body),
  };
}

function safeFileName(fileName: unknown): string | null {
  if (typeof fileName !== 'string') return null;
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return normalized && normalized.length <= 120 ? normalized : null;
}

async function canAccessProject(event: any, projectId: string): Promise<boolean> {
  if (!PROJECTS_SERVICE_URL || !/^[a-zA-Z0-9_-]{1,128}$/.test(projectId)) return false;
  const authorization = event.headers?.authorization || event.headers?.Authorization;
  try {
    const response = await fetch(PROJECTS_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({
        query: 'query ChatProjectAccess($id: ID!) { getProject(id: $id) { id } }',
        variables: { id: projectId },
      }),
    });
    const result = await response.json() as { data?: { getProject?: { id?: string } } };
    return response.ok && result.data?.getProject?.id === projectId;
  } catch {
    return false; // fail closed if the authorisation service is unavailable
  }
}

// GET /chat/{projectId}/channels
export const getChannels: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId } = event.pathParameters as any;
  if (!(await canAccessProject(event, projectId))) return json(403, { error: 'Access denied' });
  const channels = await db.getChannels(projectId);

  // Auto-create general if none exist
  if (channels.length === 0) {
    const general = await db.ensureDefaultChannel(projectId, user.id);
    return json(200, [general]);
  }

  return json(200, channels);
};

// POST /chat/{projectId}/channels  body: { name, description? }
export const createChannel: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  // Only MANAGER+ can create channels
  if (!['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER', 'TEAM_LEAD'].includes(user.category)) {
    return json(403, { error: 'Only managers and team leads can create channels' });
  }

  const { projectId } = event.pathParameters as any;
  if (!(await canAccessProject(event, projectId))) return json(403, { error: 'Access denied' });
  let body: any;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const name = typeof body.name === 'string' ? body.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '') : '';
  const description = typeof body.description === 'string' ? body.description.slice(0, 500) : undefined;
  if (!name || name.length > 80) return json(400, { error: 'Invalid channel name' });

  const channel: db.ChatChannel = {
    projectId,
    channelId: `${projectId}#${name}`,
    name,
    description,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    isDefault: false,
  };

  await db.createChannel(channel);
  return json(201, channel);
};

// GET /chat/{projectId}/channels/{channelId}/messages?before=<iso>&limit=50
export const getMessages: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId, channelId } = event.pathParameters as any;
  if (!(await canAccessProject(event, projectId)) || !channelId?.startsWith(`${projectId}#`)) return json(403, { error: 'Access denied' });
  const before = event.queryStringParameters?.before;
  const requestedLimit = Number.parseInt(event.queryStringParameters?.limit || '50', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;

  const messages = await db.getMessages(channelId, limit, before);
  return json(200, messages);
};

// POST /chat/upload-url  body: { fileName, mimeType, projectId }
// Returns S3 presigned PUT URL — client uploads directly, then includes fileKey in message
export const getUploadUrl: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  let body: any;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const { mimeType, projectId, fileSize } = body;
  const fileName = safeFileName(body.fileName);
  if (!fileName || !mimeType || !projectId || !ALLOWED_MIME_TYPES.has(mimeType) || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) return json(400, { error: 'Invalid file metadata' });
  if (!(await canAccessProject(event, projectId))) return json(403, { error: 'Access denied' });

  const fileKey = `chat/${projectId}/${uuidv4()}/${fileName}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, ContentType: mimeType, ContentLength: fileSize }),
    { expiresIn: 300 } // 5 min
  );

  return json(200, { uploadUrl: url, fileKey });
};
