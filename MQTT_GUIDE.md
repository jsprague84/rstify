# MQTT Integration Guide

rstify includes a built-in MQTT broker powered by rumqttd, allowing IoT devices and services to publish and subscribe to messages directly. It also supports bridging to external MQTT brokers.

## Getting Started

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_ENABLED` | `false` | Enable the MQTT broker (`true` or `1`) |
| `MQTT_LISTEN_ADDR` | `0.0.0.0:1883` | TCP listener address |
| `MQTT_WS_LISTEN_ADDR` | _(none)_ | WebSocket listener address (e.g. `0.0.0.0:8083`) |
| `MQTT_REQUIRE_AUTH` | `true` | Require client token authentication |
| `MQTT_MAX_PAYLOAD` | `20480` | Maximum MQTT payload size in bytes |
| `MQTT_MAX_CONNECTIONS` | `1000` | Maximum concurrent MQTT connections |

### Minimal Setup

```bash
export MQTT_ENABLED=true
export MQTT_LISTEN_ADDR=0.0.0.0:1883
# Start rstify as normal
./rstify-server
```

## Direct Connection

Devices connect to rstify's embedded MQTT broker using client tokens for authentication.

### Authentication

When `MQTT_REQUIRE_AUTH=true` (default), clients authenticate using:
- **Username**: any value (ignored)
- **Password**: a valid rstify client token or JWT

Create a client token in the web UI or mobile app under Settings > Client Tokens.

### Example: mosquitto_pub

```bash
# Publish a plain text message
mosquitto_pub -h your-server.com -p 1883 \
  -u "device" -P "your-client-token" \
  -t "sensors/temperature" \
  -m "Temperature is 23.5C"

# Publish a JSON message with title and priority
mosquitto_pub -h your-server.com -p 1883 \
  -u "device" -P "your-client-token" \
  -t "alerts/server" \
  -m '{"title":"CPU Alert","message":"CPU usage at 95%","priority":8}'
```

### Example: mosquitto_sub

```bash
# Subscribe to all messages
mosquitto_sub -h your-server.com -p 1883 \
  -u "device" -P "your-client-token" \
  -t "#"

# Subscribe to a specific topic
mosquitto_sub -h your-server.com -p 1883 \
  -u "device" -P "your-client-token" \
  -t "sensors/#"
```

## Topic Mapping

MQTT uses `/` as a topic separator, while rstify uses `.` internally. The mapping is:

| MQTT Topic | rstify Topic |
|------------|-------------|
| `sensors/temperature` | `sensors.temperature` |
| `home/living-room/light` | `home.living-room.light` |
| `alerts/server` | `alerts.server` |

Topics starting with `rstify/` are reserved for internal use and are ignored by the ingest pipeline (anti-loop protection).

### Auto-creation

When a message is published to an MQTT topic that doesn't exist in rstify, the topic is automatically created with default settings.

## Payload Parsing

The MQTT ingest pipeline uses a 3-strategy approach:

1. **rstify JSON**: If the payload is JSON containing `message` (and optionally `title`, `priority`), those fields are extracted directly.
2. **Plain JSON**: If the payload is valid JSON but doesn't contain rstify fields, the entire JSON is stored as the message body with the MQTT topic as the title.
3. **Plain text**: The payload is used as the message body.

Binary payloads are stored with a `[binary payload: N bytes]` placeholder.

## External Bridges

rstify can bridge to external MQTT brokers to monitor and forward messages.

### Creating a Bridge

Via the web UI: Navigate to MQTT Bridges > New Bridge.

Via the API:
```bash
curl -X POST https://your-server.com/api/mqtt/bridges \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Home Assistant",
    "remote_url": "192.168.1.100:1883",
    "subscribe_topics": ["homeassistant/#", "zigbee2mqtt/#"],
    "username": "mqtt_user",
    "password": "mqtt_pass",
    "qos": 1,
    "auto_create_topics": true
  }'
```

### Bridge URL Formats

The `remote_url` field supports:
- `host:port` (e.g. `192.168.1.100:1883`)
- `mqtt://host:port`
- `tcp://host:port`

## Notification Policies

Per-topic notification policies control when push notifications are sent:

| Policy | Description |
|--------|-------------|
| `always` | Send push for every message (default) |
| `never` | Never send push notifications |
| `threshold` | Only notify when `priority >= notify_priority_min` |
| `on_change` | Only notify when the specified field value changes |
| `digest` | Batch notifications at a fixed interval |

Set via the topic edit screen in web UI or mobile app.

## Storage Policies

Per-topic storage policies control which messages are persisted to the database:

| Policy | Description |
|--------|-------------|
| `all` | Store every message (default) |
| `interval` | Store at most one message per `store_interval` seconds |
| `on_change` | Only store when the message body differs from the last stored message |

Messages that are not stored are still broadcast to WebSocket clients for live dashboards.

## Home Assistant Integration

Add to your Home Assistant `configuration.yaml`:

```yaml
mqtt:
  broker: your-rstify-server.com
  port: 1883
  username: homeassistant
  password: YOUR_CLIENT_TOKEN
```

Or create a bridge from rstify to your Home Assistant MQTT broker to aggregate messages.

## Node-RED Integration

Use the MQTT Out node with:
- **Server**: `your-rstify-server.com:1883`
- **Security**: Username/Password with your client token as password
- **Topic**: e.g. `automation/alerts`

## Deployment

### Docker Compose

```yaml
services:
  rstify:
    image: rstify:latest
    ports:
      - "8080:8080"    # HTTP
      - "1883:1883"    # MQTT TCP
      - "8083:8083"    # MQTT WebSocket (optional)
    environment:
      - MQTT_ENABLED=true
      - MQTT_LISTEN_ADDR=0.0.0.0:1883
      - MQTT_WS_LISTEN_ADDR=0.0.0.0:8083
      - MQTT_REQUIRE_AUTH=true
```

### Reverse Proxy Configuration

#### Caddy

```caddy
your-server.com {
    reverse_proxy /mqtt/* localhost:8083
    reverse_proxy * localhost:8080
}
```

#### nginx

```nginx
# MQTT WebSocket
location /mqtt {
    proxy_pass http://127.0.0.1:8083;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

#### Traefik

```yaml
http:
  routers:
    mqtt-ws:
      rule: "PathPrefix(`/mqtt`)"
      service: mqtt-ws
  services:
    mqtt-ws:
      loadBalancer:
        servers:
          - url: "http://rstify:8083"
```

For raw TCP MQTT (port 1883), use a TCP/stream proxy or expose the port directly.

## MQTT Status API

Check broker status:

```bash
curl https://your-server.com/api/mqtt/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "enabled": true,
  "listen_addr": "0.0.0.0:1883",
  "ws_listen_addr": "0.0.0.0:8083",
  "connections": 5,
  "bridges_active": 2
}
```

## Message Source Tracking

Messages include a `source` field indicating their origin:
- `null` or absent — API
- `mqtt` — MQTT broker
- `ntfy` — ntfy compatibility endpoint
- `webhook` — Incoming webhook

This is visible in the web UI and mobile app as a subtle badge next to the timestamp.
