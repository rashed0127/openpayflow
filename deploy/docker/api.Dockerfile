FROM node:18

# Install required system dependencies for Prisma
RUN apt-get update && apt-get install -y openssl libssl3 ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/common/package.json ./packages/common/
COPY packages/gateway-core/package.json ./packages/gateway-core/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Set Prisma environment variables for Docker builds
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client with correct binary targets
RUN cd apps/api && pnpm exec prisma generate --generator client

# Build packages
RUN pnpm --filter @openpayflow/common build
RUN pnpm --filter @openpayflow/gateway-core build

# Build API
RUN pnpm --filter @openpayflow/api build

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/v1/healthz || exit 1

# Start the application with migration  
CMD ["sh", "-c", "cd apps/api && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db push && pnpm --filter @openpayflow/api start"]
