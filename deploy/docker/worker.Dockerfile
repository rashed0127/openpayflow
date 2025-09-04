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
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Set Prisma environment variables for Docker builds
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Copy source code
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

# Build packages
RUN pnpm --filter @openpayflow/common build
RUN pnpm --filter @openpayflow/gateway-core build

# Build worker
RUN pnpm --filter @openpayflow/worker build

# Start the application
CMD ["pnpm", "--filter", "@openpayflow/worker", "start"]
