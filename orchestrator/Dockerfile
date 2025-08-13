# RP9 Orchestrator - Dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source
RUN rm -rf src/ tsconfig.json && \
    npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001

# Set ownership
RUN chown -R orchestrator:nodejs /app
USER orchestrator

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "dist/index.js"]