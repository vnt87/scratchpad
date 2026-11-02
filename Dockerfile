FROM node:22-alpine AS web-build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM golang:1.24-alpine AS go-build
WORKDIR /app

# Create unprivileged nonroot user entry for scratch image
RUN echo "nonroot:x:65532:65532:nonroot:/:/sbin/nologin" > /etc/passwd_scratch

COPY server.go ./
COPY --from=web-build /app/dist ./dist

# Compile static binary with zero external dependencies, stripped symbols
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -trimpath -o scratchpad server.go

# Ultra-minimal runtime: empty scratch image (~2.4MB compressed, ~6MB uncompressed)
FROM scratch
COPY --from=go-build /etc/passwd_scratch /etc/passwd
COPY --from=go-build /app/scratchpad /scratchpad

USER 65532:65532
EXPOSE 8787
ENTRYPOINT ["/scratchpad"]
