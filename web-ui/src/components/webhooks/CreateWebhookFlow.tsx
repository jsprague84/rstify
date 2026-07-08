import { useState } from 'react';
import { api } from '../../api/client';
import type { CreateWebhookConfig, WebhookConfig, Topic, Application, WebhookVariable } from 'shared';
import IncomingWebhookForm from './IncomingWebhookForm';
import OutgoingWebhookForm from './OutgoingWebhookForm';
import IncomingSetupInfo from './IncomingSetupInfo';
import { primaryBtnCls } from './styles';

type Step = 'direction' | 'incoming' | 'outgoing' | 'success';

function DirectionCard({ title, subtitle, examples, onClick }: {
  title: string; subtitle: string; examples: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-left rounded-2xl border border-slate-200 dark:border-white/10 p-5 hover:border-primary hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition group"
    >
      <div className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition">{title}</div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{subtitle}</p>
      <p className="text-xs text-slate-400 mt-2.5">{examples}</p>
    </button>
  );
}

/**
 * Two-path guided creation: pick a direction, fill a focused form, and (for
 * incoming) land on a success screen with the URL — the artifact the user
 * actually needs — plus paste-here instructions for the chosen service.
 */
export default function CreateWebhookFlow({ topics, apps, variables, existingGroups, onCreated, onClose }: {
  topics: Topic[];
  apps: Application[];
  variables: WebhookVariable[];
  existingGroups: string[];
  /** Called once after a successful create so the parent can reload its list. */
  onCreated: (wh: WebhookConfig) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('direction');
  const [created, setCreated] = useState<WebhookConfig | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const submit = async (data: CreateWebhookConfig) => {
    const wh = await api.createWebhook(data);
    setCreated(wh);
    setCreatedSecret(data.secret ?? null);
    setStep('success');
    onCreated(wh);
  };

  if (step === 'direction') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">What should this webhook do?</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <DirectionCard
            title="↓ Receive notifications"
            subtitle="A service posts to a URL on this server and the payload becomes a message."
            examples="GitHub · Forgejo · Grafana · any script that can POST JSON"
            onClick={() => setStep('incoming')}
          />
          <DirectionCard
            title="↑ Send to another service"
            subtitle="Every message published to a topic is forwarded as an HTTP request you define."
            examples="n8n · Slack-compatible endpoints · home-automation hooks"
            onClick={() => setStep('outgoing')}
          />
        </div>
      </div>
    );
  }

  if (step === 'incoming') {
    return (
      <IncomingWebhookForm
        topics={topics}
        apps={apps}
        existingGroups={existingGroups}
        onSubmit={submit}
        onBack={() => setStep('direction')}
        onClose={onClose}
      />
    );
  }

  if (step === 'outgoing') {
    return (
      <OutgoingWebhookForm
        topics={topics}
        variables={variables}
        existingGroups={existingGroups}
        onSubmit={submit}
        onBack={() => setStep('direction')}
        onClose={onClose}
      />
    );
  }

  // success
  if (!created) return null;
  if (created.direction === 'outgoing') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-success font-medium text-sm">
          <span className="w-2 h-2 rounded-full bg-success inline-block" />
          Webhook created
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          “{created.name}” will fire on every message published to its topic. Use <span className="font-medium text-slate-700 dark:text-slate-200">Test</span> on the webhook row to send a sample delivery and see the live response.
        </p>
        <div className="flex justify-end">
          <button onClick={onClose} className={primaryBtnCls}>Done</button>
        </div>
      </div>
    );
  }

  const url = `${window.location.origin}/api/wh/${created.token}`;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-success font-medium text-sm">
        <span className="w-2 h-2 rounded-full bg-success inline-block" />
        Webhook created — here’s your URL
      </div>
      <IncomingSetupInfo webhookType={created.webhook_type} url={url} secret={createdSecret} />
      <div className="flex justify-end">
        <button onClick={onClose} className={primaryBtnCls}>Done</button>
      </div>
    </div>
  );
}
