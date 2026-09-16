import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { KnowledgeProvider } from '@/state/KnowledgeContext';

export const unstable_settings = { anchor: 'index' };

function ShareIntentRedirector() {
  const { hasShareIntent, isReady } = useShareIntentContext();
  const navigationState = useRootNavigationState();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const isShareRoute = segments.join('/') === 'modal/share';
    if (navigationState?.key && isReady && hasShareIntent && !isShareRoute) {
      router.push('/modal/share');
    }
  }, [hasShareIntent, isReady, navigationState?.key, router, segments]);

  return null;
}

function RootNavigator() {
  return (
    <KnowledgeProvider>
      <BottomSheetModalProvider>
          <ShareIntentRedirector />
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              headerTintColor: colors.text,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="folder/[id]"
              options={{ title: '', headerBackTitle: 'Folders' }}
            />
            <Stack.Screen
              name="modal/share"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </Stack>
          <StatusBar style="light" />
      </BottomSheetModalProvider>
    </KnowledgeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider
        options={{
          disabled: Platform.OS === 'web',
          resetOnBackground: false,
          scheme: 'secondbrain',
        }}
      >
        <RootNavigator />
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
