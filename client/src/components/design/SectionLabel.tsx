import React from "react";
import { Text } from "react-native";

interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1">
      {children}
    </Text>
  );
}
