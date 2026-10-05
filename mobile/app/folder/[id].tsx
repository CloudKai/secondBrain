import { useLocalSearchParams } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AdaptiveDiagramViewer,
  type GraphDirection,
} from '@/components/AdaptiveDiagramViewer';
import { LearningDeck } from '@/components/LearningDeck';
import { RecallQuiz } from '@/components/RecallQuiz';
import { demoKnowledgeItem } from '@/constants/demoKnowledge';
import { colors, spacing } from '@/constants/theme';
import { useKnowledge } from '@/state/KnowledgeContext';
import {
  folders,
  type DiagramType,
  type FolderId,
} from '@/types/knowledge';

type LearningMode = 'learn' | 'visual' | 'recall' | 'source';

const modes: readonly { id: LearningMode; label: string; icon: SFSymbol }[] = [
  { id: 'learn', label: 'Learn', icon: 'sparkles' },
  { id: 'visual', label: 'Visual', icon: 'point.3.connected.trianglepath.dotted' },
  { id: 'recall', label: 'Recall', icon: 'questionmark.circle' },
  { id: 'source', label: 'Source', icon: 'arrow.up.right' },
];

const diagramLabels: Record<DiagramType, string> = {
  flow: 'Flow',
  hierarchy: 'Hierarchy',
  network: 'Network',
};

function isFolderId(value: string): value is FolderId {
  return folders.some((folder) => folder.id === value);
}

