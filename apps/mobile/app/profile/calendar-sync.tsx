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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useApi } from "../../src/lib/api";
import { pullCalendarEvents } from "../../src/lib/sync/calendar";
import { useAuth } from "../../src/lib/auth";
import {
  useThemeColors,
  useThemedStyles,
  type ThemeColors,
} from "../../src/lib/theme";

/**
 * Must match the API's `APP_OAUTH_RETURN_URL`: the OAuth callback redirects
 * here, and seeing it is what makes `openAuthSessionAsync` close the browser.
 */
const OAUTH_RETURN_URL = "fenced://calendar-connected";

type SyncDirection = "pull" | "push" | "both";

interface Connection {
  id: string;
  provider: string;
  accountEmail: string | null;
  externalCalendarId: string;
  externalCalendarName: string | null;
  syncDirection: SyncDirection;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

interface Status {
  googleConfigured: boolean;
  allowedForAgeBand: boolean;
  connections: Connection[];
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

const DIRECTIONS: { id: SyncDirection; label: string; detail: string }[] = [
  {
    id: "both",
    label: "Two-way",
    detail: "Google events appear in Fenced, and Fenced blocks appear in Google",
  },
  {
    id: "pull",
    label: "Import only",
    detail: "Read Google events into Fenced; never write back",
  },
  {
    id: "push",
    label: "Export only",
    detail: "Send Fenced blocks to Google; ignore Google's own events",
  },
];

function formatSyncTime(value: Date | null): string {
  if (!value) return "Never synced";
  return `Last synced ${value.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function CalendarSyncScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const api = useApi();
  const auth = useAuth();

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[] | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const canConnect = Boolean(
    status?.googleConfigured && status?.allowedForAgeBand
  );

  const refresh = useCallback(async () => {
    try {
      const next = (await api.calendarSync.status.query()) as Status;
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load connections");
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

  const connectGoogle = async () => {
    setBusy("connect");
    try {
      const { url } = await api.calendarSync.googleAuthUrl.mutate();
      const result = await WebBrowser.openAuthSessionAsync(url, OAUTH_RETURN_URL);

      if (result.type === "success") {
        const params = Linking.parse(result.url).queryParams ?? {};
        const outcome = String(params.status ?? "");
        if (outcome === "ok") {
          // Pull straight away so the screen shows real events, not an empty
          // "connected" state the user has to poke at.
          await api.calendarSync.syncNow.mutate({});
          await pullCalendarEvents(api);
        } else if (outcome === "denied") {
          Alert.alert("Not connected", "You cancelled the Google sign-in.");
        } else {
          Alert.alert(
            "Could not connect",
            String(params.message ?? "Google rejected the authorization.")
          );
        }
      }
      await refresh();
    } catch (err) {
      Alert.alert(
        "Could not connect",
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async (connectionId: string) => {
    setBusy(`sync:${connectionId}`);
    try {
      const { results } = await api.calendarSync.syncNow.mutate({ connectionId });
      // The provider sync landed on the server; mirror it into the local store
      // so the Calendar tab reflects it straight away.
      await pullCalendarEvents(api);
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        Alert.alert("Sync finished with errors", failed.error);
      } else {
        const total = results.reduce(
          (sum, r) => sum + r.pulled + r.pushed + r.deletedLocally + r.deletedRemotely,
          0
        );
        Alert.alert(
          "Sync complete",
          total === 0 ? "Everything was already up to date." : `${total} change(s) applied.`
        );
      }
      await refresh();
    } catch (err) {
      Alert.alert("Sync failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const setEnabled = async (connectionId: string, syncEnabled: boolean) => {
    setBusy(`toggle:${connectionId}`);
    try {
      await api.calendarSync.setPreferences.mutate({ connectionId, syncEnabled });
      await refresh();
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const setDirection = async (connectionId: string, syncDirection: SyncDirection) => {
    setBusy(`direction:${connectionId}`);
    try {
      await api.calendarSync.setPreferences.mutate({ connectionId, syncDirection });
      await refresh();
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const openCalendarPicker = async (connectionId: string) => {
    setBusy(`calendars:${connectionId}`);
    try {
      const list = (await api.calendarSync.googleCalendars.query({
        connectionId,
      })) as GoogleCalendar[];
      setCalendars(list);
      setPickerFor(connectionId);
    } catch (err) {
      Alert.alert(
        "Could not list calendars",
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setBusy(null);
    }
  };

  const chooseCalendar = async (connectionId: string, calendar: GoogleCalendar) => {
    setBusy(`select:${connectionId}`);
    try {
      await api.calendarSync.selectCalendar.mutate({
        connectionId,
        externalCalendarId: calendar.id,
        externalCalendarName: calendar.summary,
      });
      setPickerFor(null);
      setCalendars(null);
      await refresh();
    } catch (err) {
      Alert.alert("Could not switch calendar", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = (connection: Connection) => {
    Alert.alert(
      "Disconnect Google Calendar?",
      "Events imported from Google will be removed from Fenced. Your own Fenced blocks stay, but they will no longer sync.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(`disconnect:${connection.id}`);
              try {
                await api.calendarSync.disconnect.mutate({
                  connectionId: connection.id,
                });
                await refresh();
              } catch (err) {
                Alert.alert(
                  "Could not disconnect",
                  err instanceof Error ? err.message : "Unknown error"
                );
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Calendar sync</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="sync" size={32} color={t.accent} />
          </View>
          <Text style={styles.title}>Connect Google Calendar</Text>
          <Text style={styles.subTitle}>
            Import your existing events so Fenced can plan around them, and push
            your planned blocks back so the rest of your week sees them too.
          </Text>
        </View>

        {!auth.isSignedIn ? (
          <View style={styles.notice}>
            <Ionicons name="person-circle-outline" size={20} color={t.textMuted} />
            <Text style={styles.noticeText}>
              Sign in to link a calendar — connections are stored on your account,
              not on this device.
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
            {status && !status.allowedForAgeBand && (
              <View style={styles.notice}>
                <Ionicons name="shield-outline" size={20} color={t.accent} />
                <Text style={styles.noticeText}>
                  Linking an outside calendar is not available on this account.
                  Fenced keeps younger accounts' schedules on Fenced only. You
                  can still export an .ics file from Export calendar.
                </Text>
              </View>
            )}

            {status?.allowedForAgeBand && !status.googleConfigured && (
              <View style={styles.notice}>
                <Ionicons name="construct-outline" size={20} color={t.warning} />
                <Text style={styles.noticeText}>
                  Google Calendar is not configured on this server yet. Ask an
                  admin to set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET
                  and CALENDAR_TOKEN_KEY.
                </Text>
              </View>
            )}

            {status?.connections.map((connection) => (
              <View key={connection.id} style={styles.connectionCard}>
                <View style={styles.connectionHeader}>
                  <Ionicons name="logo-google" size={20} color={t.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.connectionTitle}>
                      {connection.accountEmail ?? "Google Calendar"}
                    </Text>
                    <Text style={styles.connectionMeta}>
                      {connection.externalCalendarName ??
                        (connection.externalCalendarId === "primary"
                          ? "Primary calendar"
                          : connection.externalCalendarId)}
                      {" · "}
                      {formatSyncTime(connection.lastSyncAt)}
                    </Text>
                  </View>
                  <Switch
                    value={connection.syncEnabled}
                    onValueChange={(next) => void setEnabled(connection.id, next)}
                    disabled={busy !== null}
                    trackColor={{ false: t.border, true: t.primary }}
                    thumbColor={t.onPrimary}
                  />
                </View>

                {connection.lastSyncError && (
                  <View style={styles.errorRow}>
                    <Ionicons name="warning-outline" size={16} color={t.error} />
                    <Text style={styles.errorText}>{connection.lastSyncError}</Text>
                  </View>
                )}

                <Text style={styles.groupLabel}>Direction</Text>
                <View style={styles.segmented}>
                  {DIRECTIONS.map((direction) => {
                    const active = connection.syncDirection === direction.id;
                    return (
                      <Pressable
                        key={direction.id}
                        style={[styles.segment, active && styles.segmentActive]}
                        disabled={busy !== null}
                        onPress={() => void setDirection(connection.id, direction.id)}
                      >
                        <Text
                          style={[styles.segmentText, active && styles.segmentTextActive]}
                        >
                          {direction.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.groupHint}>
                  {DIRECTIONS.find((d) => d.id === connection.syncDirection)?.detail}
                </Text>

                {pickerFor === connection.id && calendars && (
                  <View style={styles.pickerList}>
                    {calendars.map((calendar) => (
                      <Pressable
                        key={calendar.id}
                        style={styles.pickerRow}
                        disabled={busy !== null}
                        onPress={() => void chooseCalendar(connection.id, calendar)}
                      >
                        <Ionicons
                          name={
                            calendar.id === connection.externalCalendarId
                              ? "radio-button-on"
                              : "radio-button-off"
                          }
                          size={18}
                          color={t.accent}
                        />
                        <Text style={styles.pickerText} numberOfLines={1}>
                          {calendar.summary}
                          {calendar.primary ? " (primary)" : ""}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.action, styles.actionPrimary]}
                    disabled={busy !== null || !connection.syncEnabled}
                    onPress={() => void syncNow(connection.id)}
                  >
                    {busy === `sync:${connection.id}` ? (
                      <ActivityIndicator color={t.onPrimary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="sync-outline" size={16} color={t.onPrimary} />
                        <Text style={styles.actionPrimaryText}>Sync now</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.action}
                    disabled={busy !== null}
                    onPress={() =>
                      pickerFor === connection.id
                        ? setPickerFor(null)
                        : void openCalendarPicker(connection.id)
                    }
                  >
                    <Ionicons name="list-outline" size={16} color={t.accent} />
                    <Text style={styles.actionText}>
                      {pickerFor === connection.id ? "Close" : "Calendar"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.action}
                    disabled={busy !== null}
                    onPress={() => disconnect(connection)}
                  >
                    <Ionicons name="unlink-outline" size={16} color={t.error} />
                    <Text style={[styles.actionText, { color: t.error }]}>
                      Disconnect
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              style={[
                styles.connectBtn,
                (!canConnect || busy !== null) && styles.connectBtnDisabled,
              ]}
              disabled={!canConnect || busy !== null}
              onPress={() => void connectGoogle()}
            >
              {busy === "connect" ? (
                <ActivityIndicator color={t.onPrimary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={t.onPrimary} />
                  <Text style={styles.connectText}>
                    {status?.connections.length
                      ? "Connect another account"
                      : "Connect Google Calendar"}
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={styles.footnote}>
              Fenced asks only for calendar access. Tokens are encrypted on the
              server and you can revoke them here or from your Google account at
              any time.
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
    connectionCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    connectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    connectionTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    connectionMeta: { fontSize: 12, color: t.textMuted, marginTop: 2 },
    errorRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      backgroundColor: t.errorSoft,
      borderRadius: 8,
      padding: 10,
      marginTop: 12,
    },
    errorText: { flex: 1, fontSize: 12, color: t.error, lineHeight: 17 },
    groupLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 8,
    },
    segmented: {
      flexDirection: "row",
      backgroundColor: t.track,
      borderRadius: 10,
      padding: 3,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    segmentActive: { backgroundColor: t.surface },
    segmentText: { fontSize: 13, fontWeight: "500", color: t.textMuted },
    segmentTextActive: { color: t.text },
    groupHint: { fontSize: 12, color: t.textMuted, marginTop: 8, lineHeight: 17 },
    pickerList: {
      marginTop: 12,
      borderRadius: 10,
      backgroundColor: t.bg,
      overflow: "hidden",
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    pickerText: { flex: 1, fontSize: 14, color: t.text },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    action: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: t.bg,
    },
    actionText: { fontSize: 13, fontWeight: "600", color: t.accent },
    actionPrimary: { backgroundColor: t.primary },
    actionPrimaryText: { fontSize: 13, fontWeight: "600", color: t.onPrimary },
    connectBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: t.primary,
      borderRadius: 12,
      paddingVertical: 16,
    },
    connectBtnDisabled: { opacity: 0.5 },
    connectText: { fontSize: 16, fontWeight: "600", color: t.onPrimary },
    footnote: {
      fontSize: 12,
      color: t.textMuted,
      lineHeight: 18,
      marginTop: 16,
      textAlign: "center",
    },
  });
