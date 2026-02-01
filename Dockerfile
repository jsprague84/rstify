FROM rust:1-slim-bookworm AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev libsqlite3-dev curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN cargo build --release --bin rstify-server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rstify-server /usr/local/bin/rstify-server

RUN mkdir -p /data /uploads

ENV DATABASE_URL=sqlite:///data/rstify.db
ENV UPLOAD_DIR=/uploads
ENV LISTEN_ADDR=0.0.0.0:8080

EXPOSE 8080

CMD ["rstify-server"]
