import { useState } from 'react';

export default function TokenDisplay({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-xs bg-slate-100 dark:bg-surface-elevated text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono truncate max-w-[200px]">
        {token}
      </code>
      <button onClick={copy} className="text-xs font-medium text-primary hover:text-brand-700">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </span>
  );
}
