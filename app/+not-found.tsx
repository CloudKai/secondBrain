import { Redirect } from 'expo-router';

/**
 * Native share wake-up URLs should be rewritten by +native-intent. If a stale
 * or restored navigation state still reaches Router, keep the user inside the
 * app so ShareIntentProvider can consume the pending native payload.
 */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
