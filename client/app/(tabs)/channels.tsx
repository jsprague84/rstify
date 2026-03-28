import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getApiClient } from "../../src/api";
import { useChannelsStore } from "../../src/store";
import { FolderSection } from "../../src/components/channels/FolderSection";
import { EditTopicModal } from "../../src/components/channels/EditTopicModal";
import { PublishModal } from "../../src/components/channels/PublishModal";
import { ConfirmSheet } from "../../src/components/design/ConfirmSheet";
import { EmptyState } from "../../src/components/EmptyState";
import type { Topic } from "../../src/api/types";

// --- Create Topic Modal ---
interface CreateTopicModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateTopicModal({ visible, onClose, onCreated }: CreateTopicModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await getApiClient().createTopic({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create topic");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        className="flex-1 bg-slate-50 dark:bg-surface-bg"
        edges={["top"]}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-body text-slate-500 dark:text-slate-400">Cancel</Text>
          </Pressable>
          <Text className="text-body font-semibold text-gray-900 dark:text-white">
            New Topic
          </Text>
          <Pressable onPress={handleCreate} disabled={isSubmitting || !name.trim()} hitSlop={12}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Text
                className="text-body font-semibold"
                style={{ color: name.trim() ? "#3b82f6" : "#94a3b8" }}
              >
                Create
              </Text>
            )}
          </Pressable>
        </View>

        <View className="p-4 gap-4">
          <View>
            <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Topic Name
            </Text>
            <TextInput
              className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700"
              placeholder="e.g. alerts/production"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              returnKeyType="next"
            />
          </View>
          <View>
            <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Description (optional)
            </Text>
            <TextInput
              className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700"
              placeholder="What is this topic for?"
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>
          {error ? (
            <Text className="text-sm text-red-500 dark:text-red-400">{error}</Text>
          ) : null}
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// --- Create Folder Modal ---
interface CreateFolderModalProps {
  visible: boolean;
  onClose: () => void;
}

function CreateFolderModal({ visible, onClose }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const createFolder = useChannelsStore((s) => s.createFolder);

  const handleCreate = () => {
    const trimmed = folderName.trim();
    if (!trimmed) return;
    createFolder(trimmed);
    setFolderName("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-center items-center px-6"
        onPress={onClose}
      >
        <Pressable
          className="bg-white dark:bg-surface-card rounded-2xl p-5 w-full"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            New Folder
          </Text>
          <TextInput
            className="bg-slate-50 dark:bg-surface-bg rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700 mb-4"
            placeholder="Folder name..."
            placeholderTextColor="#94a3b8"
            value={folderName}
            onChangeText={setFolderName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <View className="flex-row gap-3 justify-end">
            <Pressable
              onPress={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700"
            >
              <Text className="text-body text-slate-600 dark:text-slate-300">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={!folderName.trim()}
              className="px-4 py-2 rounded-lg bg-blue-500"
              style={{ opacity: folderName.trim() ? 1 : 0.5 }}
            >
              <Text className="text-body font-semibold text-white">Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- Main Channels Screen ---
export default function ChannelsScreen() {
  const fetchTopics = useChannelsStore((s) => s.fetchTopics);
  const storeTopics = useChannelsStore((s) => s.topics);
  const storeFolders = useChannelsStore((s) => s.folders);
  const storePins = useChannelsStore((s) => s.pinnedTopics);
  const getFolderedTopics = useChannelsStore((s) => s.getFolderedTopics);
  const toggleFolderCollapsed = useChannelsStore((s) => s.toggleFolderCollapsed);
  const deleteFolder = useChannelsStore((s) => s.deleteFolder);
  const isLoading = useChannelsStore((s) => s.isLoading);

  const folderedTopics = useMemo(() => getFolderedTopics(), [storeTopics, storeFolders, storePins]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [publishTopic, setPublishTopic] = useState<Topic | null>(null);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);

  // MQTT section collapsed by default
  const [mqttCollapsed, setMqttCollapsed] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleRefresh = useCallback(() => {
    fetchTopics();
  }, [fetchTopics]);

  const { pinned, folders, mqtt, other } = folderedTopics;

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    Alert.alert(
      "Delete Folder",
      `Delete "${folderName}"? Topics inside will move back to the main list.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteFolder(folderId) },
      ],
    );
  };

  const handleDeleteTopic = async () => {
    if (!deleteTopic) return;
    try {
      await getApiClient().deleteTopic(deleteTopic.name);
      fetchTopics();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete topic");
    }
  };

  // Apply search filter across all topic groups
  const filterTopics = useCallback(
    (topicList: Topic[]) => {
      if (!searchQuery.trim()) return topicList;
      const q = searchQuery.toLowerCase();
      return topicList.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false),
      );
    },
    [searchQuery],
  );

  const filteredPinned = useMemo(() => filterTopics(pinned), [filterTopics, pinned]);
  const filteredMqtt = useMemo(() => filterTopics(mqtt), [filterTopics, mqtt]);
  const filteredOther = useMemo(() => filterTopics(other), [filterTopics, other]);
  const filteredFolders = useMemo(
    () =>
      folders.map((f) => ({
        ...f,
        filteredTopics: filterTopics(f.topics),
      })),
    [filterTopics, folders],
  );

  const totalVisible =
    filteredPinned.length +
    filteredMqtt.length +
    filteredOther.length +
    filteredFolders.reduce((sum, f) => sum + f.filteredTopics.length, 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-surface-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-display font-bold text-gray-900 dark:text-white">
          Channels
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setShowCreateFolder(true)}
            className="w-9 h-9 items-center justify-center rounded-full bg-white dark:bg-surface-card"
            hitSlop={8}
          >
            <Ionicons name="folder-outline" size={20} color="#6b7280" />
          </Pressable>
          <Pressable
            onPress={() => setShowCreateTopic(true)}
            className="w-9 h-9 items-center justify-center rounded-full bg-blue-500"
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View className="px-4 pb-2">
        <TextInput
          className="bg-white dark:bg-surface-card rounded-lg px-3 py-2 text-body text-gray-900 dark:text-white"
          placeholder="Search channels..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* Channel sections */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state */}
        {storeTopics.length === 0 && !isLoading ? (
          <EmptyState
            icon="git-branch-outline"
            title="No channels yet"
            subtitle="Create a topic channel to start organizing your messages"
          />
        ) : totalVisible === 0 && searchQuery.trim() ? (
          <EmptyState
            icon="search-outline"
            title="No results"
            subtitle={`No channels match "${searchQuery}"`}
          />
        ) : (
          <>
            {/* Pinned section */}
            <FolderSection
              title="Pinned"
              icon="📌"
              color="#3b82f6"
              topics={filteredPinned}
              onEditTopic={setEditTopic}
              onDeleteTopic={setDeleteTopic}
              onPublishTopic={setPublishTopic}
            />

            {/* User folders */}
            {filteredFolders.map((folder) => (
              <FolderSection
                key={folder.id}
                title={folder.name}
                icon="📁"
                color="#a78bfa"
                topics={folder.filteredTopics}
                collapsed={folder.collapsed}
                onToggle={() => toggleFolderCollapsed(folder.id)}
                onDelete={() => handleDeleteFolder(folder.id, folder.name)}
                showWhenEmpty
                emptyHint="Long-press a channel to move it here"
                onEditTopic={setEditTopic}
                onDeleteTopic={setDeleteTopic}
                onPublishTopic={setPublishTopic}
              />
            ))}

            {/* MQTT Topics */}
            <FolderSection
              title="MQTT Topics"
              icon="🔌"
              color="#f59e0b"
              topics={filteredMqtt}
              collapsed={mqttCollapsed}
              onToggle={() => setMqttCollapsed((c) => !c)}
              onEditTopic={setEditTopic}
              onDeleteTopic={setDeleteTopic}
              onPublishTopic={setPublishTopic}
            />

            {/* Other / ungrouped */}
            <FolderSection
              title="Topics"
              icon=""
              color="#6b7280"
              topics={filteredOther}
              onEditTopic={setEditTopic}
              onDeleteTopic={setDeleteTopic}
              onPublishTopic={setPublishTopic}
            />
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <CreateTopicModal
        visible={showCreateTopic}
        onClose={() => setShowCreateTopic(false)}
        onCreated={fetchTopics}
      />
      <CreateFolderModal
        visible={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
      />
      <EditTopicModal
        visible={!!editTopic}
        topic={editTopic}
        onClose={() => setEditTopic(null)}
        onUpdated={fetchTopics}
      />
      <PublishModal
        visible={!!publishTopic}
        topicName={publishTopic?.name ?? ""}
        onClose={() => setPublishTopic(null)}
      />
      <ConfirmSheet
        visible={!!deleteTopic}
        onClose={() => setDeleteTopic(null)}
        onConfirm={handleDeleteTopic}
        title="Delete Topic"
        message={`Delete "${deleteTopic?.name}"? All messages in this topic will be permanently removed.`}
      />
    </SafeAreaView>
  );
}
