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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const typeDefs = readFileSync(
  path.resolve(__dirname, '../../../packages/graphql-schema/schema.graphql'),
  { encoding: 'utf-8' }
);

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = Number(process.env.PORT) || 4002;

startStandaloneServer(server, {
  listen: { port },
  context: async ({ req }) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    let user = null;
    if (token) {
      try {
        user = verifyToken(token, JWT_SECRET!);
      } catch (e) {
        console.error('Token verification failed:', e);
      }
    }

    return {
      userId: user?.id,
      user,
    };
  },
}).then(({ url }) => {
  console.log(`🚀  Projects Service ready at: ${url}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DynamoDB Endpoint: ${process.env.DYNAMODB_ENDPOINT || 'AWS Default'}`);
});
