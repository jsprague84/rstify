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

# Generate TypeScript types from Rust DTOs
generate-types:
    TS_RS_EXPORT_DIR={{justfile_directory()}}/shared/generated cargo test --workspace 2>&1 | tail -5
    find shared/generated -name '*.ts' -exec sed -i 's/bigint/number/g' {} +
    @echo '// Auto-generated barrel export — do not hand-edit' > shared/generated/index.ts
    @echo '// Re-run: just generate-types' >> shared/generated/index.ts
    @echo '' >> shared/generated/index.ts
    @for f in shared/generated/*.ts; do \
        name=$$(basename "$$f" .ts); \
        [ "$$name" = "index" ] && continue; \
        echo "export * from \"./$$name\";" >> shared/generated/index.ts; \
    done
    @echo 'export * from "./serde_json/JsonValue";' >> shared/generated/index.ts
    @echo "Generated $$(ls shared/generated/*.ts | grep -v index.ts | wc -l) type files"