function lessonPoints(summary: string): string[] {
  return summary
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

export default function FolderDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    item?: string | string[];
  }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const routeItemId = Array.isArray(params.item) ? params.item[0] : params.item;
  const folderId = routeId && isFolderId(routeId) ? routeId : null;
  const folder = folders.find((candidate) => candidate.id === folderId);
  const {
    addItem,
    getItemsForFolder,
    getProgress,
    markEdgeMastery,
    toggleLessonStep,
  } = useKnowledge();
  const folderItems = useMemo(
    () => (folderId ? getItemsForFolder(folderId) : []),
    [folderId, getItemsForFolder],
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mode, setMode] = useState<LearningMode>('learn');
  const [direction, setDirection] = useState<GraphDirection>('TB');
  const [diagramSelection, setDiagramSelection] = useState<{
    itemId: string;
    type: DiagramType;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showOriginalText, setShowOriginalText] = useState(false);

  const item =
    folderItems.find(
      (candidate) => candidate.id === (selectedItemId ?? routeItemId),
    ) ??
    folderItems[0];
  const activeDiagram =
    diagramSelection?.itemId === item?.id ? diagramSelection.type : null;
  const resolvedDiagram =
    activeDiagram && item?.diagram_options.includes(activeDiagram)
      ? activeDiagram
      : (item?.diagram_type ?? 'network');
  const points = useMemo(
    () => (item ? lessonPoints(item.simplified_summary) : []),
    [item],
  );
  const progress = item ? getProgress(item.id) : null;
  const selectedNode = item?.nodes.find((node) => node.id === selectedNodeId);
  const selectedConnections = useMemo(() => {
    if (!item || !selectedNodeId) return [];
    const nodeById = new Map(item.nodes.map((node) => [node.id, node]));
    return item.edges
      .filter(
        (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId,
      )
      .map((edge) => {
        const outward = edge.source === selectedNodeId;
        const otherId = outward ? edge.target : edge.source;
        return {
          id: edge.id,
          direction: outward ? 'leads to' : 'comes from',
          relationship: edge.label || 'connects',
          other: nodeById.get(otherId)?.label ?? otherId,
        };
      });
  }, [item, selectedNodeId]);

  if (!folder) {
    return (
      <View style={styles.centered}>
        <SymbolView
          accessible={false}
          name="questionmark.circle"
          size={38}
          tintColor={colors.accentStrong}
          weight="bold"
        />
        <Text style={styles.emptyTitle}>Folder not found</Text>
      </View>
    );
  }

  if (!item || !progress) {
    return (
      <View style={styles.emptyScreen}>
        <View style={styles.emptyOrb}>
          <View style={styles.emptyOrbCore} />
        </View>
        <Text style={styles.folderKicker}>{folder.name.toUpperCase()}</Text>
        <Text style={styles.emptyTitle}>Your next idea starts here.</Text>
        <Text style={styles.emptyBody}>
          Share an article into this folder and Second Brain will turn it into a
          lesson, adaptive diagram, and recall round.
        </Text>
        <View style={styles.emptySteps}>
          {['Share an article', 'Choose this folder', 'Learn it actively'].map(
            (step, index) => (
              <View key={step} style={styles.emptyStep}>
                <View style={styles.emptyStepNumber}>
                  <Text style={styles.emptyStepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.emptyStepText}>{step}</Text>
              </View>
            ),
          )}
        </View>
        {folder.id === 'ai-engineering' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => addItem(demoKnowledgeItem)}
            style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
          >
            <Text style={styles.demoButtonText}>Explore a demo lesson</Text>
            <SymbolView
              accessible={false}
              name="arrow.right"
              size={20}
              tintColor={colors.accentInk}
              weight="bold"
            />
          </Pressable>
        ) : null}
      </View>
    );
  }

  const totalSignals = points.length + item.edges.length;
  const completedSignals =
    progress.completed_lesson_steps.filter((step) => step < points.length).length +
    progress.mastered_edge_ids.filter((edgeId) =>
      item.edges.some((edge) => edge.id === edgeId),
    ).length;
  const mastery = totalSignals
    ? Math.round((completedSignals / totalSignals) * 100)
    : 0;
  const masteryWidth: `${number}%` = `${mastery}%`;

  const exploreNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setMode('visual');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topMeta}>
        <Text style={styles.folderKicker}>{folder.name.toUpperCase()}</Text>
        {item.is_demo ? (
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>DEMO</Text>
          </View>
        ) : null}
      </View>

      {folderItems.length > 1 ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.itemSwitcher}
          showsHorizontalScrollIndicator={false}
        >
          {folderItems.map((candidate) => {
            const isSelected = candidate.id === item.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={candidate.id}
                onPress={() => {
                  setSelectedItemId(candidate.id);
                  setMode('learn');
                  setDiagramSelection(null);
                  setSelectedNodeId(null);
                }}
                style={[
                  styles.itemChip,
                  isSelected && styles.itemChipSelected,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.itemChipText,
                    isSelected && styles.itemChipTextSelected,
                  ]}
                >
                  {candidate.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.masteryRow}>
        <View style={styles.masteryCopy}>
          <Text style={styles.masteryLabel}>SESSION MASTERY</Text>
          <Text style={styles.masteryHint}>
            Learn the ideas, then test the connections.
          </Text>
        </View>
        <View style={styles.masteryRing}>
          <Text style={styles.masteryValue}>{mastery}%</Text>
        </View>
      </View>
      <View style={styles.masteryTrack}>
        <View
          style={[
            styles.masteryFill,
            { width: masteryWidth },
          ]}
        />
      </View>

      <View accessibilityRole="tablist" style={styles.modeTabs}>
        {modes.map((candidate) => {
          const isActive = candidate.id === mode;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={candidate.id}
              onPress={() => setMode(candidate.id)}
              style={[styles.modeTab, isActive && styles.modeTabActive]}
            >
              <SymbolView
                accessible={false}
                name={candidate.icon}
                size={15}
                tintColor={isActive ? colors.accentStrong : '#697487'}
                weight={isActive ? 'bold' : 'semibold'}
              />
              <Text style={[styles.modeLabel, isActive && styles.modeLabelActive]}>
                {candidate.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'learn' ? (
        <View style={styles.modeContent}>
          <View style={styles.modeHeading}>
            <Text style={styles.modeEyebrow}>GUIDED LESSON</Text>
            <Text style={styles.modeTitle}>Build the idea one step at a time</Text>
            <Text style={styles.modeBody}>
              Read each card, explain it back in your own words, then mark it as
              understood.
            </Text>
          </View>
          <LearningDeck
            points={points}
            nodes={item.nodes}
            completedSteps={progress.completed_lesson_steps}
            onToggleStep={(step) => toggleLessonStep(item.id, step)}
            onExploreMap={exploreNode}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode('recall')}
            style={({ pressed }) => [styles.nextModeCard, pressed && styles.pressed]}
          >
            <View style={styles.nextModeIcon}>
              <SymbolView
                accessible={false}
                name="questionmark.circle"
                size={20}
                tintColor={colors.accentPurple}
                weight="bold"
              />
            </View>
            <View style={styles.nextModeCopy}>
              <Text style={styles.nextModeKicker}>READY FOR A CHALLENGE?</Text>
              <Text style={styles.nextModeTitle}>Test the connections</Text>
            </View>
            <SymbolView
              accessible={false}
              name="arrow.right"
              size={20}
              tintColor={colors.accentPurple}
              weight="semibold"
            />
          </Pressable>
        </View>
      ) : null}

      {mode === 'visual' ? (
        <View style={styles.modeContent}>
          <View style={styles.modeHeading}>
            <Text style={styles.modeEyebrow}>VISUAL EXPLORER</Text>
            <Text style={styles.modeTitle}>See the idea from another angle</Text>
            <Text style={styles.modeBody}>
              Start with the suggested view, then switch layouts to expose a
              different pattern in the same concepts.
            </Text>
          </View>

          <View accessibilityRole="tablist" style={styles.diagramSwitcher}>
            {item.diagram_options.map((option) => {
              const isSelected = resolvedDiagram === option;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  key={option}
                  onPress={() => {
                    setDiagramSelection({ itemId: item.id, type: option });
                    setSelectedNodeId(null);
                  }}
                  style={[
                    styles.diagramOption,
                    isSelected && styles.diagramOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.diagramOptionText,
                      isSelected && styles.diagramOptionTextActive,
                    ]}
                  >
                    {diagramLabels[option]}
                  </Text>
                  {option === item.diagram_type ? (
                    <View style={styles.suggestedDot} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.diagramMetaRow}>
            <View>
              <Text style={styles.diagramActiveLabel}>ACTIVE VIEW</Text>
              <Text style={styles.diagramActiveValue}>
                {diagramLabels[resolvedDiagram]}
                {resolvedDiagram === item.diagram_type ? ' · suggested' : ''}
              </Text>
            </View>
            {resolvedDiagram !== 'network' ? (
              <View style={styles.directionToggle}>
                {(['TB', 'LR'] as const).map((value) => (
                  <Pressable
                    accessibilityLabel={
                      value === 'TB'
                        ? 'Top to bottom layout'
                        : 'Left to right layout'
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: direction === value }}
                    key={value}
                    onPress={() => setDirection(value)}
                    style={[
                      styles.directionButton,
                      direction === value && styles.directionButtonActive,
                    ]}
                  >
                    <SymbolView
                      accessible={false}
                      name={value === 'TB' ? 'arrow.down' : 'arrow.right'}
                      size={17}
                      tintColor={
                        direction === value
                          ? colors.accentStrong
                          : colors.textMuted
                      }
                      weight="bold"
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <Text style={styles.graphHint}>
            Pinch to zoom · drag nodes · pan the canvas · tap to inspect
          </Text>
          <AdaptiveDiagramViewer
            diagramType={resolvedDiagram}
            direction={direction}
            edges={item.edges}
            nodes={item.nodes}
            onNodePress={setSelectedNodeId}
          />

          <View style={styles.connectionPanel}>
            {selectedNode ? (
              <>
                <View style={styles.connectionTitleRow}>
                  <View style={styles.connectionNodeDot} />
                  <Text style={styles.connectionTitle}>{selectedNode.label}</Text>
                  <Text style={styles.connectionCount}>
                    {selectedConnections.length}{' '}
                    {selectedConnections.length === 1 ? 'link' : 'links'}
                  </Text>
                </View>
                {selectedConnections.length > 0 ? (
                  selectedConnections.map((connection) => (
                    <View key={connection.id} style={styles.connectionRow}>
                      <Text style={styles.connectionRelationship}>
                        {connection.relationship}
                      </Text>
                      <Text style={styles.connectionDirection}>
                        {connection.direction}
                      </Text>
                      <Text style={styles.connectionOther}>{connection.other}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.connectionEmpty}>
                    This concept stands on its own in the current diagram.
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.connectionPrompt}>
                <View style={styles.connectionPromptIcon}>
                  <SymbolView
                    accessible={false}
                    name="scope"
                    size={20}
                    tintColor={colors.accentStrong}
                    weight="semibold"
                  />
                </View>
                <View style={styles.connectionPromptCopy}>
                  <Text style={styles.connectionPromptTitle}>Choose a concept</Text>
                  <Text style={styles.connectionPromptBody}>
                    Tap any node above to see how it influences the rest of the idea.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {mode === 'recall' ? (
        <View style={styles.modeContent}>
          <View style={styles.modeHeading}>
            <Text style={styles.modeEyebrow}>ACTIVE RECALL</Text>
            <Text style={styles.modeTitle}>Can you explain the links?</Text>
            <Text style={styles.modeBody}>
              Think before revealing. Remembering a relationship is stronger than
              rereading it.
            </Text>
          </View>
          <RecallQuiz
            edges={item.edges}
            masteredEdgeIds={progress.mastered_edge_ids}
            nodes={item.nodes}
            onAnswer={(edgeId, mastered) =>
              markEdgeMastery(item.id, edgeId, mastered)
            }
          />
        </View>
      ) : null}

      {mode === 'source' ? (
        <View style={styles.modeContent}>
          <View style={styles.modeHeading}>
            <Text style={styles.modeEyebrow}>SOURCE MATERIAL</Text>
            <Text style={styles.modeTitle}>Go back to the evidence</Text>
            <Text style={styles.modeBody}>
              Use the lesson as a guide, then inspect the original context when a
              detail matters.
            </Text>
          </View>
          <View style={styles.sourceList}>
            {item.source_links.map((link, index) => (
              <Pressable
                accessibilityRole="link"
                key={link}
                onPress={() => void Linking.openURL(link)}
                style={({ pressed }) => [styles.sourceCard, pressed && styles.pressed]}
              >
                <View style={styles.sourceNumber}>
                  <Text style={styles.sourceNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceHost}>{sourceName(link)}</Text>
                  <Text style={styles.sourceLink} numberOfLines={2}>
                    {link}
                  </Text>
                </View>
                <SymbolView
                  accessible={false}
                  name="arrow.up.right"
                  size={18}
                  tintColor={colors.accentBlue}
                  weight="semibold"
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.originalCard}>
            <View style={styles.originalHeader}>
              <View>
                <Text style={styles.originalKicker}>ORIGINAL CONTEXT</Text>
                <Text style={styles.originalTitle}>What the lesson was built from</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowOriginalText((current) => !current)}
                style={styles.originalToggle}
              >
                <Text style={styles.originalToggleText}>
                  {showOriginalText ? 'Hide' : 'Read'}
                </Text>
              </Pressable>
            </View>
            {showOriginalText ? (
              <Text style={styles.originalText}>
                {item.raw_text.replace(/\s+/g, ' ').trim().slice(0, 1800)}
                {item.raw_text.length > 1800 ? '…' : ''}
              </Text>
            ) : (
              <Text style={styles.originalPreview} numberOfLines={3}>
                {item.raw_text.replace(/\s+/g, ' ').trim()}
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 72 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  emptyScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  emptyOrb: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center', borderRadius: 46, borderWidth: 1, borderColor: '#285B4D', backgroundColor: '#10241E', marginBottom: spacing.lg },
  emptyOrbCore: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.accentStrong, transform: [{ rotate: '45deg' }] },
  folderKicker: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  emptyTitle: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  emptyBody: { color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm, maxWidth: 330 },
  emptySteps: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl },
  emptyStep: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 16, backgroundColor: colors.surface },
  emptyStepNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceRaised },
  emptyStepNumberText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  emptyStepText: { color: colors.text, fontSize: 14, fontWeight: '600', marginLeft: spacing.sm },
  demoButton: { alignSelf: 'stretch', minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: 17, backgroundColor: colors.accentStrong, marginTop: spacing.xl },
  demoButtonText: { color: colors.accentInk, fontSize: 15, fontWeight: '800' },
  topMeta: { flexDirection: 'row', alignItems: 'center' },
  demoBadge: { marginLeft: spacing.sm, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#2B2440' },
  demoBadgeText: { color: colors.accentPurple, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  itemSwitcher: { gap: 8, paddingTop: spacing.md, paddingRight: spacing.lg },
  itemChip: { maxWidth: 210, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemChipSelected: { borderColor: '#286B56', backgroundColor: '#10241E' },
  itemChipText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  itemChipTextSelected: { color: colors.accent },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1, marginTop: spacing.sm },
  masteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  masteryCopy: { flex: 1 },
  masteryLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  masteryHint: { color: '#7E899B', fontSize: 11, marginTop: 3 },
  masteryRing: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 2, borderColor: colors.accentStrong, backgroundColor: '#10241E' },
  masteryValue: { color: colors.accent, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  masteryTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.sm },
  masteryFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accentStrong },
  modeTabs: { flexDirection: 'row', padding: 5, borderRadius: 18, backgroundColor: colors.surface, marginTop: spacing.lg },
  modeTab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 14 },
  modeTabActive: { backgroundColor: colors.surfaceRaised },
  modeLabel: { color: '#697487', fontSize: 10, fontWeight: '700' },
  modeLabelActive: { color: colors.text },
  modeContent: { marginTop: spacing.xl },
  modeHeading: { marginBottom: spacing.lg },
  modeEyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  modeTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4, marginTop: 5 },
  modeBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  nextModeCard: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, padding: spacing.md, borderRadius: 19, borderWidth: 1, borderColor: '#3A3450', backgroundColor: '#171421' },
  nextModeIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#2A223A' },
  nextModeCopy: { flex: 1, marginLeft: spacing.md },
  nextModeKicker: { color: colors.accentPurple, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  nextModeTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  diagramSwitcher: { flexDirection: 'row', gap: 8 },
  diagramOption: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  diagramOptionActive: { borderColor: '#286B56', backgroundColor: '#10241E' },
  diagramOptionText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  diagramOptionTextActive: { color: colors.accent },
  suggestedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentStrong },
  diagramMetaRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  diagramActiveLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  diagramActiveValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 3 },
  directionToggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: colors.surface },
  directionButton: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  directionButtonActive: { backgroundColor: colors.surfaceRaised },
  graphHint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, marginBottom: spacing.sm },
  connectionPanel: { marginTop: spacing.md, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  connectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  connectionNodeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accentStrong, marginRight: spacing.sm },
  connectionTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  connectionCount: { color: colors.textMuted, fontSize: 10 },
  connectionRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  connectionRelationship: { color: colors.accentStrong, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  connectionDirection: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  connectionOther: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  connectionEmpty: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  connectionPrompt: { flexDirection: 'row', alignItems: 'center' },
  connectionPromptIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceRaised },
  connectionPromptCopy: { flex: 1, marginLeft: spacing.md },
  connectionPromptTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  connectionPromptBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  sourceList: { gap: spacing.sm },
  sourceCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sourceNumber: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceRaised },
  sourceNumberText: { color: colors.accentBlue, fontSize: 12, fontWeight: '800' },
  sourceCopy: { flex: 1, marginHorizontal: 12 },
  sourceHost: { color: colors.text, fontSize: 13, fontWeight: '700' },
  sourceLink: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  originalCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#10151F' },
  originalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  originalKicker: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  originalTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  originalToggle: { minWidth: 58, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceRaised },
  originalToggleText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  originalPreview: { color: colors.textMuted, fontSize: 12, lineHeight: 19, marginTop: spacing.md },
  originalText: { color: '#CAD0DA', fontSize: 13, lineHeight: 21, marginTop: spacing.md },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
