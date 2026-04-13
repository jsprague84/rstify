# rstify

A self-hosted notification server built with Rust. 100% compatible with Gotify clients, with additional features like topics, webhooks, MQTT, and file attachments.

## Features

- **Gotify API compatible** -- works with existing Gotify mobile apps and clients
- **Topics** -- publish/subscribe messaging with fine-grained permissions
- **Webhooks** -- incoming (GitHub, GitLab, etc.) and outgoing with health monitoring
- **MQTT broker** -- integrated broker with external bridge support
- **File attachments** -- upload files up to 25 MiB per message
- **Markdown** -- full GitHub Flavored Markdown rendering in web UI
- **Dark mode** -- web UI with light/dark theme support
- **Real-time** -- WebSocket and SSE message streaming
- **FCM push** -- Firebase Cloud Messaging for mobile notifications

## Quick Start

```bash
# Clone and build
git clone https://github.com/your-org/rstify.git
cd rstify
cp .env.example .env
# Edit .env -- at minimum, set JWT_SECRET

# Build and run
cargo build --release
./target/release/rstify-server

# Web UI development
cd web-ui && npm install && npm run dev
```

The server starts on `http://localhost:8080` with a default admin account (`admin` / `admin`). Change the password immediately.

## Configuration

All configuration is via environment variables. See [`.env.example`](.env.example) for the full list, or the [Configuration Reference](docs/CONFIGURATION.md).

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `0.0.0.0:8080` | HTTP server bind address |
| `DATABASE_URL` | `sqlite://rstify.db` | SQLite database path |
| `JWT_SECRET` | *(required)* | JWT signing secret (>= 32 bytes) |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded files |
| `RSTIFY_MAX_ATTACHMENT_SIZE` | `26214400` (25 MiB) | Maximum upload size in bytes |
| `MQTT_ENABLED` | `false` | Enable integrated MQTT broker |
| `CORS_ORIGINS` | *(unset)* | Comma-separated allowed origins |
| `RATE_LIMIT_BURST` | `60` | Max burst capacity per IP |
| `RATE_LIMIT_RPS` | `10.0` | Token refill rate per second |
| `SMTP_HOST` | *(unset)* | SMTP host (enables email notifications) |
| `FCM_PROJECT_ID` | *(unset)* | Firebase project ID (with `FCM_SERVICE_ACCOUNT_PATH` enables push) |

See the [Configuration Reference](docs/CONFIGURATION.md) for the complete list including SMTP, FCM, MQTT, and CORS options.

## Documentation

- [Quick Start Guide](QUICKSTART.md)
- [User Guide](docs/USER_GUIDE.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [MQTT Guide](MQTT_GUIDE.md)
- [API Authentication](docs/API_AUTHENTICATION.md)
- [Message Features](docs/MESSAGE_FEATURES.md)
- [Backup & Restore](docs/BACKUP.md)

Documentation is also available in the web UI under the **Documentation** section.

## Architecture

```
crates/
  rstify-server/    # Binary entry point, centralized config, telemetry
  rstify-api/       # Axum HTTP handlers, WebSocket, SSE, OpenAPI spec
  rstify-core/      # Models, traits, domain logic
  rstify-db/        # SQLite repositories, migrations
  rstify-auth/      # Password hashing, JWT
  rstify-jobs/      # Background jobs, outgoing webhooks, email
  rstify-mqtt/      # MQTT broker, bridges, ingest
shared/             # Cross-frontend TypeScript types (ts-rs codegen) + utils
web-ui/             # React 19 + TypeScript + Vite + Tailwind
client/             # React Native + Expo mobile app
```

The `shared/` package contains TypeScript types auto-generated from Rust DTOs via [ts-rs](https://github.com/Aleph-Alpha/ts-rs), ensuring type safety across both frontends. Regenerate with `just generate-types`.

The backend includes 230+ handler-level integration tests covering all API endpoints.

## API

rstify exposes a Gotify-compatible REST API plus extensions.

**Interactive API docs** are available at [`/docs`](http://localhost:8080/docs) (Swagger UI) with the OpenAPI spec at [`/docs/openapi.json`](http://localhost:8080/docs/openapi.json).

```bash
# Send a message
curl -X POST http://localhost:8080/message \
  -H "X-Gotify-Key: APP_TOKEN" \
  -d '{"title": "Hello", "message": "World", "priority": 5}'

# Publish to a topic
curl -X POST http://localhost:8080/api/topics/alerts/publish \
  -H "Authorization: Bearer JWT" \
  -d '{"title": "Alert", "message": "CPU high", "priority": 8}'
```

## Development

```bash
# Run all tests (230+ handler-level integration tests)
cargo test --workspace

# Regenerate TypeScript types from Rust DTOs
just generate-types

# Build web UI
cd web-ui && npm run build

# Run dev server (Rust backend)
just dev

# Run web UI dev server (with API proxy)
just dev-web

# Full release build (web UI + Rust binary)
just build
```

Swagger UI is available at `/docs` when the server is running -- useful for exploring and testing the API interactively.

## License

See [LICENSE](LICENSE) for details.
