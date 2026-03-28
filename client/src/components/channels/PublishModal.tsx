import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { getApiClient } from "../../api";
import { getPriorityColorHex } from "../../utils/priority";

interface PublishModalProps {
  visible: boolean;
  topicName: string;
  onClose: () => void;
}

export function PublishModal({ visible, topicName, onClose }: PublishModalProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await getApiClient().publishToTopic(topicName, {
        title: title.trim() || undefined,
        message: message.trim(),
        priority,
      });

      Toast.show({
        type: "success",
        text1: "Message published",
        text2: `Sent to ${topicName}`,
      });

      // Reset form
      setTitle("");
      setMessage("");
      setPriority(5);
      onClose();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Publish failed",
        text2: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-surface-bg" edges={["top"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-body text-slate-500 dark:text-slate-400">
              Cancel
            </Text>
          </Pressable>
          <Text className="text-body font-semibold text-gray-900 dark:text-white">
            Publish to {topicName}
          </Text>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            hitSlop={12}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Text
                className="text-body font-semibold"
                style={{
                  color:
                    message.trim() ? "#3b82f6" : "#94a3b8",
                }}
              >
                Publish
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title input */}
          <View>
            <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Title (optional)
            </Text>
            <TextInput
              className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700"
              placeholder="Message title..."
              placeholderTextColor="#94a3b8"
              value={title}
              onChangeText={setTitle}
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Message textarea */}
          <View>
            <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Message
            </Text>
            <TextInput
              className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700"
              placeholder="Write your message..."
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />
          </View>

          {/* Priority picker */}
          <View>
            <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Priority: {priority}
            </Text>
            <View className="flex-row gap-1.5 flex-wrap">
              {priorityLevels.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  className="w-9 h-9 rounded-lg items-center justify-center"
                  style={{
                    backgroundColor:
                      priority === p
                        ? getPriorityColorHex(p)
                        : "#f1f5f9",
                    borderWidth: priority === p ? 0 : 1,
                    borderColor: "#e2e8f0",
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color: priority === p ? "#fff" : "#64748b",
                    }}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              1-3: Low · 4-5: Normal · 6-7: High · 8-10: Critical
            </Text>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
