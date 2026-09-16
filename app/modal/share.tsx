import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
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

export default function ShareReceiverModal() {
  const sheetRef = useRef<BottomSheet>(null);
  const { addItem } = useKnowledge();
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const [selectedFolder, setSelectedFolder] = useState<FolderId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapPoints = useMemo(() => ['58%'], []);

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
        title: conciseTitle(shareIntent.meta?.title, sharedUrl),
        source_links: linksFrom(result.raw_text, result.source_url),
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
          <Text style={styles.title}>Select Folder</Text>
          <Text style={styles.subtitle}>Where should this idea live?</Text>

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
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.folderText}>
                    <Text style={styles.folderName}>{folder.name}</Text>
                    <Text style={styles.folderDescription}>{folder.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!sharedUrl ? (
            <Text style={styles.error}>The shared content does not contain a URL.</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

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
            {isSubmitting ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <Text style={styles.submitText}>Simplify & save</Text>
            )}
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
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: 32 },
  kicker: { color: colors.accentStrong, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginTop: 6 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 5 },
  folderList: { gap: 10, marginTop: 22 },
  folder: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 15, backgroundColor: colors.surfaceRaised },
  folderSelected: { borderColor: colors.accentStrong, backgroundColor: '#132A23' },
  folderPressed: { opacity: 0.75 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#5C6678', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accentStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentStrong },
  folderText: { flex: 1, marginLeft: 13 },
  folderName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  folderDescription: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: 12 },
  submit: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentStrong, marginTop: 'auto' },
  submitDisabled: { opacity: 0.38 },
  submitPressed: { transform: [{ scale: 0.985 }] },
  submitText: { color: colors.accentInk, fontSize: 16, fontWeight: '800' },
});
