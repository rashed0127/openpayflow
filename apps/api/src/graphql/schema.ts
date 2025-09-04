import { createSchema } from 'graphql-yoga';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

interface GraphQLContext {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export const schema = createSchema<GraphQLContext>({
  typeDefs: `
    type Query {
      hello: String
    }

    type Mutation {
      placeholder: String
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'Hello from OpenPayFlow GraphQL!',
    },
    Mutation: {
      placeholder: () => 'GraphQL mutations coming soon',
    },
  },
});
