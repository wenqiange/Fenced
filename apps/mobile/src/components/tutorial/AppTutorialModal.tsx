import React, { useState, useCallback } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii } from "@fenced/ui";
import Animated, { FadeIn, FadeInRight, FadeOutLeft, LinearTransition } from "react-native-reanimated";
import { AnimatedPressable, Button, FenceCard, Txt } from "../ui";
import { FenceAssemblyView } from "../fence/FenceAssemblyView";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../lib/theme";
import { markTutorialSeen } from "../../lib/local-store";
import {
  hapticLatchClose,
  hapticPicketDrop,
  hapticSelection,
  hapticTaskCheck,
} from "../../lib/haptics";

const TOTAL_STEPS = 4;
const DEMO_PICKETS = 6;

interface AppTutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AppTutorialModal({ visible, onClose }: AppTutorialModalProps) {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [currentStep, setCurrentStep] = useState(0);

  // Interactive demo states for slide 1 (fence pickets)
  const [demoPickets, setDemoPickets] = useState(2);

  // Interactive demo states for slide 2 (task checking)
  const [demoTaskDone, setDemoTaskDone] = useState(false);

  // Interactive demo states for slide 3 (emergency pass simulation)
  const [passActive, setPassActive] = useState(false);

  const handleFinish = useCallback(() => {
    markTutorialSeen(true);
    setCurrentStep(0);
    onClose();
  }, [onClose]);

