# Build stage
FROM node:24-alpine AS build

# Version injected at build time by the release workflow
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --loglevel=error

# Copy source code
COPY . .

# Build the application (VITE_APP_VERSION is baked into the bundle via vite.config.ts)
RUN npm run build

# Runtime stage
FROM nginx:1-alpine3.21

RUN apk upgrade --no-cache

# Default backend URL
ENV BACKEND_URL=http://localhost:8080

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1

# Expose port 80
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
