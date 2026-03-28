import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '../design/AnimatedPressable';

interface IntegrationTileProps {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
}

export function IntegrationTile({ icon, title, subtitle, href }: IntegrationTileProps) {
  const router = useRouter();

  return (
    <AnimatedPressable
      className="flex-1 bg-white dark:bg-surface-card rounded-xl p-4"
      onPress={() => router.push(href as never)}
    >
      <Text className="text-2xl mb-2">{icon}</Text>
      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {subtitle}
      </Text>
    </AnimatedPressable>
  );
}