  const handleNext = () => {
    hapticSelection();
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    hapticSelection();
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleAddPicket = () => {
    hapticPicketDrop();
    setDemoPickets((prev) => (prev >= DEMO_PICKETS ? 1 : prev + 1));
  };

  const toggleDemoTask = () => {
    hapticTaskCheck();
    setDemoTaskDone((prev) => !prev);
  };

  const toggleEmergencyPass = () => {
    void hapticLatchClose();
    setPassActive((prev) => !prev);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleFinish}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header: Progress indicators & Skip button */}
        <View style={styles.header}>
          <View style={styles.indicatorContainer}>
            {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.indicatorDot,
                  idx === currentStep ? styles.indicatorDotActive : null,
                  idx < currentStep ? styles.indicatorDotPassed : null,
                ]}
              />
            ))}
          </View>
          <AnimatedPressable
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel="Skip tutorial"
            style={styles.skipButton}
          >
            <Txt variant="caption" tone="muted" style={styles.skipText}>
              Skip
            </Txt>
            <Ionicons name="close" size={18} color={t.textMuted} />
          </AnimatedPressable>
        </View>

        {/* Slide Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 0 && (
            <Animated.View entering={FadeInRight.duration(240)} exiting={FadeOutLeft.duration(180)}>
              <View style={styles.badgeRow}>
                <View style={[styles.badgePill, { backgroundColor: t.accentTint }]}>
                  <Ionicons name="shield-checkmark" size={14} color={t.accent} />
                  <Txt variant="caption" tone="accent" style={styles.badgeText}>
                    STEP 1 OF 4 · THE SHIELD
                  </Txt>
                </View>
              </View>

              <Txt variant="title1" style={styles.stepTitle}>
                Focus without guilt or shame
              </Txt>
              <Txt variant="body" tone="muted" style={styles.stepSubtitle}>
                Fenced turns your phone into a distraction-free sanctuary. When you start focusing, distracting apps are shielded automatically.
              </Txt>

              {/* Interactive Fence Preview */}
              <FenceCard style={styles.interactiveCard}>
                <View style={styles.interactiveCardHeader}>
                  <View style={styles.rowAlign}>
                    <Ionicons name="hammer-outline" size={18} color={t.accent} />
                    <Txt variant="headline" style={styles.cardHeaderTitle}>
                      Interactive Fence Panel
                    </Txt>
                  </View>
                  <Txt variant="caption" tone="muted">
                    {demoPickets} of {DEMO_PICKETS} pickets
                  </Txt>
                </View>

                <View style={styles.fenceContainer}>
                  <FenceAssemblyView
                    progress={demoPickets / DEMO_PICKETS}
                    pickets={DEMO_PICKETS}
                    state={demoPickets >= DEMO_PICKETS ? "complete" : "building"}
                    aspect={0.38}
                  />
                </View>

                <AnimatedPressable
                  onPress={handleAddPicket}
                  style={styles.actionPill}
                  pressScale={0.96}
                >
                  <Ionicons
                    name={demoPickets >= DEMO_PICKETS ? "refresh" : "add-circle"}
                    size={18}
                    color={t.onPrimary}
                  />
                  <Txt variant="caption" style={{ color: t.onPrimary, fontWeight: "600" }}>
                    {demoPickets >= DEMO_PICKETS
                      ? "Reset demo panel"
                      : "Tap to place a picket (+5m focus)"}
                  </Txt>
                </AnimatedPressable>
              </FenceCard>

              {/* Core Philosophy Callouts */}
              <View style={styles.pointsList}>
                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="leaf-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      No dead trees, no penalties
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      If you need to stop early, whatever fence you built stays in your yard. We celebrate your progress rather than punishing interruptions.
                    </Txt>
                  </View>
                </View>

                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      100% on-device privacy
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Shielding uses local operating system controls. Fenced never monitors your messages, browser history, or private data.
                    </Txt>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {currentStep === 1 && (
            <Animated.View entering={FadeInRight.duration(240)} exiting={FadeOutLeft.duration(180)}>
              <View style={styles.badgeRow}>
                <View style={[styles.badgePill, { backgroundColor: t.accentTint }]}>
                  <Ionicons name="calendar-outline" size={14} color={t.accent} />
                  <Txt variant="caption" tone="accent" style={styles.badgeText}>
                    STEP 2 OF 4 · TASKS & TIME-BLOCKS
                  </Txt>
                </View>
              </View>

              <Txt variant="title1" style={styles.stepTitle}>
                From agenda to deep work
              </Txt>
              <Txt variant="body" tone="muted" style={styles.stepSubtitle}>
                No more endless, paralyzing to-do lists. Connect what you need to do directly with shielded time.
              </Txt>

              {/* Interactive Task Card */}
              <FenceCard style={styles.interactiveCard}>
                <View style={styles.interactiveCardHeader}>
                  <Txt variant="headline" style={styles.cardHeaderTitle}>
                    Try checking off a task
                  </Txt>
                  <Txt variant="caption" tone="accent">
                    Live Demo
                  </Txt>
                </View>

                <View style={styles.demoTaskRow}>
                  <AnimatedPressable
                    onPress={toggleDemoTask}
                    style={styles.taskCheckButton}
                    pressScale={0.88}
                  >
                    <Ionicons
                      name={demoTaskDone ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={demoTaskDone ? t.success : t.borderStrong}
                    />
                  </AnimatedPressable>

                  <View style={{ flex: 1 }}>
                    <Txt
                      variant="body"
                      style={[
                        styles.demoTaskTitle,
                        demoTaskDone && { textDecorationLine: "line-through", opacity: 0.6 },
                      ]}
                    >
                      Study Biology Chapter 4: Cell Division
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Estimated 45m · High priority
                    </Txt>
                  </View>

                  <View style={styles.playBadge}>
                    <Ionicons name="play" size={14} color={t.accent} />
                    <Txt variant="caption" tone="accent" style={{ fontWeight: "700" }}>
                      Focus
                    </Txt>
                  </View>
                </View>
              </FenceCard>

              {/* Feature Points */}
              <View style={styles.pointsList}>
                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="flash-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      The 3-Minute Wedge (Anti-Inertia)
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Can't find the motivation to start? Launch a 3-minute micro-session. Once the first picket drops, inertia breaks and focus kicks in.
                    </Txt>
                  </View>
                </View>

                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="sync-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      Google Calendar two-way sync
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Your classes, study dates, and personal events show right on the timeline, automatically converting into focus opportunities.
                    </Txt>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {currentStep === 2 && (
            <Animated.View entering={FadeInRight.duration(240)} exiting={FadeOutLeft.duration(180)}>
              <View style={styles.badgeRow}>
                <View style={[styles.badgePill, { backgroundColor: t.accentTint }]}>
                  <Ionicons name="key-outline" size={14} color={t.accent} />
                  <Txt variant="caption" tone="accent" style={styles.badgeText}>
                    STEP 3 OF 4 · TRUST & GUARDRAILS
                  </Txt>
                </View>
              </View>

              <Txt variant="title1" style={styles.stepTitle}>
                Human-first guardrails
              </Txt>
              <Txt variant="body" tone="muted" style={styles.stepSubtitle}>
                You are in control. Fenced provides mindful friction to stop impulse unlocks, but never traps you.
              </Txt>

              {/* Interactive Emergency Pass Card */}
              <FenceCard style={styles.interactiveCard}>
                <View style={styles.interactiveCardHeader}>
                  <View style={styles.rowAlign}>
                    <Ionicons name="ticket-outline" size={18} color={t.accent} />
                    <Txt variant="headline" style={styles.cardHeaderTitle}>
                      Emergency Pass System
                    </Txt>
                  </View>
                  <Txt
                    variant="caption"
                    style={{
                      color: passActive ? t.warning : t.accent,
                      fontWeight: "700",
                    }}
                  >
                    {passActive ? "Pass Active (3:00)" : "2/2 passes ready"}
                  </Txt>
                </View>

                <Txt variant="body" tone="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Need to check a two-factor authentication code or urgent family call? Tap to temporarily lower the shield for 3 minutes without failing the session.
                </Txt>

                <AnimatedPressable
                  onPress={toggleEmergencyPass}
                  style={[
                    styles.actionPill,
                    passActive && { backgroundColor: t.warning },
                  ]}
                  pressScale={0.96}
                >
                  <Ionicons
                    name={passActive ? "pause-circle" : "ticket"}
                    size={18}
                    color={passActive ? "#fff" : t.onPrimary}
                  />
                  <Txt
                    variant="caption"
                    style={{ color: passActive ? "#fff" : t.onPrimary, fontWeight: "600" }}
                  >
                    {passActive ? "Pass Active · Shield down for 3m" : "Test an Emergency Pass"}
                  </Txt>
                </AnimatedPressable>
              </FenceCard>

              {/* Feature Points */}
              <View style={styles.pointsList}>
                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="timer-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      Gate Latch (Strict Delay)
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      A calming 30-to-60 second countdown gives your prefrontal cortex time to intercept mindless impulse unlock attempts before they happen.
                    </Txt>
                  </View>
                </View>

                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="gift-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      Distraction Debt Ledger
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Every distraction attempt intercepted by the shield earns minutes of guilt-free leisure time you can spend freely from Insights.
                    </Txt>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {currentStep === 3 && (
            <Animated.View entering={FadeInRight.duration(240)} exiting={FadeOutLeft.duration(180)}>
              <View style={styles.badgeRow}>
                <View style={[styles.badgePill, { backgroundColor: t.accentTint }]}>
                  <Ionicons name="school-outline" size={14} color={t.accent} />
                  <Txt variant="caption" tone="accent" style={styles.badgeText}>
                    STEP 4 OF 4 · STUDENT SUPERPOWERS
                  </Txt>
                </View>
              </View>

              <Txt variant="title1" style={styles.stepTitle}>
                Built for school & real life
              </Txt>
              <Txt variant="body" tone="muted" style={styles.stepSubtitle}>
                Automation and mutual commitments built specifically for high school, university, and family harmony.
              </Txt>

              {/* Class Mode preview card */}
              <FenceCard style={styles.interactiveCard}>
                <View style={styles.interactiveCardHeader}>
                  <View style={styles.rowAlign}>
                    <Ionicons name="school" size={18} color={t.accent} />
                    <Txt variant="headline" style={styles.cardHeaderTitle}>
                      Class Mode (School Timetable)
                    </Txt>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: t.surfaceAlt }]}>
                    <Txt variant="caption" style={{ color: t.success, fontWeight: "700" }}>
                      Auto-Arm
                    </Txt>
                  </View>
                </View>

                <View style={styles.scheduleRow}>
                  <View style={styles.schedulePeriod}>
                    <Txt variant="caption" style={{ fontWeight: "700" }}>
                      08:30 – 10:00
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Mathematics
                    </Txt>
                  </View>
                  <View style={[styles.shieldIndicator, { backgroundColor: t.accentTint }]}>
                    <Ionicons name="shield-checkmark" size={14} color={t.accent} />
                    <Txt variant="caption" tone="accent" style={{ fontWeight: "600" }}>
                      Shield Raised
                    </Txt>
                  </View>
                </View>

                <View style={[styles.scheduleRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.schedulePeriod}>
                    <Txt variant="caption" style={{ fontWeight: "700" }}>
                      10:00 – 10:30
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Morning Break
                    </Txt>
                  </View>
                  <View style={[styles.shieldIndicator, { backgroundColor: t.surfaceAlt }]}>
                    <Ionicons name="cafe-outline" size={14} color={t.textMuted} />
                    <Txt variant="caption" tone="muted" style={{ fontWeight: "600" }}>
                      Shield Dropped
                    </Txt>
                  </View>
                </View>
              </FenceCard>

              {/* Feature Points */}
              <View style={styles.pointsList}>
                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="people-circle-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      Family Pact (Symmetric Trust)
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      A mutual focus agreement between student and parents. Guardians celebrate completed focus blocks, but NEVER see app activity or private task titles.
                    </Txt>
                  </View>
                </View>

                <View style={styles.pointItem}>
                  <View style={[styles.pointIconCircle, { backgroundColor: t.accentSoft }]}>
                    <Ionicons name="ribbon-outline" size={20} color={t.accent} />
                  </View>
                  <View style={styles.pointTextContainer}>
                    <Txt variant="body" style={styles.pointTitle}>
                      Verified Focus Certificate
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      Export cryptographic proof of your deep work hours, yard tiers, and focus discipline directly from your device for college applications or resumes.
                    </Txt>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom Navigation Buttons */}
        <View style={styles.footer}>
          {currentStep > 0 ? (
            <AnimatedPressable
              onPress={handleBack}
              style={styles.backButton}
              pressScale={0.96}
            >
              <Ionicons name="arrow-back" size={18} color={t.text} />
              <Txt variant="body" style={{ fontWeight: "600" }}>
                Back
              </Txt>
            </AnimatedPressable>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <Button
            label={currentStep === TOTAL_STEPS - 1 ? "Start Focusing" : "Continue"}
            kind="primary"
            icon={currentStep === TOTAL_STEPS - 1 ? "rocket-outline" : "arrow-forward"}
            onPress={handleNext}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: t.borderSubtle,
    },
    indicatorContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    indicatorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.borderStrong,
    },
    indicatorDotActive: {
      width: 24,
      backgroundColor: t.accent,
    },
    indicatorDotPassed: {
      backgroundColor: t.accentSoft,
    },
    skipButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    skipText: {
      fontWeight: "600",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 22,
      paddingTop: 16,
      paddingBottom: 40,
    },
    badgeRow: {
      flexDirection: "row",
      marginBottom: 10,
    },
    badgePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.pill,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    stepTitle: {
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.5,
      marginBottom: 8,
      color: t.text,
    },
    stepSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 20,
    },
    interactiveCard: {
      padding: 16,
      borderRadius: radii.lg,
      marginBottom: 20,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.borderSubtle,
    },
    interactiveCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    rowAlign: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    cardHeaderTitle: {
      fontWeight: "700",
    },
    fenceContainer: {
      marginVertical: 10,
      paddingHorizontal: 8,
    },
    actionPill: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: t.primary,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    pointsList: {
      gap: 16,
    },
    pointItem: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-start",
    },
    pointIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    pointTextContainer: {
      flex: 1,
    },
    pointTitle: {
      fontWeight: "700",
      marginBottom: 3,
      color: t.text,
    },
    demoTaskRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    taskCheckButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    demoTaskTitle: {
      fontWeight: "600",
      fontSize: 15,
      marginBottom: 2,
    },
    playBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: t.accentTint,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
    },
    scheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: t.borderSubtle,
    },
    schedulePeriod: {
      gap: 2,
    },
    shieldIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderColor: t.borderSubtle,
      backgroundColor: t.surface,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    nextButton: {
      minWidth: 150,
    },
  });
