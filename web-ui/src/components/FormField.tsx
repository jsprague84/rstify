import React from 'react';

interface BaseProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface TextFieldProps extends BaseProps {
  type?: 'text' | 'password' | 'number';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface TextareaProps extends BaseProps {
  type: 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

interface SelectProps extends BaseProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

interface CheckboxProps extends BaseProps {
  type: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export type FormFieldProps = TextFieldProps | TextareaProps | SelectProps | CheckboxProps;

/**
 * Composable form field: label + input/select/textarea + validation error.
 * Replaces duplicated inline form markup across page modals.
 */
export function FormField(props: FormFieldProps) {
  const { label, error, required, className = '' } = props;

  const inputClasses =
    'w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  if (props.type === 'checkbox') {
    return (
      <label className={`flex items-center gap-2 ${className}`}>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        {error && <span className="text-red-500 text-xs ml-2">{error}</span>}
      </label>
    );
  }

  let input: React.ReactNode;

  if (props.type === 'select') {
    input = (
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className={inputClasses}>
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  } else if (props.type === 'textarea') {
    input = (
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
        className={inputClasses}
      />
    );
  } else {
    input = (
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={inputClasses}
      />
    );
  }

  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {input}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
