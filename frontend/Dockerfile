# --- Stage 1: Build ----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (vite, tsc, etc. are devDeps)
RUN npm ci

# Copy source files
COPY . .

# Build the Vite bundle
# VITE_API_BASE_URL is injected at build-time via --build-arg / docker-compose args
ARG VITE_API_BASE_URL=http://localhost:5000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# --- Stage 2: Runtime (nginx) ------------------------------------------------
FROM nginx:alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our SPA-friendly nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
