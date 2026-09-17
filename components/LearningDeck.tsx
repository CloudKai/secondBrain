import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import type { GraphNode } from '@/types/knowledge';

type LearningDeckProps = {
  points: readonly string[];
  nodes: readonly GraphNode[];
  completedSteps: readonly number[];
  onToggleStep: (step: number) => void;
  onExploreMap: (nodeId: string | null) => void;
};

export function LearningDeck({
  points,
  nodes,
  completedSteps,
  onToggleStep,
  onExploreMap,
}: LearningDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (points.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No lesson points were returned.</Text>
      </View>
    );
  }

  const visibleIndex = Math.min(activeIndex, points.length - 1);
  const point = points[visibleIndex];
  const concept = nodes[visibleIndex % Math.max(nodes.length, 1)];
  const isComplete = completedSteps.includes(visibleIndex);
  const completedCount = completedSteps.filter((step) => step < points.length).length;

  return (
    <View>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>
          {completedCount === points.length
            ? 'Lesson complete'
            : `${completedCount} of ${points.length} understood`}
        </Text>
        <Text style={styles.progressPercent}>
          {Math.round((completedCount / points.length) * 100)}%
        </Text>
      </View>

      <View style={styles.progressTrack}>
        {points.map((_, index) => (
          <Pressable
            accessibilityLabel={`Open idea ${index + 1}`}
            accessibilityRole="button"
            key={`progress-${index}`}
            onPress={() => setActiveIndex(index)}
            style={[
              styles.progressSegment,
              index === visibleIndex && styles.progressSegmentActive,
              completedSteps.includes(index) && styles.progressSegmentComplete,
            ]}
          />
        ))}
      </View>

      <View style={[styles.ideaCard, isComplete && styles.ideaCardComplete]}>
        <View style={styles.ideaHeader}>
          <View style={styles.ideaNumber}>
            <Text style={styles.ideaNumberText}>{visibleIndex + 1}</Text>
          </View>
          <Text style={styles.ideaKicker}>KEY IDEA</Text>
          {isComplete ? (
            <View style={styles.completeBadge}>
              <Text style={styles.completeBadgeText}>UNDERSTOOD</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.ideaText}>{point}</Text>

        {concept ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onExploreMap(concept.id)}
            style={({ pressed }) => [
              styles.conceptLink,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.conceptDot} />
            <View style={styles.conceptCopy}>
              <Text style={styles.conceptLabel}>EXPLORE THIS CONCEPT</Text>
              <Text style={styles.conceptName}>{concept.label}</Text>
            </View>
            <Text style={styles.conceptArrow}>→</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isComplete }}
          onPress={() => onToggleStep(visibleIndex)}
          style={({ pressed }) => [
            styles.understoodButton,
            isComplete && styles.understoodButtonComplete,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.understoodButtonText,
              isComplete && styles.understoodButtonTextComplete,
            ]}
          >
            {isComplete ? '✓  Understood' : 'Mark as understood'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.navigationRow}>
        <Pressable
          accessibilityLabel="Previous idea"
          accessibilityRole="button"
          disabled={visibleIndex === 0}
          onPress={() => setActiveIndex((current) => Math.max(0, current - 1))}
          style={({ pressed }) => [
            styles.navButton,
            visibleIndex === 0 && styles.navButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.navButtonText}>← Previous</Text>
        </Pressable>
        <Text style={styles.pageCount}>
          {visibleIndex + 1} / {points.length}
        </Text>
        <Pressable
          accessibilityLabel="Next idea"
          accessibilityRole="button"
          disabled={visibleIndex === points.length - 1}
          onPress={() =>
            setActiveIndex((current) => Math.min(points.length - 1, current + 1))
          }
          style={({ pressed }) => [
            styles.navButton,
            visibleIndex === points.length - 1 && styles.navButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.navButtonText}>Next →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  progressPercent: { color: colors.accentStrong, fontSize: 12, fontWeight: '800' },
  progressTrack: { flexDirection: 'row', gap: 7, marginBottom: spacing.md },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  progressSegmentActive: { backgroundColor: '#3F4A5F' },
  progressSegmentComplete: { backgroundColor: colors.accentStrong },
  ideaCard: {
    padding: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ideaCardComplete: { borderColor: '#286B56', backgroundColor: '#0F211D' },
  ideaHeader: { flexDirection: 'row', alignItems: 'center' },
  ideaNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.accentStrong,
  },
  ideaNumberText: { color: colors.accentInk, fontSize: 14, fontWeight: '900' },
  ideaKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginLeft: spacing.sm,
  },
  completeBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#173B30',
  },
  completeBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  ideaText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '600',
    letterSpacing: -0.35,
    marginTop: spacing.lg,
  },
  conceptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: 13,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
  },
  conceptDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentPurple },
  conceptCopy: { flex: 1, marginLeft: 11 },
  conceptLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  conceptName: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 3 },
  conceptArrow: { color: colors.accentPurple, fontSize: 20 },
  understoodButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.accentStrong,
  },
  understoodButtonComplete: {
    borderWidth: 1,
    borderColor: '#286B56',
    backgroundColor: 'transparent',
  },
  understoodButtonText: { color: colors.accentInk, fontSize: 15, fontWeight: '800' },
  understoodButtonTextComplete: { color: colors.accent },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  navButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  navButtonDisabled: { opacity: 0.28 },
  navButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pageCount: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  emptyCard: { padding: spacing.lg, borderRadius: 18, backgroundColor: colors.surface },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
