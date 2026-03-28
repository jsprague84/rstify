interface PriorityBadgeProps {
  priority: number;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cls =
    priority >= 8
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : priority >= 5
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>
      P{priority}
    </span>
  );
}
