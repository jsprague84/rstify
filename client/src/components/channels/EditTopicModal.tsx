import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Switch, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { getApiClient } from "../../api";
import type { Topic } from "../../api/types";
import Toast from "react-native-toast-message";

interface EditTopicModalProps {
  visible: boolean;
  topic: Topic | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditTopicModal({ visible, topic, onClose, onUpdated }: EditTopicModalProps) {
  const [description, setDescription] = useState("");
  const [everyoneRead, setEveryoneRead] = useState(false);
  const [everyoneWrite, setEveryoneWrite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (topic) {
      setDescription(topic.description ?? "");
      setEveryoneRead(topic.everyone_read);
      setEveryoneWrite(topic.everyone_write);
    }
  }, [topic]);

  const handleSave = async () => {
    if (!topic) return;
    setIsSubmitting(true);
    try {
      await getApiClient().updateTopic(topic.name, {
        description: description.trim() || undefined,
        everyone_read: everyoneRead,
        everyone_write: everyoneWrite,
      });
      Toast.show({ type: "success", text1: "Topic updated" });
      onUpdated();
      onClose();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed to update topic",
        text2: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-surface-bg" edges={["top"]}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-body text-slate-500 dark:text-slate-400">Cancel</Text>
            </Pressable>
            <Text className="text-body font-semibold text-gray-900 dark:text-white">
              Edit {topic?.name}
            </Text>
            <Pressable onPress={handleSave} disabled={isSubmitting} hitSlop={12}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Text className="text-body font-semibold text-primary">Save</Text>
              )}
            </Pressable>
          </View>

          <View className="p-4 gap-4">
            <View>
              <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Description
              </Text>
              <TextInput
                className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700"
                placeholder="What is this topic for?"
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>

            <View className="bg-white dark:bg-surface-card rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <View className="flex-row items-center justify-between p-3">
                <View>
                  <Text className="text-body font-medium text-gray-900 dark:text-white">Public Read</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Everyone can read messages</Text>
                </View>
                <Switch value={everyoneRead} onValueChange={setEveryoneRead} />
              </View>
              <View className="h-px bg-slate-100 dark:bg-slate-700" />
              <View className="flex-row items-center justify-between p-3">
                <View>
                  <Text className="text-body font-medium text-gray-900 dark:text-white">Public Write</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Everyone can publish messages</Text>
                </View>
                <Switch value={everyoneWrite} onValueChange={setEveryoneWrite} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
