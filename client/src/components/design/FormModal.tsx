import React from "react";
import { Modal, Pressable, View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

interface FormModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function FormModal({ visible, onClose, title, children }: FormModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable
        className="flex-1 bg-black/40 justify-center px-6"
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <KeyboardAwareScrollView
            bottomOffset={20}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <View className="bg-white dark:bg-surface-card rounded-2xl p-6 gap-3">
              <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {title}
              </Text>
              {children}
            </View>
          </KeyboardAwareScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
