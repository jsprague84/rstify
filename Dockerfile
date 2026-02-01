FROM node:20-slim AS web-builder

WORKDIR /app/web-ui
COPY web-ui/package.json web-ui/package-lock.json ./
RUN npm ci
COPY web-ui/ .
RUN npm run build

FROM rust:1-slim-bookworm AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev libsqlite3-dev curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
COPY --from=web-builder /app/web-ui/dist /app/web-ui/dist
RUN cargo build --release --bin rstify-server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

RUN groupadd -r rstify && useradd -r -g rstify -s /sbin/nologin rstify

COPY --from=builder /app/target/release/rstify-server /usr/local/bin/rstify-server

RUN mkdir -p /data /uploads && chown rstify:rstify /data /uploads

ENV DATABASE_URL=sqlite:///data/rstify.db
ENV UPLOAD_DIR=/uploads
ENV LISTEN_ADDR=0.0.0.0:8080

EXPOSE 8080

USER rstify

CMD ["rstify-server"]
