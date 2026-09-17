import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import type { GraphEdge, GraphNode } from '@/types/knowledge';

type RecallQuizProps = {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  masteredEdgeIds: readonly string[];
  onAnswer: (edgeId: string, mastered: boolean) => void;
};

export function RecallQuiz({
  nodes,
  edges,
  masteredEdgeIds,
  onAnswer,
}: RecallQuizProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  if (edges.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No recall cards yet</Text>
        <Text style={styles.emptyText}>
          This idea needs at least one concept connection to build a quiz.
        </Text>
      </View>
    );
  }

  const edge = edges[Math.min(activeIndex, edges.length - 1)];
  const source = nodeById.get(edge.source)?.label ?? edge.source;
  const target = nodeById.get(edge.target)?.label ?? edge.target;
  const masteredCount = edges.filter((candidate) =>
    masteredEdgeIds.includes(candidate.id),
  ).length;

  const advance = (mastered: boolean) => {
    onAnswer(edge.id, mastered);
    if (activeIndex === edges.length - 1) {
      setRoundComplete(true);
      return;
    }
    setActiveIndex((current) => current + 1);
    setIsRevealed(false);
  };

  const restart = () => {
    setActiveIndex(0);
    setIsRevealed(false);
    setRoundComplete(false);
  };

  if (roundComplete) {
    return (
      <View style={styles.completeCard}>
        <View style={styles.completeOrb}>
          <Text style={styles.completeOrbText}>✓</Text>
        </View>
        <Text style={styles.completeKicker}>RECALL ROUND COMPLETE</Text>
        <Text style={styles.completeTitle}>
          {masteredCount === edges.length ? 'You know this map.' : 'Your memory is warming up.'}
        </Text>
        <Text style={styles.completeBody}>
          {masteredCount} of {edges.length} connections are currently marked as mastered.
          Repeat the round to strengthen the rest.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={restart}
          style={({ pressed }) => [styles.restartButton, pressed && styles.pressed]}
        >
          <Text style={styles.restartButtonText}>Practice again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.quizMeta}>
        <Text style={styles.quizCount}>CARD {activeIndex + 1} OF {edges.length}</Text>
        <Text style={styles.masteryCount}>{masteredCount} mastered</Text>
      </View>

      <Pressable
        accessibilityHint="Reveals the relationship between the two concepts"
        accessibilityRole="button"
        onPress={() => setIsRevealed(true)}
        style={({ pressed }) => [styles.card, pressed && !isRevealed && styles.pressed]}
      >
        <Text style={styles.cardKicker}>{isRevealed ? 'CONNECTION' : 'ACTIVE RECALL'}</Text>
        {isRevealed ? (
          <>
            <Text style={styles.answerLead}>{source}</Text>
            <View style={styles.relationshipRow}>
              <View style={styles.relationshipLine} />
              <Text style={styles.relationshipLabel}>{edge.label || 'connects to'}</Text>
              <View style={styles.relationshipLine} />
            </View>
            <Text style={styles.answerLead}>{target}</Text>
            <Text style={styles.answerHint}>
              Say this relationship aloud in your own words before choosing an answer.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.question}>How does this idea connect?</Text>
            <View style={styles.conceptPair}>
              <View style={styles.conceptPill}>
                <Text style={styles.conceptPillText}>{source}</Text>
              </View>
              <Text style={styles.questionMark}>?</Text>
              <View style={styles.conceptPill}>
                <Text style={styles.conceptPillText}>{target}</Text>
              </View>
            </View>
            <Text style={styles.tapHint}>Tap the card when you have an answer</Text>
          </>
        )}
      </Pressable>

      {isRevealed ? (
        <View style={styles.answerActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => advance(false)}
            style={({ pressed }) => [styles.reviewButton, pressed && styles.pressed]}
          >
            <Text style={styles.reviewButtonText}>Study again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => advance(true)}
            style={({ pressed }) => [styles.knowButton, pressed && styles.pressed]}
          >
            <Text style={styles.knowButtonText}>I knew it</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quizMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  quizCount: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  masteryCount: { color: colors.accentStrong, fontSize: 11, fontWeight: '700' },
  card: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#3A3450',
    backgroundColor: '#171421',
  },
  cardKicker: { color: colors.accentPurple, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  question: { color: colors.text, fontSize: 26, lineHeight: 33, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  conceptPair: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  conceptPill: { width: '100%', padding: spacing.md, borderRadius: 16, backgroundColor: '#211D30', borderWidth: 1, borderColor: '#3B3354' },
  conceptPillText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  questionMark: { color: colors.accentPurple, fontSize: 26, fontWeight: '900' },
  tapHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg },
  answerLead: { color: colors.text, fontSize: 24, lineHeight: 31, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  relationshipRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  relationshipLine: { flex: 1, height: 1, backgroundColor: '#4D416C' },
  relationshipLabel: { color: colors.accentPurple, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  answerHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.lg },
  answerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  reviewButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reviewButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  knowButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.accentPurple },
  knowButtonText: { color: '#21172F', fontSize: 14, fontWeight: '800' },
  completeCard: { alignItems: 'center', padding: spacing.xl, borderRadius: 26, borderWidth: 1, borderColor: '#286B56', backgroundColor: '#0F211D' },
  completeOrb: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.accentStrong },
  completeOrbText: { color: colors.accentInk, fontSize: 27, fontWeight: '900' },
  completeKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginTop: spacing.md },
  completeTitle: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  completeBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.sm },
  restartButton: { minHeight: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.accentStrong, marginTop: spacing.lg },
  restartButtonText: { color: colors.accentInk, fontSize: 15, fontWeight: '800' },
  emptyCard: { padding: spacing.lg, borderRadius: 20, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
