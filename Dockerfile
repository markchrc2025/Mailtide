# MailTide — single-stage image. Kept simple and reliable for self-hosting:
# it carries the Prisma CLI and tsx so the entrypoint can run migrations and
# the idempotent seed on boot.
FROM node:22-bookworm-slim

# Prisma needs openssl/ca-certificates at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci

# App source.
COPY . .

# Generate the Prisma client and build Next.js.
RUN npm run build

# Runtime config. HOST=127.0.0.1 keeps the app on loopback; with
# network_mode: host, Caddy on the same box reaches it and nothing else can.
ENV HOST=127.0.0.1
ENV PORT=3000
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
