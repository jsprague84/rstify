interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  actions?: (item: T) => React.ReactNode;
  emptyMessage?: string;
}

export default function DataTable<T>({ columns, data, keyField, actions, emptyMessage = 'No data' }: DataTableProps<T>) {
  if (data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {col.header}
              </th>
            ))}
            {actions && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map(item => (
            <tr key={String(item[keyField])} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
              {actions && <td className="px-4 py-3 text-sm text-right">{actions(item)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
