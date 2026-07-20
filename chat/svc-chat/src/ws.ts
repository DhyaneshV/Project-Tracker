import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } from '@aws-sdk/client-apigatewaymanagementapi';
import { verifyToken } from '@project-tracker/auth-library';
import * as db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function getApigwClient(endpoint: string) {
  return new ApiGatewayManagementApiClient({ endpoint });
}

// $connect — query params: ?token=<jwt>&projectId=<id>
export const connect: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const token = (event as any).queryStringParameters?.token;
  const projectId = (event as any).queryStringParameters?.projectId;

  if (!token || !projectId) return { statusCode: 401, body: 'Missing token or projectId' };

  const user = verifyToken(token, JWT_SECRET!);
  if (!user) return { statusCode: 401, body: 'Invalid token' };

  await db.saveConnection(event.requestContext.connectionId!, user.id, projectId);
  return { statusCode: 200, body: 'Connected' };
};

// $disconnect
export const disconnect: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  await db.deleteConnection(event.requestContext.connectionId!);
  return { statusCode: 200, body: 'Disconnected' };
};

// sendMessage action — payload: { channelId, content, parentMessageId?, attachments? }
export const message: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId!;
  const endpoint = process.env.WEBSOCKET_ENDPOINT!;

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { channelId, content, parentMessageId, attachments, senderName, projectId } = body;
  if (!channelId || !content || !projectId) return { statusCode: 400, body: 'Missing fields' };

  // Resolve sender from connection record by scanning — we stored userId at connect time
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
  const { Items } = await ddb.send(new ScanCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    FilterExpression: 'connectionId = :c',
    ExpressionAttributeValues: { ':c': connectionId },
    Limit: 1,
  }));
  const conn = Items?.[0];
  if (!conn) return { statusCode: 403, body: 'Unknown connection' };

  const msg = db.buildMessage(channelId, projectId, conn.userId, senderName || 'Unknown', content, {
    parentMessageId,
    attachments,
  });

  await db.saveMessage(msg);

  // Broadcast to all connections in this project
  const connections = await db.getConnectionsByProject(projectId);
  const apigw = getApigwClient(endpoint);

  await Promise.allSettled(
    connections.map(async (c) => {
      try {
        await apigw.send(new PostToConnectionCommand({
          ConnectionId: c.connectionId,
          Data: Buffer.from(JSON.stringify({ type: 'NEW_MESSAGE', message: msg })),
        }));
      } catch (err) {
        if (err instanceof GoneException) {
          await db.deleteConnection(c.connectionId);
        }
      }
    })
  );

  return { statusCode: 200, body: 'Message sent' };
};
