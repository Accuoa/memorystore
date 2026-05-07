FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY config.example.yml ./config.example.yml

RUN mkdir -p /data /data/logs

EXPOSE 8787
CMD ["node", "src/server.mjs"]
