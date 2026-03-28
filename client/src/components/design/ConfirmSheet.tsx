import React from "react";
import { View, Text, Modal, Pressable } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";

interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  destructive = true,
}: ConfirmSheetProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-center items-center px-6" onPress={onClose}>
        <Pressable className="bg-white dark:bg-surface-card rounded-2xl p-5 w-full max-w-sm" onPress={(e) => e.stopPropagation()}>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400 mb-5">{message}</Text>
          <View className="flex-row gap-3 justify-end">
            <AnimatedPressable className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700" onPress={onClose} haptic={false}>
              <Text className="text-sm font-medium text-slate-600 dark:text-slate-300">Cancel</Text>
            </AnimatedPressable>
            <AnimatedPressable
              className={`px-4 py-2.5 rounded-lg ${destructive ? "bg-red-500" : "bg-primary"}`}
              onPress={() => { onConfirm(); onClose(); }}
            >
              <Text className="text-sm font-semibold text-white">{confirmLabel}</Text>
            </AnimatedPressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
