import { useState } from 'react';

type Section = 'quickstart' | 'messages' | 'webhooks' | 'topics' | 'mqtt' | 'api' | 'config';

const sections: { key: Section; label: string }[] = [
  { key: 'quickstart', label: 'Quick Start' },
  { key: 'messages', label: 'Messages' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'topics', label: 'Topics' },
  { key: 'mqtt', label: 'MQTT' },
  { key: 'api', label: 'API Reference' },
  { key: 'config', label: 'Configuration' },
];

export default function Docs() {
  const [active, setActive] = useState<Section>('quickstart');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Documentation</h2>
      <div className="flex gap-6">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {sections.map(s => (
              <li key={s.key}>
                <button
                  onClick={() => setActive(s.key)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                    active === s.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 prose dark:prose-invert max-w-none text-sm">
            {active === 'quickstart' && <QuickStart />}
            {active === 'messages' && <MessagesDoc />}
            {active === 'webhooks' && <WebhooksDoc />}
            {active === 'topics' && <TopicsDoc />}
            {active === 'mqtt' && <MqttDoc />}
            {active === 'api' && <ApiDoc />}
            {active === 'config' && <ConfigDoc />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0">{title}</h3>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-xs overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function QuickStart() {
  return (
    <DocSection title="Quick Start">
      <h4>1. Create an Application</h4>
      <p>Navigate to <strong>Applications</strong> in the sidebar and click <strong>"New Application"</strong>. Give it a name and description. Copy the generated <strong>application token</strong>.</p>

      <h4>2. Send Your First Message</h4>
      <Code>{`curl -X POST https://your-server/message \\
  -H "X-Gotify-Key: YOUR_APP_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Hello", "message": "First notification!", "priority": 5}'`}</Code>

      <h4>3. View Messages</h4>
      <p>Open <strong>Messages</strong> in the sidebar to see your notification. Messages support <strong>Markdown formatting</strong>, including bold, italic, links, code blocks, and tables.</p>

      <h4>4. Real-time Updates</h4>
      <p>Messages appear instantly via WebSocket. You can also connect mobile apps using any Gotify-compatible client -- rstify is 100% API compatible.</p>

      <h4>5. Explore Features</h4>
      <ul>
        <li><strong>Topics</strong> -- publish/subscribe messaging for multi-subscriber broadcasts</li>
        <li><strong>Webhooks</strong> -- receive notifications from GitHub, GitLab, Jenkins, and more</li>
        <li><strong>MQTT</strong> -- bridge IoT devices and home automation systems</li>
        <li><strong>Attachments</strong> -- include files up to 25 MiB with messages</li>
      </ul>
    </DocSection>
  );
}

function MessagesDoc() {
  return (
    <DocSection title="Messages">
      <h4>Sending Messages</h4>
      <p>Messages can be sent via the Gotify-compatible API using an application token:</p>
      <Code>{`curl -X POST https://your-server/message \\
  -H "X-Gotify-Key: APP_TOKEN" \\
  -d '{"title": "Alert", "message": "Disk usage above 90%", "priority": 8}'`}</Code>

      <h4>Priority Levels</h4>
      <table className="w-full text-left">
        <thead><tr><th>Range</th><th>Level</th><th>Behavior</th></tr></thead>
        <tbody>
          <tr><td>0</td><td>Minimum</td><td>Silent, no notification</td></tr>
          <tr><td>1-3</td><td>Low</td><td>Quiet notification</td></tr>
          <tr><td>4-7</td><td>Normal</td><td>Standard notification</td></tr>
          <tr><td>8-10</td><td>High</td><td>Urgent, may override DND</td></tr>
        </tbody>
      </table>

      <h4>Markdown Support</h4>
      <p>Set the content type to enable Markdown rendering:</p>
      <Code>{`curl -X POST https://your-server/message \\
  -H "X-Gotify-Key: APP_TOKEN" \\
  -d '{
    "title": "Deploy Report",
    "message": "## Build \\u2705\\n\\n| Service | Status |\\n|---------|--------|\\n| API | Running |\\n| Web | Running |",
    "extras": {"client::display": {"contentType": "text/markdown"}}
  }'`}</Code>

      <h4>Click URLs</h4>
      <p>Add a URL that opens when the notification is clicked:</p>
      <Code>{`"extras": {
  "client::notification": {
    "click": {"url": "https://grafana.example.com/dashboard"}
  }
}`}</Code>

      <h4>File Attachments</h4>
      <p>Upload files to existing messages (max 25 MiB by default):</p>
      <Code>{`curl -X POST https://your-server/api/messages/123/attachments \\
  -H "Authorization: Bearer JWT" \\
  -F "file=@screenshot.png"`}</Code>
    </DocSection>
  );
}

function WebhooksDoc() {
  return (
    <DocSection title="Webhooks">
      <h4>Overview</h4>
      <p>rstify supports both <strong>incoming</strong> and <strong>outgoing</strong> webhooks:</p>
      <ul>
        <li><strong>Incoming</strong> -- receive HTTP requests from external services (GitHub, GitLab, Jenkins) and convert them into messages</li>
        <li><strong>Outgoing</strong> -- fire HTTP requests when messages are published to a topic</li>
      </ul>

      <h4>Creating an Incoming Webhook</h4>
      <ol>
        <li>Go to <strong>Webhooks</strong> and click <strong>"New Webhook"</strong></li>
        <li>Choose direction <strong>Incoming</strong></li>
        <li>Select the target topic or application</li>
        <li>Configure the template to extract fields from the payload</li>
        <li>Copy the generated webhook URL</li>
      </ol>

      <h4>Template Syntax</h4>
      <p>Use <code>{'{{field.path}}'}</code> to extract values from the incoming JSON payload:</p>
      <Code>{`{
  "title": "{{repository.name}} - {{action}}",
  "message": "{{sender.login}} {{action}} on {{ref}}",
  "priority": 5
}`}</Code>

      <h4>Outgoing Webhook Features</h4>
      <ul>
        <li><strong>HTTP methods:</strong> GET, POST, PUT, PATCH, DELETE</li>
        <li><strong>Authentication:</strong> None, Bearer Token, Basic Auth, or API Key</li>
        <li><strong>Content-Type:</strong> JSON, form-urlencoded, plain text, XML, or custom</li>
        <li><strong>Timeout:</strong> configurable per-webhook (default 15s)</li>
        <li><strong>Redirect handling:</strong> toggle follow-redirects per webhook</li>
        <li><strong>Retry:</strong> configurable max retries and delay between attempts</li>
        <li><strong>Template variables:</strong> use <code>{'{{env.KEY}}'}</code> to substitute user-defined variables</li>
      </ul>

      <h4>Template Variables</h4>
      <p>Define reusable variables in the <strong>Variables</strong> section of the Webhooks page. Reference them in outgoing webhook URLs and bodies:</p>
      <Code>{`URL:  https://api.example.com/v1/notify?key={{env.API_KEY}}
Body: {"channel": "{{env.SLACK_CHANNEL}}", "text": "{{message}}"}`}</Code>

      <h4>Webhook Groups</h4>
      <p>Organize webhooks into named groups. Grouped webhooks appear in collapsible sections in the list view.</p>

      <h4>Health Monitoring</h4>
      <p>The webhook list shows delivery health for outgoing webhooks:</p>
      <ul>
        <li><strong>Green dot</strong> -- 80%+ recent deliveries succeeded</li>
        <li><strong>Amber dot</strong> -- 50-79% success rate</li>
        <li><strong>Red dot</strong> -- below 50% success rate</li>
        <li><strong>Sparkline</strong> -- response time trend for the last 20 deliveries</li>
      </ul>

      <h4>Actions</h4>
      <ul>
        <li><strong>Test</strong> -- send a test delivery with optional custom payload</li>
        <li><strong>Curl</strong> -- copy a curl command to reproduce the webhook call</li>
        <li><strong>Code</strong> -- generate example code in Python, JavaScript, or Go</li>
        <li><strong>Duplicate</strong> -- create a copy of a webhook with all settings preserved</li>
        <li><strong>Regenerate Token</strong> -- generate a new token for incoming webhooks</li>
      </ul>
    </DocSection>
  );
}

function TopicsDoc() {
  return (
    <DocSection title="Topics">
      <h4>What are Topics?</h4>
      <p>Topics are named publish/subscribe channels. Any user with permission can subscribe and receive messages published to a topic.</p>

      <h4>Creating a Topic</h4>
      <ol>
        <li>Go to <strong>Topics</strong> and click <strong>"New Topic"</strong></li>
        <li>Enter a name (e.g. <code>alerts.production</code>)</li>
        <li>Optionally set description and permissions</li>
      </ol>

      <h4>Publishing to a Topic</h4>
      <Code>{`curl -X POST https://your-server/api/topics/alerts.production/publish \\
  -H "Authorization: Bearer JWT" \\
  -d '{"title": "CPU Alert", "message": "CPU usage at 95%", "priority": 8}'`}</Code>

      <h4>Permissions</h4>
      <ul>
        <li><strong>Everyone Read</strong> -- any authenticated user can subscribe</li>
        <li><strong>Everyone Write</strong> -- any authenticated user can publish</li>
        <li>Fine-grained permissions can be configured per-user in <strong>Permissions</strong></li>
        <li>Patterns like <code>alerts.*</code> grant access to multiple topics</li>
      </ul>

      <h4>Notification Policies</h4>
      <p>Control how topic messages trigger push notifications:</p>
      <table className="w-full text-left">
        <thead><tr><th>Policy</th><th>Behavior</th></tr></thead>
        <tbody>
          <tr><td><code>always</code></td><td>Notify on every message</td></tr>
          <tr><td><code>never</code></td><td>Never send push notifications</td></tr>
          <tr><td><code>threshold</code></td><td>Only notify above a priority threshold</td></tr>
          <tr><td><code>on_change</code></td><td>Notify when value changes from previous</td></tr>
          <tr><td><code>digest</code></td><td>Batch notifications into periodic digests</td></tr>
        </tbody>
      </table>
    </DocSection>
  );
}

function MqttDoc() {
  return (
    <DocSection title="MQTT Integration">
      <h4>Overview</h4>
      <p>rstify includes an integrated MQTT broker for IoT devices and home automation. Enable it by setting <code>MQTT_ENABLED=true</code>.</p>

      <h4>Connecting</h4>
      <Code>{`# Using mosquitto client with a client token
mosquitto_sub -h your-server -p 1883 \\
  -u "client-token" -P "CLIENT_TOKEN_HERE" \\
  -t "sensors/#"

# Publishing
mosquitto_pub -h your-server -p 1883 \\
  -u "client-token" -P "CLIENT_TOKEN_HERE" \\
  -t "sensors/temperature" \\
  -m '{"title": "Temp", "message": "22.5C", "priority": 3}'`}</Code>

      <h4>Topic Mapping</h4>
      <p>MQTT topics with <code>/</code> separators are mapped to rstify topics with <code>.</code> separators:</p>
      <ul>
        <li><code>home/sensors/temp</code> becomes <code>home.sensors.temp</code></li>
        <li>Topics are auto-created when messages arrive</li>
      </ul>

      <h4>MQTT Bridges</h4>
      <p>Bridges connect rstify to external MQTT brokers. Messages received on subscribed topics are ingested as rstify messages.</p>
      <ol>
        <li>Go to <strong>MQTT Bridges</strong> and click <strong>"New Bridge"</strong></li>
        <li>Enter the remote broker URL (e.g. <code>broker.hivemq.com:1883</code>)</li>
        <li>Configure subscribe and publish topics</li>
        <li>Optionally set credentials, QoS, and topic prefix</li>
      </ol>

      <h4>Bridge Status</h4>
      <p>The bridge list shows connection status for each bridge:</p>
      <ul>
        <li><strong>Green (Connected)</strong> -- bridge is running and connected</li>
        <li><strong>Red (Disconnected)</strong> -- bridge is enabled but the connection failed</li>
        <li><strong>Gray (Disabled)</strong> -- bridge is not enabled</li>
      </ul>
    </DocSection>
  );
}

function ApiDoc() {
  return (
    <DocSection title="API Reference">
      <h4>Authentication</h4>
      <p>rstify supports two authentication methods:</p>
      <ul>
        <li><strong>Application tokens</strong> -- for sending messages (<code>X-Gotify-Key</code> header)</li>
        <li><strong>Client tokens</strong> -- for reading messages and managing resources (<code>Authorization: Bearer</code> header or <code>X-Gotify-Key</code> header)</li>
      </ul>

      <h4>Core Endpoints</h4>
      <table className="w-full text-left">
        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>POST</td><td><code>/message</code></td><td>Send a message (app token)</td></tr>
          <tr><td>GET</td><td><code>/api/messages</code></td><td>List messages</td></tr>
          <tr><td>DELETE</td><td><code>/api/messages/:id</code></td><td>Delete a message</td></tr>
          <tr><td>GET</td><td><code>/api/applications</code></td><td>List applications</td></tr>
          <tr><td>POST</td><td><code>/api/applications</code></td><td>Create application</td></tr>
          <tr><td>GET</td><td><code>/api/topics</code></td><td>List topics</td></tr>
          <tr><td>POST</td><td><code>/api/topics/:name/publish</code></td><td>Publish to topic</td></tr>
        </tbody>
      </table>

      <h4>Webhook Endpoints</h4>
      <table className="w-full text-left">
        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td><code>/api/webhooks</code></td><td>List webhook configs</td></tr>
          <tr><td>POST</td><td><code>/api/webhooks</code></td><td>Create webhook</td></tr>
          <tr><td>PUT</td><td><code>/api/webhooks/:id</code></td><td>Update webhook</td></tr>
          <tr><td>DELETE</td><td><code>/api/webhooks/:id</code></td><td>Delete webhook</td></tr>
          <tr><td>POST</td><td><code>/api/webhooks/:id/test</code></td><td>Test outgoing webhook</td></tr>
          <tr><td>GET</td><td><code>/api/webhooks/:id/deliveries</code></td><td>Delivery log</td></tr>
          <tr><td>POST</td><td><code>/api/webhooks/:id/regenerate-token</code></td><td>Regenerate incoming token</td></tr>
          <tr><td>POST</td><td><code>/api/wh/:token</code></td><td>Incoming webhook endpoint</td></tr>
        </tbody>
      </table>

      <h4>Webhook Variables</h4>
      <table className="w-full text-left">
        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td><code>/api/webhook-variables</code></td><td>List variables</td></tr>
          <tr><td>POST</td><td><code>/api/webhook-variables</code></td><td>Create variable</td></tr>
          <tr><td>PUT</td><td><code>/api/webhook-variables/:id</code></td><td>Update variable</td></tr>
          <tr><td>DELETE</td><td><code>/api/webhook-variables/:id</code></td><td>Delete variable</td></tr>
        </tbody>
      </table>

      <h4>MQTT Endpoints</h4>
      <table className="w-full text-left">
        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td><code>/api/mqtt/status</code></td><td>Broker status and bridge info</td></tr>
          <tr><td>GET</td><td><code>/api/mqtt/bridges</code></td><td>List bridges</td></tr>
          <tr><td>POST</td><td><code>/api/mqtt/bridges</code></td><td>Create bridge</td></tr>
          <tr><td>PUT</td><td><code>/api/mqtt/bridges/:id</code></td><td>Update bridge</td></tr>
          <tr><td>DELETE</td><td><code>/api/mqtt/bridges/:id</code></td><td>Delete bridge</td></tr>
        </tbody>
      </table>

      <h4>Real-time Streams</h4>
      <table className="w-full text-left">
        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>WS</td><td><code>/stream</code></td><td>WebSocket message stream (Gotify-compatible)</td></tr>
          <tr><td>GET</td><td><code>/api/stream/sse</code></td><td>Server-Sent Events stream</td></tr>
        </tbody>
      </table>

      <h4>System Endpoints</h4>
      <table className="w-full text-left">
        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td><code>/health</code></td><td>Health check</td></tr>
          <tr><td>GET</td><td><code>/version</code></td><td>Server version</td></tr>
          <tr><td>GET</td><td><code>/api/stats</code></td><td>Admin statistics</td></tr>
        </tbody>
      </table>
    </DocSection>
  );
}

function ConfigDoc() {
  return (
    <DocSection title="Configuration">
      <p>All configuration is done via environment variables. Copy <code>.env.example</code> to <code>.env</code> for local development.</p>

      <h4>Server</h4>
      <table className="w-full text-left">
        <thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>LISTEN_ADDR</code></td><td><code>0.0.0.0:8080</code></td><td>HTTP server bind address</td></tr>
          <tr><td><code>DATABASE_URL</code></td><td><code>sqlite://rstify.db</code></td><td>SQLite database path</td></tr>
          <tr><td><code>JWT_SECRET</code></td><td><code>change-me-...</code></td><td>JWT signing secret (&gt;= 32 bytes)</td></tr>
          <tr><td><code>UPLOAD_DIR</code></td><td><code>./uploads</code></td><td>File upload directory</td></tr>
          <tr><td><code>RSTIFY_MAX_ATTACHMENT_SIZE</code></td><td><code>26214400</code></td><td>Max upload size in bytes (25 MiB)</td></tr>
          <tr><td><code>RUST_LOG</code></td><td><code>info</code></td><td>Log level</td></tr>
        </tbody>
      </table>

      <h4>CORS &amp; Rate Limiting</h4>
      <table className="w-full text-left">
        <thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>CORS_ORIGINS</code></td><td><em>unset</em></td><td>Comma-separated allowed origins</td></tr>
          <tr><td><code>RATE_LIMIT_BURST</code></td><td><code>60</code></td><td>Token bucket burst size per IP</td></tr>
          <tr><td><code>RATE_LIMIT_RPS</code></td><td><code>10</code></td><td>Token refill rate per second</td></tr>
        </tbody>
      </table>

      <h4>MQTT Broker</h4>
      <table className="w-full text-left">
        <thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>MQTT_ENABLED</code></td><td><code>false</code></td><td>Enable the integrated MQTT broker</td></tr>
          <tr><td><code>MQTT_LISTEN_ADDR</code></td><td><code>0.0.0.0:1883</code></td><td>MQTT TCP listen address</td></tr>
          <tr><td><code>MQTT_WS_LISTEN_ADDR</code></td><td><em>unset</em></td><td>MQTT WebSocket listen address</td></tr>
          <tr><td><code>MQTT_REQUIRE_AUTH</code></td><td><code>true</code></td><td>Require MQTT authentication</td></tr>
          <tr><td><code>MQTT_MAX_PAYLOAD</code></td><td><code>20480</code></td><td>Max MQTT payload bytes</td></tr>
          <tr><td><code>MQTT_MAX_CONNECTIONS</code></td><td><code>1000</code></td><td>Max concurrent connections</td></tr>
        </tbody>
      </table>

      <h4>FCM Push Notifications</h4>
      <table className="w-full text-left">
        <thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>FCM_PROJECT_ID</code></td><td><em>unset</em></td><td>Firebase project ID</td></tr>
          <tr><td><code>FCM_SERVICE_ACCOUNT_PATH</code></td><td><em>unset</em></td><td>Path to service account JSON</td></tr>
        </tbody>
      </table>

      <h4>SMTP Email</h4>
      <table className="w-full text-left">
        <thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>SMTP_HOST</code></td><td><em>unset</em></td><td>SMTP server hostname</td></tr>
          <tr><td><code>SMTP_PORT</code></td><td><code>587</code></td><td>SMTP server port</td></tr>
          <tr><td><code>SMTP_USER</code></td><td><em>empty</em></td><td>SMTP username</td></tr>
          <tr><td><code>SMTP_PASS</code></td><td><em>empty</em></td><td>SMTP password</td></tr>
          <tr><td><code>SMTP_FROM</code></td><td><em>auto</em></td><td>Sender email address</td></tr>
        </tbody>
      </table>

      <h4>Production Tips</h4>
      <ul>
        <li>Generate a strong JWT secret: <code>openssl rand -base64 64</code></li>
        <li>Set <code>CORS_ORIGINS</code> to your exact domain(s)</li>
        <li>Use <code>RUST_LOG=warn</code> in production</li>
        <li>Lower rate limits for public instances: <code>RATE_LIMIT_BURST=30 RATE_LIMIT_RPS=5</code></li>
        <li>Mount <code>/data</code> and <code>/uploads</code> as persistent volumes</li>
      </ul>
    </DocSection>
  );
}
