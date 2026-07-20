import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
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

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function buildContext(headers: Record<string, string | undefined>) {
  const match = (headers.authorization || headers.Authorization)?.match(/^Bearer\s+(.+)$/i);
  const user = match?.[1] ? verifyToken(match[1], JWT_SECRET!) : null;

  return {
    userId: user?.id,
    user,
  };
}

export const handler = startServerAndCreateLambdaHandler(
  server as any,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    context: async ({ event }) => buildContext(event.headers as any),
  }
);

if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT) || 4002;
  startStandaloneServer(server, {
    listen: { port },
    context: async ({ req }) =>
      buildContext(req.headers as Record<string, string | undefined>),
  }).then(({ url }) => {
    console.log(`🚀  Projects Service ready at: ${url}`);
  });
}
