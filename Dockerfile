FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM alpine:latest AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Minimal modular nodejs runtime from Alpine (drops npm, corepack, headers, ICU bloat)
RUN apk add --no-cache nodejs && adduser -D -u 1000 node

COPY package.json ./
COPY server.js ./
COPY --from=build /app/dist ./dist

EXPOSE 8787
USER node
CMD ["node", "server.js"]
