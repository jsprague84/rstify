/**
 * Per-service setup guides for INCOMING webhooks, shared by web-ui and mobile.
 *
 * `setupSteps` strings may contain the placeholders {URL} and {SECRET}; the
 * UI substitutes the webhook's real URL / configured secret before display.
 */

export interface WebhookServiceGuide {
  /** The `webhook_type` value stored on the config. */
  type: string;
  label: string;
  /** One-line description shown with the service picker. */
  blurb: string;
  /** Header the sender uses for HMAC signatures; null = no native signing. */
  signatureHeader: string | null;
  /** Contextual help for the secret field. */
  secretHelp: string;
  /** Paste-here instructions shown after the webhook is created. */
  setupSteps: string[];
  /** Example payload a sender would POST (for docs/curl examples). */
  samplePayload: string;
  /** Summary of events/behaviors the parser understands. */
  events: string;
}

export const WEBHOOK_SERVICE_GUIDES: WebhookServiceGuide[] = [
  {
    type: 'github',
    label: 'GitHub',
    blurb: 'Push, PR, issue, release and workflow events from a GitHub repository.',
    signatureHeader: 'X-Hub-Signature-256',
    secretHelp:
      'Paste the same secret into the GitHub webhook form — rstify verifies the X-Hub-Signature-256 header and rejects unsigned requests.',
    setupSteps: [
      'In your repository, open Settings → Webhooks → Add webhook.',
      'Payload URL: {URL}',
      'Content type: application/json',
      'Secret: {SECRET}',
      'Choose the events to send (push, pull requests, issues, releases, workflow runs…) and save.',
    ],
    samplePayload:
      '{"ref":"refs/heads/main","commits":[{"message":"Fix build"}],"repository":{"full_name":"you/repo"},"pusher":{"name":"you"}}',
    events:
      'push, pull_request, issues, issue_comment, release, create/delete, fork, workflow_run/workflow_job — anything else falls back to a generic summary.',
  },
  {
    type: 'forgejo',
    label: 'Forgejo / Gitea',
    blurb: 'Push, PR, issue, release and workflow events from a Forgejo or Gitea instance.',
    signatureHeader: 'X-Gitea-Signature',
    secretHelp:
      'Paste the same secret into the Forgejo/Gitea webhook form — rstify verifies the X-Gitea-Signature / X-Forgejo-Signature header.',
    setupSteps: [
      'In your repository, open Settings → Webhooks → Add webhook → Forgejo/Gitea.',
      'Target URL: {URL}',
      'HTTP method: POST, content type: application/json',
      'Secret: {SECRET}',
      'Pick the trigger events and save.',
    ],
    samplePayload:
      '{"ref":"refs/heads/main","commits":[{"message":"Fix build"}],"repository":{"full_name":"you/repo"},"pusher":{"username":"you"}}',
    events:
      'push, pull_request, issues, issue_comment, release, create/delete, fork, workflow_run/workflow_job — anything else falls back to a generic summary.',
  },
  {
    type: 'grafana',
    label: 'Grafana',
    blurb: 'Alert notifications from a Grafana webhook contact point.',
    signatureHeader: 'X-Signature-256',
    secretHelp:
      'Optional: if your sender adds a hex HMAC-SHA256 of the body in X-Signature-256 (or X-Signature / X-Webhook-Signature), rstify verifies it.',
    setupSteps: [
      'In Grafana, open Alerting → Contact points → Add contact point → Webhook.',
      'URL: {URL}',
      'HTTP method: POST.',
      'Save, then use "Test" in Grafana to send a test alert.',
    ],
    samplePayload: '{"title":"[FIRING] CPU high","message":"CPU usage above 90% on host-1"}',
    events: 'Reads "title" and "message" from the alert payload; fixed priority 5.',
  },
  {
    type: 'custom',
    label: 'Custom / JSON',
    blurb: 'Any service or script that can POST JSON — the simplest way in.',
    signatureHeader: 'X-Signature-256',
    secretHelp:
      'Optional: send a hex HMAC-SHA256 of the raw body in X-Signature-256 (or X-Signature / X-Webhook-Signature) and rstify will verify it.',
    setupSteps: [
      'POST JSON to: {URL}',
      'Body fields: "title" (optional), "message" (or "text").',
      'Set the Content-Type header to application/json.',
    ],
    samplePayload: '{"title":"Backup finished","message":"Nightly backup completed in 42s"}',
    events: 'Reads "title" and "message"/"text" from the payload; fixed priority 5.',
  },
];

export function getWebhookGuide(type: string): WebhookServiceGuide {
  // "json" and "gitea" are stored values from older configs; map them to
  // their canonical guides.
  const canonical = type === 'json' ? 'custom' : type === 'gitea' ? 'forgejo' : type;
  return (
    WEBHOOK_SERVICE_GUIDES.find((g) => g.type === canonical) ??
    WEBHOOK_SERVICE_GUIDES[WEBHOOK_SERVICE_GUIDES.length - 1]
  );
}

/** Substitute {URL} / {SECRET} placeholders in a setup step. */
export function renderSetupStep(step: string, url: string, secret?: string | null): string {
  return step
    .replace('{URL}', url)
    .replace('{SECRET}', secret && secret.length > 0 ? secret : 'the secret you configured');
}

/** Build a copy-pasteable curl example for an incoming webhook. */
export function incomingCurlExample(url: string, samplePayload?: string): string {
  const body = samplePayload ?? '{"title":"Test","message":"Hello from rstify"}';
  return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
}

/**
 * Body-template variables actually implemented by the outgoing delivery job
 * (crates/rstify-jobs/src/outgoing_webhooks.rs). Keep in sync with the backend.
 */
export const OUTGOING_TEMPLATE_VARIABLES: Array<{ token: string; description: string }> = [
  { token: '{{title}}', description: 'Message title' },
  { token: '{{message}}', description: 'Message body' },
  { token: '{{topic}}', description: 'Topic name' },
  { token: '{{priority}}', description: 'Priority (0–10)' },
  { token: '{{json}}', description: 'Full message as JSON' },
];
