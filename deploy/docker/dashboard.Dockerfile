FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/common/package.json ./packages/common/
COPY apps/dashboard/package.json ./apps/dashboard/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ ./packages/
COPY apps/dashboard/ ./apps/dashboard/

# Build packages
RUN pnpm --filter @openpayflow/common build

# Build dashboard
RUN pnpm --filter @openpayflow/dashboard build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "--filter", "@openpayflow/dashboard", "start"]
