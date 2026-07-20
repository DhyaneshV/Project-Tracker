import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '@project-tracker/auth-library';
import * as db from './db.js';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.ATTACHMENTS_BUCKET!;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function getUser(event: any) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.replace('Bearer ', '');
  return verifyToken(token, JWT_SECRET!);
}

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

// GET /chat/{projectId}/channels
export const getChannels: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId } = event.pathParameters as any;
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
  const { name, description } = JSON.parse(event.body || '{}');
  if (!name) return json(400, { error: 'Channel name required' });

  const channel: db.ChatChannel = {
    projectId,
    channelId: `${projectId}#${name.toLowerCase().replace(/\s+/g, '-')}`,
    name: name.toLowerCase().replace(/\s+/g, '-'),
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

  const { channelId } = event.pathParameters as any;
  const before = event.queryStringParameters?.before;
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const messages = await db.getMessages(channelId, limit, before);
  return json(200, messages);
};

// POST /chat/upload-url  body: { fileName, mimeType, projectId }
// Returns S3 presigned PUT URL — client uploads directly, then includes fileKey in message
export const getUploadUrl: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { fileName, mimeType, projectId } = JSON.parse(event.body || '{}');
  if (!fileName || !mimeType || !projectId) return json(400, { error: 'fileName, mimeType and projectId required' });

  const fileKey = `chat/${projectId}/${uuidv4()}/${fileName}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, ContentType: mimeType }),
    { expiresIn: 300 } // 5 min
  );

  return json(200, { uploadUrl: url, fileKey, publicUrl: `https://${BUCKET}.s3.amazonaws.com/${fileKey}` });
};
