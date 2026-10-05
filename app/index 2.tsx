import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useKnowledge } from '@/state/KnowledgeContext';
import { folders } from '@/types/knowledge';

export default function HomeScreen() {
  const { getItemsForFolder } = useKnowledge();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.eyebrowRow}>
          <View style={styles.pulse} />
          <Text style={styles.eyebrow}>SECOND BRAIN</Text>
        </View>
        <Text style={styles.title}>Ideas, made clear.</Text>
        <Text style={styles.subtitle}>
          Share any dense article from another app. We’ll turn it into a simple
          explanation and a visual map.
        </Text>

        <Text style={styles.sectionLabel}>FOLDERS</Text>
        <View style={styles.folderList}>
          {folders.map((folder) => {
            const count = getItemsForFolder(folder.id).length;
            return (
              <Pressable
                accessibilityRole="button"
                key={folder.id}
                onPress={() => router.push(`/folder/${folder.id}`)}
                style={({ pressed }) => [
                  styles.folderCard,
                  pressed && styles.folderCardPressed,
                ]}
              >
                <View style={styles.folderIcon}>
                  <Text style={styles.folderIconText}>{folder.name.charAt(0)}</Text>
                </View>
                <View style={styles.folderCopy}>
                  <Text style={styles.folderName}>{folder.name}</Text>
                  <Text style={styles.folderDescription}>{folder.description}</Text>
                </View>
                <Text style={styles.folderCount}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.hint}>
          <Text style={styles.hintTitle}>Ready when you are</Text>
          <Text style={styles.hintBody}>
            Open a webpage, tap Share, then choose Second Brain.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 40 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentStrong },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2.2 },
  title: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: -1.5, marginTop: 14 },
  subtitle: { color: colors.textMuted, fontSize: 17, lineHeight: 26, marginTop: 12, maxWidth: 460 },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, marginTop: 42, marginBottom: 12 },
  folderList: { gap: 12 },
  folderCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  folderCardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  folderIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  folderIconText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  folderCopy: { flex: 1, marginHorizontal: 14 },
  folderName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  folderDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  folderCount: { color: colors.textMuted, fontSize: 15, fontVariant: ['tabular-nums'] },
  hint: { marginTop: 'auto', marginBottom: 28, padding: spacing.lg, borderRadius: 20, backgroundColor: '#10241E' },
  hintTitle: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  hintBody: { color: '#B8CEC6', fontSize: 14, lineHeight: 21, marginTop: 5 },
});
