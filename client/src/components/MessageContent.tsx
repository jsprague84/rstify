import React from "react";
import { Text } from "react-native";
import Markdown from "react-native-markdown-display";
import { useColorScheme } from "nativewind";
import type { MessageResponse } from "../api/types";

interface MessageContentProps {
  message: MessageResponse;
}

export const MessageContent = React.memo(function MessageContent({ message }: MessageContentProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Detect markdown via extras — extras is Record<string, unknown>, cast nested access
  const display = message.extras?.["client::display"] as { contentType?: string } | undefined;
  const isMarkdown = display?.contentType === "text/markdown";

  if (isMarkdown) {
    const markdownStyles = {
      body: {
        color: isDark ? "#E5E7EB" : "#374151",
        fontSize: 14,
        lineHeight: 20,
      },
      heading1: {
        color: isDark ? "#F9FAFB" : "#111827",
        fontSize: 24,
        fontWeight: "700" as const,
        marginTop: 8,
        marginBottom: 8,
      },
      heading2: {
        color: isDark ? "#F9FAFB" : "#111827",
        fontSize: 20,
        fontWeight: "700" as const,
        marginTop: 8,
        marginBottom: 6,
      },
      heading3: {
        color: isDark ? "#F9FAFB" : "#111827",
        fontSize: 18,
        fontWeight: "600" as const,
        marginTop: 6,
        marginBottom: 6,
      },
      heading4: {
        color: isDark ? "#F3F4F6" : "#1F2937",
        fontSize: 16,
        fontWeight: "600" as const,
        marginTop: 4,
        marginBottom: 4,
      },
      heading5: {
        color: isDark ? "#F3F4F6" : "#1F2937",
        fontSize: 14,
        fontWeight: "600" as const,
        marginTop: 4,
        marginBottom: 4,
      },
      heading6: {
        color: isDark ? "#F3F4F6" : "#1F2937",
        fontSize: 14,
        fontWeight: "600" as const,
        marginTop: 4,
        marginBottom: 4,
      },
      strong: {
        fontWeight: "700" as const,
        color: isDark ? "#F9FAFB" : "#111827",
      },
      em: {
        fontStyle: "italic" as const,
        color: isDark ? "#E5E7EB" : "#374151",
      },
      code_inline: {
        backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
        color: isDark ? "#F472B6" : "#DB2777",
        fontFamily: "monospace",
        fontSize: 13,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
      },
      code_block: {
        backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
        borderColor: isDark ? "#374151" : "#E5E7EB",
        borderWidth: 1,
        borderRadius: 6,
        padding: 12,
        fontFamily: "monospace",
        fontSize: 13,
        color: isDark ? "#E5E7EB" : "#374151",
      },
      fence: {
        backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
        borderColor: isDark ? "#374151" : "#E5E7EB",
        borderWidth: 1,
        borderRadius: 6,
        padding: 12,
        fontFamily: "monospace",
        fontSize: 13,
        color: isDark ? "#E5E7EB" : "#374151",
      },
      link: {
        color: isDark ? "#60A5FA" : "#2563EB",
        textDecorationLine: "underline" as const,
      },
      blockquote: {
        backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
        borderLeftColor: isDark ? "#4B5563" : "#D1D5DB",
        borderLeftWidth: 3,
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 8,
      },
      bullet_list: { marginVertical: 4 },
      ordered_list: { marginVertical: 4 },
      list_item: { marginVertical: 2 },
      bullet_list_icon: {
        color: isDark ? "#9CA3AF" : "#6B7280",
        fontSize: 14,
        marginRight: 8,
      },
      ordered_list_icon: {
        color: isDark ? "#9CA3AF" : "#6B7280",
        fontSize: 14,
        marginRight: 8,
      },
      table: {
        borderWidth: 1,
        borderColor: isDark ? "#374151" : "#E5E7EB",
        borderRadius: 6,
        marginVertical: 8,
      },
      thead: {
        backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
      },
      tbody: {
        backgroundColor: isDark ? "#111827" : "#FFFFFF",
      },
      th: {
        padding: 8,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: isDark ? "#374151" : "#E5E7EB",
        fontWeight: "600" as const,
        color: isDark ? "#F9FAFB" : "#111827",
      },
      tr: {
        borderBottomWidth: 1,
        borderColor: isDark ? "#374151" : "#E5E7EB",
      },
      td: {
        padding: 8,
        borderRightWidth: 1,
        borderColor: isDark ? "#374151" : "#E5E7EB",
        color: isDark ? "#E5E7EB" : "#374151",
      },
      hr: {
        backgroundColor: isDark ? "#374151" : "#E5E7EB",
        height: 1,
        marginVertical: 16,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 8,
      },
    };

    return (
      <Markdown style={markdownStyles}>
        {message.message}
      </Markdown>
    );
  }

  // Plain text rendering
  return (
    <Text className="text-body text-slate-700 dark:text-slate-300 my-1">
      {message.message}
    </Text>
  );
});
