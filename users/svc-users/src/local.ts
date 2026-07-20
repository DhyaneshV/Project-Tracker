import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { resolvers } from './resolvers/index.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { verifyToken } from '@project-tracker/auth-library';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const typeDefs = readFileSync(
  path.resolve(__dirname, '../../../packages/graphql-schema/schema.graphql'),
  { encoding: 'utf-8' }
);

const server = new ApolloServer({ typeDefs, resolvers: resolvers as any });

const port = Number(process.env.PORT) || 4001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const { url } = await startStandaloneServer(server, {
  listen: { port },
  context: async ({ req }) => {
    const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    const claims = match?.[1] ? verifyToken(match[1], JWT_SECRET!) : null;
    const userId = claims?.id;
    if (!userId) return { user: null };

    const { ddbDocClient, TABLE_NAME } = await import('./db.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    try {
      const { Item } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));
      return { user: Item ? { ...Item, id: Item.userId } : null };
    } catch {
      return { user: null };
    }
  },
});

console.log(`🚀 Users Service (local) ready at: ${url}`);
