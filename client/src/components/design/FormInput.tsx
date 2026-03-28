import React from "react";
import { TextInput, type TextInputProps } from "react-native";

interface FormInputProps extends Omit<TextInputProps, "className"> {
  multiline?: boolean;
}

export function FormInput({ multiline, style, ...props }: FormInputProps) {
  return (
    <TextInput
      className={`bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100 ${multiline ? "min-h-[72px]" : ""}`}
      placeholderTextColor="#9ca3af"
      textAlignVertical={multiline ? "top" : undefined}
      multiline={multiline}
      style={style}
      {...props}
    />
  );
}
