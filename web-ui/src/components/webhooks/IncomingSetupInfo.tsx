import { useState } from 'react';
import { getWebhookGuide, renderSetupStep, incomingCurlExample } from 'shared';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      className="text-xs font-medium text-primary hover:text-brand-700 whitespace-nowrap transition"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

/**
 * Everything a user needs to hook a service up to an incoming webhook: the
 * URL, per-service paste-here steps, and a working curl. Shown on the
 * create-success screen and behind the row's "Setup" action.
 */
export default function IncomingSetupInfo({ webhookType, url, secret }: {
  webhookType: string;
  url: string;
  /** Plaintext secret if we just created it; stored secrets are never echoed. */
  secret?: string | null;
}) {
  const guide = getWebhookGuide(webhookType);
  const curl = incomingCurlExample(url, guide.samplePayload);

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-3.5">
        <div className="flex items-center gap-2">
          <code className="text-xs text-slate-800 dark:text-slate-100 break-all flex-1">{url}</code>
          <CopyButton text={url} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Set up {guide.label}</div>
        <ol className="space-y-1 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
          {guide.setupSteps.map((s, i) => (
            <li key={i} className="break-all">{renderSetupStep(s, url, secret)}</li>
          ))}
        </ol>
        <p className="text-xs text-slate-400 mt-2"><span className="font-medium">Understands:</span> {guide.events}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Try it now</div>
          <CopyButton text={curl} label="Copy curl" />
        </div>
        <pre className="bg-slate-900 rounded-xl p-3 text-xs text-green-400 whitespace-pre-wrap break-all">{curl}</pre>
        <p className="text-xs text-slate-400 mt-1.5">Every request (accepted or rejected) appears under Logs on the webhook row.</p>
      </div>
    </div>
  );
}
