# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

# Copy package json files for workspaces
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Build the web app
RUN npm run build --workspace=apps/web

# Build the backend server
RUN npm run build --workspace=apps/server

FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Identifica a revisao implantada e invalida a imagem antiga mantida pelo
# gerenciador da VPS quando o codigo de producao muda.
ARG BUILD_REVISION=dev
LABEL com.feitosasolucoes.build-revision=${BUILD_REVISION}

# Copy package files again to install only production dependencies
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/

RUN npm install -g npm@latest && npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built frontend
COPY --from=build /app/apps/web/dist ./apps/web/dist
# If products.js is still read by backend from src, copy it
COPY --from=build /app/apps/web/src/data/products.js ./apps/web/src/data/products.js

# Copy backend
COPY --from=build /app/apps/server ./apps/server

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

CMD ["node", "apps/server/dist/server/index.js"]
