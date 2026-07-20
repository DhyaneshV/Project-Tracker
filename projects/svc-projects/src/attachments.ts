import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '@project-tracker/auth-library';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.TASK_ATTACHMENTS_BUCKET!;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function safeFileName(fileName: unknown): string | null {
  if (typeof fileName !== 'string') return null;
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return normalized && normalized.length <= 120 ? normalized : null;
}

function canAccessProject(user: any, project: any): boolean {
  if (['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER'].includes(user.category)) return true;
  if (user.category === 'MANAGER') {
    const reports = user.managedTeamIds || user.managedEmployees || [];
    return project.managedByIds?.includes(user.id) || project.teamMembers.some((member: any) => reports.includes(member.userId));
  }
  if (user.category === 'TEAM_LEAD') return (user.assignedProjectIds || []).includes(project.id);
  return project.teamMembers.some((member: any) => member.userId === user.id);
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

/**
 * POST /tasks/{taskId}/upload-url
 * Body: { fileName, mimeType, fileSize }
 *
 * Flow:
 * 1. Client calls this → gets presigned PUT URL + fileKey
 * 2. Client uploads file directly to S3
 * 3. Client calls addTaskAttachment mutation (GraphQL) with fileKey to confirm
 */
export const getTaskUploadUrl: APIGatewayProxyHandlerV2 = async (event) => {
  const auth = (event.headers?.authorization || event.headers?.Authorization || '').replace('Bearer ', '');
  const user = verifyToken(auth, JWT_SECRET!);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { taskId } = event.pathParameters as any;
  const task = await db.getTaskById(taskId);
  if (!task) return json(404, { error: 'Task not found' });

  const project = await db.getProjectById(task.projectId);
  if (!project || !canAccessProject(user, project)) return json(403, { error: 'Access denied' });

  const { fileName, mimeType, fileSize } = JSON.parse(event.body || '{}');
  const normalizedFileName = safeFileName(fileName);
  if (!normalizedFileName || !ALLOWED_MIME_TYPES.has(mimeType) || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    return json(400, { error: 'Invalid file name, type, or size' });
  }

  const fileKey = `tasks/${task.projectId}/${taskId}/${uuidv4()}/${normalizedFileName}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, ContentType: mimeType, ContentLength: fileSize }),
    { expiresIn: 300 }
  );

  return json(200, {
    uploadUrl,
    fileKey,
    taskId,
    fileName: normalizedFileName,
    mimeType,
    fileSize: fileSize || 0,
  });
};
