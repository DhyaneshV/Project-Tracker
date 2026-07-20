import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '@project-tracker/auth-library';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.PROJECT_DOCS_BUCKET!;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// Restricted types: only MANAGER+ can upload/view
const RESTRICTED_TYPES: db.DocumentType[] = ['API_KEYS', 'CREDENTIALS'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isManagerOrAbove(category: string) {
  return ['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER'].includes(category);
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

function getUser(event: any) {
  const auth = (event.headers?.authorization || event.headers?.Authorization || '').replace('Bearer ', '');
  return verifyToken(auth, JWT_SECRET!);
}

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

async function requireProjectAccess(user: any, projectId: string) {
  const project = await db.getProjectById(projectId);
  if (!project) throw new Error('Project not found');
  if (!canAccessProject(user, project)) throw new Error('Access denied');
  return project;
}

/**
 * POST /projects/{projectId}/docs/upload-url
 * Body: { fileName, mimeType, fileSize, title, type, tags?, description?, version? }
 * Step 1 of 2 — returns presigned URL. Client uploads, then calls confirmProjectDoc.
 */
export const getProjectDocUploadUrl: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId } = event.pathParameters as any;
  const { fileName, mimeType, fileSize, title, type, tags, description, version } = JSON.parse(event.body || '{}');
  const normalizedFileName = safeFileName(fileName);
  if (!normalizedFileName || !ALLOWED_MIME_TYPES.has(mimeType) || !title || !type || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    return json(400, { error: 'Invalid document metadata' });
  }
  try {
    await requireProjectAccess(user, projectId);
  } catch (error: any) {
    return json(error.message === 'Project not found' ? 404 : 403, { error: error.message });
  }

  // Restricted docs: only MANAGER+
  if (RESTRICTED_TYPES.includes(type) && !isManagerOrAbove(user.category)) {
    return json(403, { error: `Only managers can upload ${type} documents` });
  }

  const docId = uuidv4();
  const fileKey = `projects/${projectId}/docs/${type}/${docId}/${normalizedFileName}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, ContentType: mimeType, ContentLength: fileSize }),
    { expiresIn: 300 }
  );

  return json(200, {
    uploadUrl,
    fileKey,
    docId,
    // Client sends these back in confirmProjectDoc
    meta: { projectId, docId, title, description, type, tags: tags || [], fileName: normalizedFileName, mimeType, fileSize, version: version || 1 },
  });
};

/**
 * POST /projects/{projectId}/docs/confirm
 * Body: { docId, fileKey, title, description?, type, tags?, fileName, mimeType, fileSize, version? }
 * Step 2 of 2 — after client successfully uploaded to S3, confirm and persist metadata.
 */
export const confirmProjectDoc: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId } = event.pathParameters as any;
  const { docId, fileKey, title, description, type, tags, fileName, mimeType, fileSize, version } = JSON.parse(event.body || '{}');
  const normalizedFileName = safeFileName(fileName);
  if (!docId || !fileKey || !title || !type || !normalizedFileName || !ALLOWED_MIME_TYPES.has(mimeType) || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    return json(400, { error: 'Invalid document metadata' });
  }
  if (!/^[0-9a-f-]{36}$/i.test(docId) || fileKey !== `projects/${projectId}/docs/${type}/${docId}/${normalizedFileName}`) {
    return json(400, { error: 'Invalid document upload reference' });
  }
  try {
    await requireProjectAccess(user, projectId);
  } catch (error: any) {
    return json(error.message === 'Project not found' ? 404 : 403, { error: error.message });
  }

  if (RESTRICTED_TYPES.includes(type) && !isManagerOrAbove(user.category)) {
    return json(403, { error: 'Access denied' });
  }

  const now = new Date().toISOString();
  const doc: db.ProjectDocument = {
    projectId,
    docId,
    createdAt: now,
    title,
    description,
    type,
    tags: tags || [],
    fileKey,
    fileName: normalizedFileName,
    mimeType,
    fileSize: fileSize || 0,
    version: version || 1,
    uploadedBy: user.id,
    updatedAt: now,
    restricted: RESTRICTED_TYPES.includes(type),
  };

  await db.createProjectDocument(doc);
  return json(201, doc);
};

/**
 * GET /projects/{projectId}/docs?type=SRS
 */
export const listProjectDocs: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId } = event.pathParameters as any;
  const typeFilter = event.queryStringParameters?.type as db.DocumentType | undefined;

  try {
    await requireProjectAccess(user, projectId);
  } catch (error: any) {
    return json(error.message === 'Project not found' ? 404 : 403, { error: error.message });
  }
  let docs = await db.listProjectDocuments(projectId, typeFilter);

  // Filter restricted docs for non-managers
  if (!isManagerOrAbove(user.category)) {
    docs = docs.filter(d => !d.restricted);
  }

  return json(200, docs);
};

/**
 * DELETE /projects/{projectId}/docs/{docId}
 */
export const deleteProjectDoc: APIGatewayProxyHandlerV2 = async (event) => {
  const user = getUser(event);
  if (!user) return json(401, { error: 'Unauthorized' });

  const { projectId, docId } = event.pathParameters as any;
  try {
    await requireProjectAccess(user, projectId);
  } catch (error: any) {
    return json(error.message === 'Project not found' ? 404 : 403, { error: error.message });
  }
  const doc = await db.getProjectDocument(projectId, docId);
  if (!doc) return json(404, { error: 'Document not found' });

  // Only uploader or MANAGER+ can delete
  if (doc.uploadedBy !== user.id && !isManagerOrAbove(user.category)) {
    return json(403, { error: 'Access denied' });
  }

  // Delete from S3
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.fileKey }));
  await db.deleteProjectDocument(projectId, docId);

  return json(200, { success: true });
};
