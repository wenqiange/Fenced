import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useApi } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import {
  useThemeColors,
  useThemedStyles,
  type ThemeColors,
} from "../../src/lib/theme";

interface Feed {
  httpsUrl: string;
  webcalUrl: string;
  includeEvents: boolean;
  includeFencedHours: boolean;
  includeTaskDueDates: boolean;
  lastAccessedAt: Date | null;
  accessCount: number;
}

type FeedOptionKey =
  | "includeEvents"
  | "includeFencedHours"
  | "includeTaskDueDates";

const FEED_OPTIONS: { key: FeedOptionKey; label: string; detail: string }[] = [
  {
    key: "includeEvents",
    label: "Calendar events",
    detail: "Planned blocks and anything you added to the Fenced calendar",
  },
  {
    key: "includeFencedHours",
    label: "Fenced Hours",
    detail: "Your recurring blocking windows, as repeating events",
  },
  {
    key: "includeTaskDueDates",
    label: "Task due dates",
    detail: "All-day markers for open tasks; they will not mark you busy",
  },
];

/** Google Calendar's "add by URL" entry point. */
function googleSubscribeUrl(feedUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
}

export default function CalendarExportScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const api = useApi();
  const auth = useAuth();

  const [feed, setFeed] = useState<Feed | null>(null);
  const [feedAllowed, setFeedAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await api.calendar.feed.query();
      setFeed(result.feed as Feed | null);
      setFeedAllowed(result.feedAllowed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your feed");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!auth.isSignedIn) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [auth.isSignedIn, refresh]);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const enableFeed = () =>
    run("enable", async () => {
      setFeed((await api.calendar.enableFeed.mutate()) as Feed);
      setRevealed(true);
    });

  const toggleOption = (key: FeedOptionKey, value: boolean) =>
    run(`option:${key}`, async () => {
      setFeed((await api.calendar.setFeedOptions.mutate({ [key]: value })) as Feed);
    });

  const copyUrl = () =>
    run("copy", async () => {
      if (!feed) return;
      await Clipboard.setStringAsync(feed.httpsUrl);
      Alert.alert(
        "Link copied",
        "Paste it into Google Calendar, Outlook or Apple Calendar as a subscribed calendar. Treat it like a password — anyone with the link can read your calendar."
      );
    });

  const rotate = () => {
    Alert.alert(
      "Generate a new link?",
      "The current link stops working immediately. Any calendar already subscribed will need the new one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rotate",
          style: "destructive",
          onPress: () =>
            void run("rotate", async () => {
              setFeed((await api.calendar.rotateFeedToken.mutate()) as Feed);
              setRevealed(true);
            }),
        },
      ]
    );
  };

  const disable = () => {
    Alert.alert(
      "Turn off the feed?",
      "The link is deleted and every subscribed calendar stops updating.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn off",
          style: "destructive",
          onPress: () =>
            void run("disable", async () => {
              await api.calendar.disableFeed.mutate();
              setFeed(null);
              setRevealed(false);
            }),
        },
      ]
    );
  };

  const openIn = (url: string) =>
    run("open", async () => {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          "Nothing can open this link",
          "Copy the link instead and add it as a subscribed calendar manually."
        );
        return;
      }
      await Linking.openURL(url);
    });

  const shareIcsFile = () =>
    run("share", async () => {
      const { filename, content } = await api.calendar.exportIcs.query({});

      // Written to the cache directory: it is a throwaway snapshot, and the
      // share sheet needs a file URI rather than an in-memory string.
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(content);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          `The file was saved to ${file.uri}, but this device has no share sheet.`
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: "text/calendar",
        UTI: "com.apple.ical.ics",
        dialogTitle: "Export Fenced calendar",
      });
    });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Export calendar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="share-outline" size={32} color={t.accent} />
          </View>
          <Text style={styles.title}>Take Fenced with you</Text>
          <Text style={styles.subTitle}>
            Subscribe from any calendar app for a link that stays up to date, or
            export a one-off .ics file to import somewhere by hand.
          </Text>
        </View>

        {!auth.isSignedIn ? (
          <View style={styles.notice}>
            <Ionicons name="person-circle-outline" size={20} color={t.textMuted} />
            <Text style={styles.noticeText}>
              Sign in to publish a calendar feed — it is served from your account.
            </Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={t.accent} style={styles.loader} />
        ) : error ? (
          <View style={styles.notice}>
            <Ionicons name="alert-circle-outline" size={20} color={t.error} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Subscribable link</Text>

            {!feedAllowed ? (
              <View style={styles.notice}>
                <Ionicons name="shield-outline" size={20} color={t.accent} />
                <Text style={styles.noticeText}>
                  A shareable calendar link is not available on this account —
                  it would let anyone holding the link read your whole week. The
                  one-off .ics export below still works.
                </Text>
              </View>
            ) : !feed ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No feed yet. Turning it on creates a private link that Google,
                  Outlook and Apple Calendar can subscribe to.
                </Text>
                <Pressable
                  style={[styles.primaryBtn, busy !== null && styles.btnDisabled]}
                  disabled={busy !== null}
                  onPress={() => void enableFeed()}
                >
                  {busy === "enable" ? (
                    <ActivityIndicator color={t.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="link-outline" size={18} color={t.onPrimary} />
                      <Text style={styles.primaryBtnText}>Create feed link</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.urlCard}>
                  <View style={styles.urlHeader}>
                    <Ionicons name="lock-closed-outline" size={16} color={t.textMuted} />
                    <Text style={styles.urlLabel}>Private feed URL</Text>
                    <Pressable onPress={() => setRevealed((v) => !v)}>
                      <Text style={styles.revealText}>
                        {revealed ? "Hide" : "Reveal"}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.urlText} numberOfLines={revealed ? 4 : 1}>
                    {revealed
                      ? feed.httpsUrl
                      : feed.httpsUrl.replace(/\/[^/]+\.ics$/, "/••••••••.ics")}
                  </Text>
                  <Text style={styles.urlMeta}>
                    {feed.accessCount === 0
                      ? "Not fetched yet"
                      : `Fetched ${feed.accessCount} time(s)`}
                    {feed.lastAccessedAt
                      ? ` · last ${new Date(feed.lastAccessedAt).toLocaleDateString()}`
                      : ""}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={[styles.secondaryBtn, busy !== null && styles.btnDisabled]}
                    disabled={busy !== null}
                    onPress={() => void copyUrl()}
                  >
                    <Ionicons name="copy-outline" size={16} color={t.accent} />
                    <Text style={styles.secondaryBtnText}>Copy link</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryBtn, busy !== null && styles.btnDisabled]}
                    disabled={busy !== null}
                    onPress={() => void openIn(googleSubscribeUrl(feed.httpsUrl))}
                  >
                    <Ionicons name="logo-google" size={16} color={t.accent} />
                    <Text style={styles.secondaryBtnText}>Google</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryBtn, busy !== null && styles.btnDisabled]}
                    disabled={busy !== null}
                    onPress={() => void openIn(feed.webcalUrl)}
                  >
                    <Ionicons name="calendar-outline" size={16} color={t.accent} />
                    <Text style={styles.secondaryBtnText}>Apple / Outlook</Text>
                  </Pressable>
                </View>

                <Text style={styles.sectionTitle}>What the feed includes</Text>
                <View style={styles.list}>
                  {FEED_OPTIONS.map((option, i) => (
                    <View
                      key={option.key}
                      style={[styles.row, i < FEED_OPTIONS.length - 1 && styles.rowBorder]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{option.label}</Text>
                        <Text style={styles.rowSub}>{option.detail}</Text>
                      </View>
                      <Switch
                        value={feed[option.key]}
                        disabled={busy !== null}
                        onValueChange={(value) => void toggleOption(option.key, value)}
                        trackColor={{ false: t.border, true: t.primary }}
                        thumbColor={t.onPrimary}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={[styles.secondaryBtn, busy !== null && styles.btnDisabled]}
                    disabled={busy !== null}
                    onPress={rotate}
                  >
                    <Ionicons name="refresh-outline" size={16} color={t.accent} />
                    <Text style={styles.secondaryBtnText}>New link</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryBtn, busy !== null && styles.btnDisabled]}
                    disabled={busy !== null}
                    onPress={disable}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={t.error} />
                    <Text style={[styles.secondaryBtnText, { color: t.error }]}>
                      Turn off
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>One-off file</Text>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                An .ics snapshot of the next year. Good for a single import;
                it will not update afterwards.
              </Text>
              <Pressable
                style={[styles.primaryBtn, busy !== null && styles.btnDisabled]}
                disabled={busy !== null}
                onPress={() => void shareIcsFile()}
              >
                {busy === "share" ? (
                  <ActivityIndicator color={t.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color={t.onPrimary} />
                    <Text style={styles.primaryBtnText}>Export .ics file</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={styles.footnote}>
              The feed link is the only credential — anyone holding it can read
              the calendar it publishes. Rotate it if you ever share it by mistake.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: t.text, marginLeft: 12 },
    scroll: { padding: 20, paddingBottom: 40 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 20,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: t.accentSoft,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "700", color: t.text },
    subTitle: {
      fontSize: 13,
      color: t.textMuted,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 19,
    },
    loader: { marginVertical: 32 },
    notice: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    noticeText: { flex: 1, fontSize: 13, color: t.textMuted, lineHeight: 19 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 8,
      marginBottom: 8,
    },
    emptyCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      gap: 12,
    },
    emptyText: { fontSize: 13, color: t.textMuted, lineHeight: 19 },
    urlCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    urlHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    urlLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    revealText: { fontSize: 13, fontWeight: "600", color: t.accent },
    urlText: {
      fontSize: 12,
      color: t.text,
      marginTop: 10,
      backgroundColor: t.bg,
      borderRadius: 8,
      padding: 10,
    },
    urlMeta: { fontSize: 12, color: t.textMuted, marginTop: 8 },
    buttonRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: t.primary,
      borderRadius: 10,
      paddingVertical: 14,
    },
    primaryBtnText: { fontSize: 15, fontWeight: "600", color: t.onPrimary },
    secondaryBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: t.surface,
      borderRadius: 10,
      paddingVertical: 12,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: "600", color: t.accent },
    btnDisabled: { opacity: 0.5 },
    list: {
      backgroundColor: t.surface,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    rowTitle: { fontSize: 15, fontWeight: "600", color: t.text },
    rowSub: { fontSize: 12, color: t.textMuted, marginTop: 2, lineHeight: 17 },
    footnote: {
      fontSize: 12,
      color: t.textMuted,
      lineHeight: 18,
      marginTop: 8,
      textAlign: "center",
    },
  });
