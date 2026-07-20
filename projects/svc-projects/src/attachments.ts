import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '@project-tracker/auth-library';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.TASK_ATTACHMENTS_BUCKET!;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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

  const { fileName, mimeType, fileSize } = JSON.parse(event.body || '{}');
  if (!fileName || !mimeType) return json(400, { error: 'fileName and mimeType required' });

  const fileKey = `tasks/${task.projectId}/${taskId}/${uuidv4()}/${fileName}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, ContentType: mimeType }),
    { expiresIn: 300 }
  );

  return json(200, {
    uploadUrl,
    fileKey,
    publicUrl: `https://${BUCKET}.s3.amazonaws.com/${fileKey}`,
    taskId,
    fileName,
    mimeType,
    fileSize: fileSize || 0,
  });
};
