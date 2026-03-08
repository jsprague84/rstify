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
| `JWT_SECRET` | *(insecure default)* | JWT signing secret (>= 32 bytes) |
| `MQTT_ENABLED` | `false` | Enable integrated MQTT broker |

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
  rstify-server/    # Binary entry point, config, telemetry
  rstify-api/       # Axum HTTP handlers, WebSocket, SSE
  rstify-core/      # Models, traits, domain logic
  rstify-db/        # SQLite repositories, migrations
  rstify-auth/      # Password hashing, JWT
  rstify-jobs/      # Background jobs, outgoing webhooks, email
  rstify-mqtt/      # MQTT broker, bridges, ingest
web-ui/             # React 19 + TypeScript + Vite + Tailwind
client/             # React Native + Expo mobile app
```

## API

rstify exposes a Gotify-compatible REST API plus extensions:

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

## License

See [LICENSE](LICENSE) for details.
