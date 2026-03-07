# rstify Configuration Reference

All configuration is done via environment variables. Copy `.env.example` to `.env` for local development.

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `0.0.0.0:8080` | Address and port to bind the HTTP server |
| `DATABASE_URL` | `sqlite://rstify.db` | SQLite database file path |
| `JWT_SECRET` | `change-me-in-production` | Secret for signing JWT tokens. **Must be ≥32 bytes in production** |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded files (icons, attachments) |
| `RUST_LOG` | `info` | Log level filter (trace, debug, info, warn, error) |

## CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | *(unset — same-origin only)* | Comma-separated list of allowed origins for cross-origin requests. Example: `https://rstify.example.com,https://admin.example.com` |

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

## Production Recommendations

- Set `JWT_SECRET` to a random 64+ character string: `openssl rand -base64 64`
- Set `CORS_ORIGINS` explicitly to your domain(s)
- Use `RUST_LOG=warn` for production (reduce log volume)
- Mount `/data` and `/uploads` as persistent Docker volumes
- Set `RATE_LIMIT_BURST=30` and `RATE_LIMIT_RPS=5` for public-facing instances
