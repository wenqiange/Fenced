import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { PlanningChatReply } from "@fenced/ai/client";
import { PLANNING_TOOL_ALLOWLIST } from "@fenced/ai/client";
import { useAuth } from "../src/lib/auth";
import { useApi } from "../src/lib/api";
import { canUseLlmUi } from "../src/lib/ai-access";
import { proposeScheduleWithAdvice } from "../src/lib/time-block";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Adult-only planning chat. Tools are allowlisted to propose_schedule /
 * parse_task / none — never writes calendar events. Applying a schedule
 * suggestion only navigates to the review sheet with soft prefs.
 */
export default function PlanningChatScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const auth = useAuth();
  const api = useApi();
  const llmOk = canUseLlmUi("llm-planning-chat");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "I can suggest how to plan — I never write your calendar. Ask me to propose a schedule or parse a task.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastReply, setLastReply] = useState<PlanningChatReply | null>(null);
  const [error, setError] = useState<string | null>(null);

  function safeGoBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/tasks");
  }

  async function send() {
    if (!input.trim() || !llmOk || !auth.isSignedIn) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const reply = await api.ai.planningChat.mutate({ messages: next });
      if (!PLANNING_TOOL_ALLOWLIST.includes(reply.tool)) {
        throw new Error("Disallowed tool");
      }
      setLastReply(reply);
      setMessages([...next, { role: "assistant", content: reply.reply }]);
    } catch {
      setError("Chat unavailable. Local schedule still works from Tasks → Schedule.");
    } finally {
      setLoading(false);
    }
  }

  function applyProposeTool() {
    if (!lastReply || lastReply.tool !== "propose_schedule") return;
    // Soft prefs only — packer runs on the review screen when user opens it.
    // Prefetch validates the prefs don't invent times.
    proposeScheduleWithAdvice(
      lastReply.suggestedHorizon ?? "today",
      lastReply.softPreferences,
    );
    router.push("/time-block");
  }

  if (!llmOk) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={safeGoBack}>
            <Ionicons name="close" size={26} color={t.textMuted} />
          </Pressable>
          <Text style={styles.headerTitle}>Planning chat</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.denied}>
          <Text style={styles.deniedText}>
            Planning chat is adult-only. Minors keep the local parser and
            deterministic scheduler with no model involved.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={safeGoBack}>
          <Ionicons name="close" size={26} color={t.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>Planning chat</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.banner}>
        AI suggests · system decides. Tools: {PLANNING_TOOL_ALLOWLIST.join(", ")}.
        No calendar writes.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {messages.map((m, i) => (
          <View
            key={i}
            style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}
          >
            <Text style={styles.bubbleText}>{m.content}</Text>
          </View>
        ))}
        {lastReply?.tool === "propose_schedule" && (
          <Pressable style={styles.toolCard} onPress={applyProposeTool}>
            <Text style={styles.toolTitle}>Suggested: propose schedule</Text>
            <Text style={styles.toolBody}>
              Opens the deterministic review sheet with soft preferences — nothing
              is written until you Accept.
            </Text>
          </Pressable>
        )}
        {lastReply?.tool === "parse_task" && lastReply.parseText && (
          <View style={styles.toolCard}>
            <Text style={styles.toolTitle}>Suggested task text</Text>
            <Text style={styles.toolBody}>{lastReply.parseText}</Text>
            <Text style={styles.toolHint}>
              Paste into Tasks to parse locally (or Ask AI there). Not auto-created.
            </Text>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={
            auth.isSignedIn ? "Ask for a plan…" : "Sign in to chat"
          }
          placeholderTextColor={t.textMuted}
          editable={auth.isSignedIn && !loading}
          onSubmitEditing={() => void send()}
        />
        <Pressable
          style={[styles.send, (!input.trim() || loading) && styles.sendDisabled]}
          onPress={() => void send()}
          disabled={!input.trim() || loading || !auth.isSignedIn}
        >
          {loading ? (
            <ActivityIndicator color={t.onPrimary} />
          ) : (
            <Ionicons name="send" size={18} color={t.onPrimary} />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    banner: {
      marginHorizontal: 20,
      marginBottom: 8,
      fontSize: 12,
      color: t.accent,
      fontWeight: "600",
    },
    scroll: { padding: 20, paddingBottom: 100, gap: 10 },
    bubble: { borderRadius: 14, padding: 12, maxWidth: "90%" },
    userBubble: { alignSelf: "flex-end", backgroundColor: t.primary },
    aiBubble: { alignSelf: "flex-start", backgroundColor: t.surface },
    bubbleText: { fontSize: 14, color: t.text, lineHeight: 20 },
    toolCard: {
      backgroundColor: t.accentSoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.primary,
      padding: 12,
    },
    toolTitle: { fontSize: 13, fontWeight: "700", color: t.accent },
    toolBody: { fontSize: 13, color: t.text, marginTop: 6, lineHeight: 18 },
    toolHint: { fontSize: 12, color: t.textMuted, marginTop: 6 },
    error: { fontSize: 12, color: t.error },
    composer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      gap: 8,
      padding: 12,
      paddingBottom: 28,
      backgroundColor: t.bg,
      borderTopWidth: 1,
      borderTopColor: t.borderStrong,
    },
    input: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: t.text,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendDisabled: { opacity: 0.4 },
    denied: { padding: 24 },
    deniedText: { fontSize: 15, color: t.textMuted, lineHeight: 22 },
  });
