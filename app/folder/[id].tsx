import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { InteractiveGraphViewer } from '@/components/InteractiveGraphViewer';
import { colors, spacing } from '@/constants/theme';
import { useKnowledge } from '@/state/KnowledgeContext';
import { folders, type FolderId } from '@/types/knowledge';

function isFolderId(value: string): value is FolderId {
  return folders.some((folder) => folder.id === value);
}

export default function FolderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const folderId = routeId && isFolderId(routeId) ? routeId : null;
  const folder = folders.find((candidate) => candidate.id === folderId);
  const { getItemsForFolder } = useKnowledge();
  const item = folderId ? getItemsForFolder(folderId)[0] : undefined;

  if (!folder) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Folder not found</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.folderKicker}>{folder.name.toUpperCase()}</Text>
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptyBody}>
          Share an article to Second Brain and save it to this folder.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.folderKicker}>{folder.name.toUpperCase()}</Text>
      <Text style={styles.title}>{item.title}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>THE SIMPLE VERSION</Text>
        <Markdown style={markdownStyles}>{item.simplified_summary}</Markdown>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionLabel}>VISUAL MAP</Text>
          <Text style={styles.zoomHint}>Drag · pinch · pan</Text>
        </View>
        <InteractiveGraphViewer nodes={item.nodes} edges={item.edges} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SOURCES</Text>
        <View style={styles.sources}>
          {item.source_links.map((link, index) => (
            <Pressable
              accessibilityRole="link"
              key={link}
              onPress={() => void Linking.openURL(link)}
              style={({ pressed }) => [styles.source, pressed && styles.sourcePressed]}
            >
              <View style={styles.sourceNumber}>
                <Text style={styles.sourceNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.sourceLink} numberOfLines={2}>
                {link}
              </Text>
              <Text style={styles.sourceArrow}>↗</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  bullet_list: { marginVertical: 0 },
  list_item: { marginBottom: 10 },
  bullet_list_icon: { color: colors.accentStrong, marginRight: 10 },
  paragraph: { marginTop: 0, marginBottom: 0 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  folderKicker: { color: colors.accentStrong, fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1, marginTop: 10 },
  emptyTitle: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: 12 },
  emptyBody: { color: colors.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  section: { marginTop: 36 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  zoomHint: { color: colors.textMuted, fontSize: 11, marginBottom: 12 },
  sources: { gap: 9 },
  source: { minHeight: 62, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sourcePressed: { opacity: 0.7 },
  sourceNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  sourceNumberText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  sourceLink: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18, marginHorizontal: 11 },
  sourceArrow: { color: colors.accentStrong, fontSize: 18 },
});
