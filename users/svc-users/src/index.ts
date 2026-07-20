import { ApolloServer, BaseContext } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
import { startStandaloneServer } from '@apollo/server/standalone';
import { resolvers } from './resolvers/index.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ddbDocClient, TABLE_NAME } from './db.js';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { verifyToken } from '@project-tracker/auth-library';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const typeDefs = readFileSync(
  path.resolve(__dirname, '../../../packages/graphql-schema/schema.graphql'),
  { encoding: 'utf-8' }
);

const server = new ApolloServer<BaseContext>({
  typeDefs,
  resolvers: resolvers as any,
});

/**
 * Resolve caller context from a signed bearer token. Fetching the full user
 * record keeps RBAC current even when a token was issued before a role change.
 */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function getBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function buildContext(authorization: string | undefined): Promise<{ user: any }> {
  const token = getBearerToken(authorization);
  const claims = token ? verifyToken(token, JWT_SECRET!) : null;
  const userId = claims?.id;
  if (!userId) return { user: null };

  try {
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    }));

    if (!Item) return { user: null };

    return {
      user: {
        ...Item,
        id: Item.userId,
      },
    };
  } catch (err) {
    console.error('[Context] Failed to fetch user:', err);
    return { user: null };
  }
}

// Lambda handler (production)
export const handler = startServerAndCreateLambdaHandler(
  server as any,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    context: async ({ event }) => {
      return buildContext(event.headers.authorization || event.headers.Authorization);
    },
  }
);

// Local dev server
if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT) || 4001;
  startStandaloneServer(server, {
    listen: { port },
    context: async ({ req }) => {
      return buildContext(req.headers.authorization);
    },
  }).then(({ url }) => {
    console.log(`🚀 Users Service ready at: ${url}`);
  });
}
