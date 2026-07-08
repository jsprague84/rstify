import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Switch, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { AnimatedPressable } from "../design/AnimatedPressable";
import { getApiClient } from "../../api";
import type { Topic } from "shared";
import Toast from "react-native-toast-message";

function PolicyChips({ options, selected, onSelect }: {
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View className="flex-row gap-2 flex-wrap">
      {options.map((o) => (
        <AnimatedPressable
          key={o.value}
          haptic={false}
          className={`px-3 py-1.5 rounded-full ${selected === o.value ? "bg-primary" : "bg-slate-100 dark:bg-surface-elevated"}`}
          onPress={() => onSelect(o.value)}
        >
          <Text className={`text-sm font-medium ${selected === o.value ? "text-white" : "text-slate-600 dark:text-slate-300"}`}>
            {o.label}
          </Text>
        </AnimatedPressable>
      ))}
    </View>
  );
}

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
  const [notifyPolicy, setNotifyPolicy] = useState("always");
  const [notifyPriorityMin, setNotifyPriorityMin] = useState("5");
  const [inboxOverride, setInboxOverride] = useState(""); // '' = auto
  const [inboxPriorityMin, setInboxPriorityMin] = useState("5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (topic) {
      setDescription(topic.description ?? "");
      setEveryoneRead(topic.everyone_read);
      setEveryoneWrite(topic.everyone_write);
      setNotifyPolicy(topic.notify_policy || "always");
      setNotifyPriorityMin(String(topic.notify_priority_min ?? 5));
      setInboxOverride(topic.inbox_override ?? "");
      setInboxPriorityMin(String(topic.inbox_priority_min ?? 5));
    }
  }, [topic]);

  const handleSave = async () => {
    if (!topic) return;
    setIsSubmitting(true);
    try {
      await getApiClient().updateTopic(topic.name, {
        description: description.trim() || null,
        everyone_read: everyoneRead,
        everyone_write: everyoneWrite,
        notify_policy: notifyPolicy,
        notify_priority_min:
          notifyPolicy === "threshold" ? parseInt(notifyPriorityMin, 10) || 5 : null,
        notify_condition: null,
        notify_digest_interval: null,
        store_policy: null,
        store_interval: null,
        // '' explicitly clears the override; null would mean keep-current
        inbox_override: inboxOverride,
        inbox_priority_min:
          inboxOverride === "threshold" ? parseInt(inboxPriorityMin, 10) || 5 : null,
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
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-white/[0.06]">
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-body text-slate-500 dark:text-slate-400">Cancel</Text>
            </Pressable>
            <Text className="text-body font-semibold text-slate-900 dark:text-white">
              Edit {topic?.name}
            </Text>
            <Pressable onPress={handleSave} disabled={isSubmitting} hitSlop={12}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#0052FF" />
              ) : (
                <Text className="text-body font-semibold text-primary">Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-4 gap-4" keyboardShouldPersistTaps="handled">
            <View>
              <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Description
              </Text>
              <TextInput
                className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06]"
                placeholder="What is this topic for?"
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>

            <View className="bg-white dark:bg-surface-card rounded-lg border border-slate-200 dark:border-white/[0.06] overflow-hidden">
              <View className="flex-row items-center justify-between p-3">
                <View>
                  <Text className="text-body font-medium text-slate-900 dark:text-white">Public Read</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Everyone can read messages</Text>
                </View>
                <Switch value={everyoneRead} onValueChange={setEveryoneRead} />
              </View>
              <View className="h-px bg-slate-100 dark:bg-slate-700" />
              <View className="flex-row items-center justify-between p-3">
                <View>
                  <Text className="text-body font-medium text-slate-900 dark:text-white">Public Write</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Everyone can publish messages</Text>
                </View>
                <Switch value={everyoneWrite} onValueChange={setEveryoneWrite} />
              </View>
            </View>

            <View>
              <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Notifications
              </Text>
              <PolicyChips
                options={[
                  { value: "always", label: "Always" },
                  { value: "never", label: "Never" },
                  { value: "threshold", label: "Priority ≥" },
                ]}
                selected={notifyPolicy}
                onSelect={setNotifyPolicy}
              />
              {notifyPolicy === "threshold" && (
                <TextInput
                  className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] mt-2 w-24"
                  keyboardType="numeric"
                  value={notifyPriorityMin}
                  onChangeText={setNotifyPriorityMin}
                  placeholder="5"
                  placeholderTextColor="#94a3b8"
                />
              )}
            </View>

            <View>
              <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Inbox Routing
              </Text>
              <PolicyChips
                options={[
                  { value: "", label: "Auto" },
                  { value: "always", label: "Always" },
                  { value: "never", label: "Channel only" },
                  { value: "threshold", label: "Priority ≥" },
                ]}
                selected={inboxOverride}
                onSelect={setInboxOverride}
              />
              {inboxOverride === "threshold" && (
                <TextInput
                  className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] mt-2 w-24"
                  keyboardType="numeric"
                  value={inboxPriorityMin}
                  onChangeText={setInboxPriorityMin}
                  placeholder="5"
                  placeholderTextColor="#94a3b8"
                />
              )}
              <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                Auto uses the server’s global priority threshold. “Channel only” keeps messages out of the inbox and push.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
