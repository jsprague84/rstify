FROM node:20-slim AS web-builder

WORKDIR /app/web-ui
COPY web-ui/package.json web-ui/package-lock.json ./
RUN npm ci
COPY shared/ /app/shared/
COPY web-ui/ .
RUN npm run build

FROM rust:1-slim-bookworm AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev libsqlite3-dev curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
COPY --from=web-builder /app/web-ui/dist /app/web-ui/dist
RUN cargo build --release --bin rstify-server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates gosu curl && rm -rf /var/lib/apt/lists/*

RUN groupadd -r rstify && useradd -r -g rstify -s /sbin/nologin rstify

COPY --from=builder /app/target/release/rstify-server /usr/local/bin/rstify-server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data /uploads && chown rstify:rstify /data /uploads

ENV DATABASE_URL=sqlite:///data/rstify.db
ENV UPLOAD_DIR=/uploads
ENV LISTEN_ADDR=0.0.0.0:8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["rstify-server"]
