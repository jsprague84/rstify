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
      <code className="text-xs bg-gray-100 dark:bg-gray-800 dark:text-gray-200 px-2 py-0.5 rounded font-mono truncate max-w-[200px]">
        {token}
      </code>
      <button onClick={copy} className="text-xs text-indigo-600 hover:text-indigo-800">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </span>
  );
}
