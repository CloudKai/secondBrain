type RedirectSystemPathOptions = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({
  path,
}: RedirectSystemPathOptions): string {
  try {
    // expo-share-intent uses dataUrl as a wake-up deep link. The provider reads
    // the native payload; Router only needs a stable route to initialize.
    if (path.includes('dataUrl=')) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
