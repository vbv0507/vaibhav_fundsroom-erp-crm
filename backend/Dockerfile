# --- Stage 1: Build ----------------------------------------------------------
FROM node:20-alpine AS builder

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDeps needed for tsc + prisma)
RUN npm ci

# Copy source and Prisma schema
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Runtime --------------------------------------------------------
FROM node:20-alpine AS runtime

# Install openssl (required by Prisma client at runtime)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy only production artefacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Default port – override via docker-compose / Render / Railway
ENV PORT=5000

EXPOSE ${PORT}

# Run the compiled entry-point
CMD ["node", "dist/index.js"]
