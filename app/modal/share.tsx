import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { processLink } from '@/lib/api';
import { useKnowledge } from '@/state/KnowledgeContext';
import { folders, type FolderId } from '@/types/knowledge';

const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;

function firstUrl(text: string): string | null {
  return text.match(URL_PATTERN)?.[0]?.replace(/[.,;!?]+$/, '') ?? null;
}

function linksFrom(text: string, sourceUrl: string): string[] {
  return Array.from(new Set([sourceUrl, ...(text.match(URL_PATTERN) ?? [])])).slice(
    0,
    8,
  );
}

function conciseTitle(title: string | undefined, url: string): string {
  const fallback = new URL(url).hostname.replace(/^www\./, '');
  const value = title?.trim() || fallback;
  return value.length > 72 ? `${value.slice(0, 69)}…` : value;
}

function sourceName(url: string | null): string {
  if (!url) return 'No link detected';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Shared link';
  }
}

export default function ShareReceiverModal() {
  const sheetRef = useRef<BottomSheet>(null);
  const { addItem } = useKnowledge();
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const [selectedFolder, setSelectedFolder] = useState<FolderId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapPoints = useMemo(() => ['72%'], []);

  const rawText = shareIntent.text?.trim() || shareIntent.webUrl || '';
  const sharedUrl = shareIntent.webUrl || firstUrl(rawText);

  const close = useCallback(() => {
    if (isSubmitting) return;
    resetShareIntent();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [isSubmitting, resetShareIntent]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.72}
        pressBehavior="close"
      />
    ),
    [],
  );

  const submit = async () => {
    if (!selectedFolder || !sharedUrl || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await processLink({
        url: sharedUrl,
        raw_text: rawText,
        folder_id: selectedFolder,
      });
      addItem({
        ...result,
        id: `${Date.now()}-${selectedFolder}`,
        title: conciseTitle(shareIntent.meta?.title, sharedUrl),
        source_links: linksFrom(result.raw_text, result.source_url),
        saved_at: new Date().toISOString(),
      });
      resetShareIntent();
      router.replace(`/folder/${selectedFolder}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong.');
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.route}>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}
        enablePanDownToClose={!isSubmitting}
        onClose={close}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.kicker}>SAVE TO SECOND BRAIN</Text>
          <Text style={styles.title}>Turn this into a lesson</Text>
          <Text style={styles.subtitle}>
            Choose a learning path. We’ll simplify the article, map the ideas,
            and build a recall round.
          </Text>

          <View style={styles.linkPreview}>
            <View style={styles.linkIcon}>
              <SymbolView
                accessible={false}
                name="arrow.up.right"
                size={18}
                tintColor={colors.accentBlue}
                weight="semibold"
              />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkLabel}>CAPTURED SOURCE</Text>
              <Text style={styles.linkHost}>{sourceName(sharedUrl)}</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>
                {sharedUrl || 'Share an article URL to continue'}
              </Text>
            </View>
          </View>

          <Text style={styles.folderPrompt}>WHERE SHOULD IT LIVE?</Text>

          <View style={styles.folderList}>
            {folders.map((folder) => {
              const isSelected = selectedFolder === folder.id;
              return (
                <Pressable
                  key={folder.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  disabled={isSubmitting}
                  onPress={() => setSelectedFolder(folder.id)}
                  style={({ pressed }) => [
                    styles.folder,
                    isSelected && styles.folderSelected,
                    pressed && styles.folderPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.folderIcon,
                      folder.id === 'ai-engineering'
                        ? styles.folderIconGreen
                        : styles.folderIconPurple,
                    ]}
                  >
                    <Text
                      style={[
                        styles.folderIconText,
                        folder.id === 'ai-engineering'
                          ? styles.folderIconTextGreen
                          : styles.folderIconTextPurple,
                      ]}
                    >
                      {folder.id === 'ai-engineering' ? 'AI' : 'SD'}
                    </Text>
                  </View>
                  <View style={styles.folderText}>
                    <Text style={styles.folderName}>{folder.name}</Text>
                    <Text style={styles.folderDescription}>{folder.description}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? (
                      <SymbolView
                        accessible={false}
                        name="checkmark"
                        size={13}
                        tintColor={colors.accentInk}
                        weight="bold"
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!sharedUrl || error ? (
            <View style={styles.errorCard}>
              <SymbolView
                accessible={false}
                name="exclamationmark.circle.fill"
                size={16}
                tintColor={colors.danger}
                weight="bold"
              />
              <Text style={styles.error}>
                {!sharedUrl
                  ? 'The shared content does not contain a URL.'
                  : error}
              </Text>
            </View>
          ) : null}

          {isSubmitting ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={colors.accentStrong} size="small" />
              <View style={styles.processingCopy}>
                <Text style={styles.processingTitle}>Building your learning path…</Text>
                <Text style={styles.processingBody}>
                  Reading · simplifying · connecting ideas
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!selectedFolder || !sharedUrl || isSubmitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.submit,
              (!selectedFolder || !sharedUrl || isSubmitting) && styles.submitDisabled,
              pressed && styles.submitPressed,
            ]}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? 'Creating lesson…' : 'Build my lesson'}
            </Text>
            {!isSubmitting ? (
              <SymbolView
                accessible={false}
                name="arrow.right"
                size={20}
                tintColor={colors.accentInk}
                weight="bold"
              />
            ) : null}
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  route: { flex: 1 },
  sheetBackground: { backgroundColor: colors.surface },
  handle: { backgroundColor: '#4B5565', width: 42 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: 28 },
  kicker: { color: colors.accentStrong, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginTop: 6 },
  title: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: '700', letterSpacing: -0.7, marginTop: 8 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  linkPreview: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: '#10151F', marginTop: spacing.md },
  linkIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceRaised },
  linkCopy: { flex: 1, marginLeft: 12 },
  linkLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  linkHost: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  linkUrl: { color: '#748094', fontSize: 10, marginTop: 2 },
  folderPrompt: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: spacing.md },
  folderList: { gap: 9, marginTop: spacing.sm },
  folder: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, backgroundColor: colors.surfaceRaised },
  folderSelected: { borderColor: colors.accentStrong, backgroundColor: '#132A23' },
  folderPressed: { opacity: 0.75 },
  folderIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  folderIconGreen: { backgroundColor: '#123126' },
  folderIconPurple: { backgroundColor: '#2A223A' },
  folderIconText: { fontSize: 12, fontWeight: '900' },
  folderIconTextGreen: { color: colors.accentStrong },
  folderIconTextPurple: { color: colors.accentPurple },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#5C6678', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accentStrong, backgroundColor: colors.accentStrong },
  folderText: { flex: 1, marginLeft: 12 },
  folderName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  folderDescription: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  errorCard: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, backgroundColor: '#301A20', marginTop: spacing.sm },
  error: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17, marginLeft: 9 },
  processingRow: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm },
  processingCopy: { marginLeft: 10 },
  processingTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  processingBody: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  submit: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: colors.accentStrong, marginTop: 'auto' },
  submitDisabled: { opacity: 0.38 },
  submitPressed: { transform: [{ scale: 0.985 }] },
  submitText: { color: colors.accentInk, fontSize: 16, fontWeight: '800' },
});
