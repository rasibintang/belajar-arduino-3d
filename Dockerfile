# Server kompilasi untuk sandbox (arduino-cli + core AVR + library).
#   docker build -t learn-arduino-compiler .
#   docker run -p 8787:8787 -e CORS_ORIGIN=https://situsmu.vercel.app learn-arduino-compiler
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tar \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server ./server
COPY scripts/setup-arduino.mjs ./scripts/setup-arduino.mjs
RUN node scripts/setup-arduino.mjs && chown -R node:node /app

# jalankan sebagai pengguna biasa; kode pengguna dikompilasi di folder sementara
USER node
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/compile-server.mjs"]
