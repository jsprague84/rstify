# rstify Configuration Reference

All configuration is done via environment variables. Copy `.env.example` to `.env` for local development.

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `0.0.0.0:8080` | Address and port to bind the HTTP server |
| `DATABASE_URL` | `sqlite://rstify.db` | SQLite database file path |
| `JWT_SECRET` | `change-me-in-production` | Secret for signing JWT tokens. **Must be >= 32 bytes in production** |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded files (icons, attachments) |
| `RSTIFY_MAX_ATTACHMENT_SIZE` | `26214400` (25 MiB) | Maximum upload size in bytes for file attachments |
| `RUST_LOG` | `info` | Log level filter (trace, debug, info, warn, error) |

## CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | *(unset -- same-origin only)* | Comma-separated list of allowed origins for cross-origin requests. Example: `https://rstify.example.com,https://admin.example.com` |

## Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_BURST` | `60` | Maximum burst capacity per IP (token bucket size) |
| `RATE_LIMIT_RPS` | `10.0` | Token refill rate per second |

## FCM Push Notifications

Both variables must be set to enable Firebase Cloud Messaging.

| Variable | Default | Description |
|----------|---------|-------------|
| `FCM_PROJECT_ID` | *(unset)* | Firebase project ID |
| `FCM_SERVICE_ACCOUNT_PATH` | *(unset)* | Path to Firebase service account JSON key file |

## MQTT Broker

The integrated MQTT broker is disabled by default. Set `MQTT_ENABLED=true` to activate it.

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_ENABLED` | `false` | Enable the integrated MQTT broker |
| `MQTT_LISTEN_ADDR` | `0.0.0.0:1883` | TCP listen address for MQTT connections |
| `MQTT_WS_LISTEN_ADDR` | *(unset)* | WebSocket listen address (e.g. `0.0.0.0:8083`) |
| `MQTT_REQUIRE_AUTH` | `true` | Require authentication for MQTT connections |
| `MQTT_MAX_PAYLOAD` | `20480` | Maximum MQTT message payload size in bytes |
| `MQTT_MAX_CONNECTIONS` | `1000` | Maximum concurrent MQTT connections |

## SMTP Email Notifications

All SMTP variables must be set to enable email notifications.

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | *(unset)* | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASS` | *(empty)* | SMTP password |
| `SMTP_FROM` | `rstify@{host}` | Sender email address |

## Production Recommendations

- Set `JWT_SECRET` to a random 64+ character string: `openssl rand -base64 64`
- Set `CORS_ORIGINS` explicitly to your domain(s)
- Use `RUST_LOG=warn` for production (reduce log volume)
- Mount `/data` and `/uploads` as persistent Docker volumes
- Set `RATE_LIMIT_BURST=30` and `RATE_LIMIT_RPS=5` for public-facing instances
- Enable MQTT authentication (`MQTT_REQUIRE_AUTH=true`) if the broker is exposed
