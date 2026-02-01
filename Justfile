default:
    @just --list

# Build web UI
build-web-ui:
    cd web-ui && npm ci && npm run build

# Build Rust binary (requires web-ui to be built first)
build: build-web-ui
    cargo build --release --bin rstify-server

# Run dev server (Rust only, use vite dev proxy for web UI)
dev:
    cargo run --bin rstify-server

# Run web UI dev server (with API proxy to localhost:8080)
dev-web:
    cd web-ui && npm run dev

# Run tests
test:
    cargo test

# Check Rust compilation
check:
    cargo check

# Build Docker image
docker-build:
    docker build -t rstify .
