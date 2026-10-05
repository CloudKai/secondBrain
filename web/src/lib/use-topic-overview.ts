import { useEffect, useRef, useState } from "react";
import type { SourceClient } from "./source-client";
import type { OverviewSnapshot } from "./topic-overview";

export function useTopicOverview(client: SourceClient | null, enabled: boolean, topicId: string, revision: string) {
  const key = `${topicId}:${revision}`;
  const [result, setResult] = useState<{key: string; data: OverviewSnapshot} | null>(null);
  const [error, setError] = useState<{key: string; message: string} | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const active = useRef("");
  const pending = useRef("");
  useEffect(() => {
    if (!client || !enabled) return;
    active.current = key;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (pending.current === key) { timer = setTimeout(load, 5000); return; }
      const request = ++sequence.current;
      try {
        const data = await client!.topicOverview(topicId);
        if (cancelled || request !== sequence.current) return;
        setResult({key, data}); setError(null);
        if (data.record?.status === "queued" || data.record?.status === "processing") timer = setTimeout(load, 5000);
      } catch (e: unknown) {
        if (!cancelled && request === sequence.current) setError({key, message: e instanceof Error ? e.message : "The overview could not be loaded. Retry."});
      }
    }
    void load();
    return () => { cancelled = true; active.current = ""; clearTimeout(timer); };
  }, [client, enabled, topicId, key, version]);
  async function choose(mode: "combined" | "separate", retry = false) {
    if (!client || !enabled || busyKey === key) return;
    const request = ++sequence.current;
    pending.current = key;
    setBusyKey(key); setError(null);
    try {
      const data = await client.setTopicView(topicId, mode, retry);
      if (active.current !== key || request !== sequence.current) return;
      setResult({key, data}); setVersion(v => v + 1);
    } catch (e: unknown) {
      if (active.current === key && request === sequence.current) setError({key, message: e instanceof Error ? e.message : "The view could not be saved. Retry."});
    } finally { if (pending.current === key) pending.current = ""; if (active.current === key) setBusyKey(""); }
  }
  return {data: result?.key === key ? result.data : null, error: error?.key === key ? error.message : "", busy: busyKey === key, choose, reload: () => setVersion(v => v + 1)};
}
