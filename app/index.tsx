import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { demoKnowledgeItem } from '@/constants/demoKnowledge';
import { colors, spacing } from '@/constants/theme';
import { useKnowledge } from '@/state/KnowledgeContext';
import { folders } from '@/types/knowledge';

function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Saved source';
  }
}

export default function HomeScreen() {
  const { items, addItem, getItemsForFolder, getProgress } = useKnowledge();
  const latestItem = items[0];
  const reviewedConcepts = items.reduce((total, item) => {
    const progress = getProgress(item.id);
    return (
      total +
      progress.completed_lesson_steps.length +
      progress.mastered_edge_ids.length
    );
  }, 0);

  const openDemo = () => {
    addItem(demoKnowledgeItem);
    router.push('/folder/ai-engineering');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <View style={styles.brandCore} />
          </View>
          <Text style={styles.brand}>SECOND BRAIN</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>READY</Text>
          </View>
        </View>

        <Text style={styles.title}>Learn what{`\n`}you save.</Text>
        <Text style={styles.subtitle}>
          Turn dense ideas into a guided lesson, an adaptive visual, and a
          quick recall challenge.
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>
            {latestItem ? 'CONTINUE LEARNING' : 'YOUR FIRST LEARNING LOOP'}
          </Text>
          <Text style={styles.heroTitle}>
            {latestItem ? latestItem.title : 'See the full experience in 60 seconds'}
          </Text>
          <Text style={styles.heroBody}>
            {latestItem
              ? `${getProgress(latestItem.id).completed_lesson_steps.length} lesson ideas reviewed · ${getProgress(latestItem.id).mastered_edge_ids.length} connections mastered`
              : 'Open a guided demo with concept cards, an explorable visual, and active-recall prompts.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              latestItem
                ? router.push(
                    `/folder/${latestItem.folder_id}?item=${encodeURIComponent(latestItem.id)}`,
                  )
                : openDemo()
            }
            style={({ pressed }) => [
              styles.heroAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.heroActionText}>
              {latestItem ? 'Resume lesson' : 'Try the interactive demo'}
            </Text>
            <SymbolView
              accessible={false}
              name="arrow.right"
              size={20}
              tintColor={colors.accentInk}
              weight="bold"
            />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{items.length}</Text>
            <Text style={styles.statLabel}>Ideas saved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, styles.statNumberPurple]}>
              {reviewedConcepts}
            </Text>
            <Text style={styles.statLabel}>Concepts checked</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>YOUR LIBRARY</Text>
            <Text style={styles.sectionTitle}>Choose a learning path</Text>
          </View>
          <Text style={styles.sectionCount}>{folders.length} topics</Text>
        </View>

        <View style={styles.folderList}>
          {folders.map((folder, index) => {
            const folderItems = getItemsForFolder(folder.id);
            const isAi = index === 0;
            return (
              <Pressable
                accessibilityHint={`Contains ${folderItems.length} saved ideas`}
                accessibilityRole="button"
                key={folder.id}
                onPress={() => router.push(`/folder/${folder.id}`)}
                style={({ pressed }) => [
                  styles.folderCard,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.folderIcon,
                    isAi ? styles.folderIconGreen : styles.folderIconPurple,
                  ]}
                >
                  <Text
                    style={[
                      styles.folderIconText,
                      isAi ? styles.folderIconTextGreen : styles.folderIconTextPurple,
                    ]}
                  >
                    {isAi ? 'AI' : 'SD'}
                  </Text>
                </View>
                <View style={styles.folderCopy}>
                  <View style={styles.folderTitleRow}>
                    <Text style={styles.folderName}>{folder.name}</Text>
                    <SymbolView
                      accessible={false}
                      name="chevron.right"
                      size={16}
                      tintColor={colors.textMuted}
                      weight="semibold"
                    />
                  </View>
                  <Text style={styles.folderDescription} numberOfLines={2}>
                    {folder.description}
                  </Text>
                  <View style={styles.folderMetaRow}>
                    <Text style={styles.folderMeta}>
                      {folderItems.length === 0
                        ? 'Ready for your first idea'
                        : `${folderItems.length} ${folderItems.length === 1 ? 'idea' : 'ideas'} to explore`}
                    </Text>
                    {folderItems.length > 0 ? (
                      <View
                        style={[
                          styles.folderStatusDot,
                          isAi
                            ? styles.folderStatusDotGreen
                            : styles.folderStatusDotPurple,
                        ]}
                      />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {items.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.sectionKicker}>RECENTLY SAVED</Text>
            <ScrollView
              horizontal
              contentContainerStyle={styles.recentList}
              showsHorizontalScrollIndicator={false}
            >
              {items.slice(0, 5).map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() =>
                    router.push(
                      `/folder/${item.folder_id}?item=${encodeURIComponent(item.id)}`,
                    )
                  }
                  style={({ pressed }) => [
                    styles.recentCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.recentSource}>{sourceName(item.source_url)}</Text>
                  <Text style={styles.recentTitle} numberOfLines={3}>
                    {item.title}
                  </Text>
                  <View style={styles.recentFooter}>
                    <Text style={styles.recentMeta}>
                      {item.nodes.length} concepts
                    </Text>
                    <View style={styles.recentAction}>
                      <Text style={styles.recentArrow}>Open</Text>
                      <SymbolView
                        accessible={false}
                        name="arrow.right"
                        size={12}
                        tintColor={colors.accentStrong}
                        weight="bold"
                      />
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.shareCoach}>
          <View style={styles.shareCoachIcon}>
            <SymbolView
              accessible={false}
              name="square.and.arrow.up"
              size={20}
              tintColor={colors.accentBlue}
              weight="semibold"
            />
          </View>
          <View style={styles.shareCoachCopy}>
            <Text style={styles.shareCoachTitle}>Save from anywhere</Text>
            <Text style={styles.shareCoachBody}>
              In Safari, tap Share, then choose Second Brain. Your new lesson
              will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: 24, paddingBottom: 64 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#173B30' },
  brandCore: { width: 8, height: 8, borderRadius: 3, backgroundColor: colors.accentStrong, transform: [{ rotate: '45deg' }] },
  brand: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginLeft: 9 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surface },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentStrong },
  liveText: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  title: { color: colors.text, fontSize: 46, lineHeight: 50, fontWeight: '700', letterSpacing: -2, marginTop: spacing.lg },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.md, maxWidth: 480 },
  heroCard: { overflow: 'hidden', marginTop: spacing.xl, padding: spacing.lg, borderRadius: 26, borderWidth: 1, borderColor: '#285B4D', backgroundColor: '#10241E' },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -105, right: -55, backgroundColor: '#1B5B46', opacity: 0.48 },
  heroKicker: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { color: colors.text, fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -0.45, marginTop: spacing.sm, maxWidth: 310 },
  heroBody: { color: '#B8CEC6', fontSize: 13, lineHeight: 20, marginTop: spacing.sm, maxWidth: 330 },
  heroAction: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: colors.accentStrong },
  heroActionText: { color: colors.accentInk, fontSize: 14, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: { flex: 1, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statNumber: { color: colors.accentStrong, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statNumberPurple: { color: colors.accentPurple },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 42, marginBottom: spacing.md },
  sectionKicker: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: '700', letterSpacing: -0.3, marginTop: 5 },
  sectionCount: { color: colors.textMuted, fontSize: 11, marginBottom: 3 },
  folderList: { gap: spacing.sm },
  folderCard: { flexDirection: 'row', alignItems: 'center', minHeight: 112, padding: spacing.md, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  folderIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  folderIconGreen: { backgroundColor: '#123126' },
  folderIconPurple: { backgroundColor: '#2A223A' },
  folderIconText: { fontSize: 15, fontWeight: '900' },
  folderIconTextGreen: { color: colors.accentStrong },
  folderIconTextPurple: { color: colors.accentPurple },
  folderCopy: { flex: 1, marginLeft: spacing.md },
  folderTitleRow: { flexDirection: 'row', alignItems: 'center' },
  folderName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  folderDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  folderMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  folderMeta: { color: '#748094', fontSize: 10, fontWeight: '600' },
  folderStatusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 7 },
  folderStatusDotGreen: { backgroundColor: colors.accentStrong },
  folderStatusDotPurple: { backgroundColor: colors.accentPurple },
  recentSection: { marginTop: 42 },
  recentList: { gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.lg },
  recentCard: { width: 230, minHeight: 150, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  recentSource: { color: colors.accentBlue, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  recentTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: spacing.sm },
  recentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: spacing.md },
  recentMeta: { color: colors.textMuted, fontSize: 10 },
  recentAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentArrow: { color: colors.accentStrong, fontSize: 11, fontWeight: '700' },
  shareCoach: { flexDirection: 'row', marginTop: 42, padding: spacing.md, borderRadius: 20, backgroundColor: '#10151F' },
  shareCoachIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceRaised },
  shareCoachCopy: { flex: 1, marginLeft: spacing.md },
  shareCoachTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  shareCoachBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
