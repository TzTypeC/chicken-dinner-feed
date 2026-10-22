FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy root and workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for building
RUN npm ci

# Copy source trees
COPY shared ./shared
COPY backend ./backend
COPY frontend ./frontend

# Build workspaces: shared -> backend -> frontend
RUN npm run build

# Production runtime image
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4317

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/data ./backend/data
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 4317

CMD ["npm", "run", "start", "-w", "@cdf/backend"]
