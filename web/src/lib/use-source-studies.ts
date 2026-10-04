import { useEffect, useState } from "react";
import type { Note } from "../types";
import type { SourceClient } from "./source-client";
import type { StudyRecord } from "./study-note";
import { noteFromSavedSource } from "./api";

export function useSourceStudies(
  client: SourceClient | null,
  notes: Note[],
  enabled: boolean,
) {
  const [records, setRecords] = useState<Record<string, StudyRecord>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshVersion, refresh] = useState(0);
  useEffect(() => {
    if (!client || !enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const studies = await client!.studies();
        for (const study of studies) {
          const source = notes.find(
            (n) => n.id === study.source_id,
          )?.savedSource;
          if (source && (source.source_version ?? 1) === (study.source_version ?? 1)) noteFromSavedSource(source, study);
        }
        if (!active) return;
        setRecords(
          Object.fromEntries(
            studies.map((record) => [record.source_id, record]),
          ),
        );
        setError("");
        if (
          studies.some(
            (s) => s.status === "queued" || s.status === "processing",
          )
        )
          timer = setTimeout(load, 5000);
      } catch (error: unknown) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Study notes could not be loaded. Retry loading.",
          );
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, enabled, notes, refreshVersion]);

  async function generate(note: Note) {
    if (!client || busy || !note.savedSource) return;
    setBusy(true);
    setError("");
    try {
      const study = await client.generate(
        note.id,
        records[note.id]?.status === "failed",
      );
      noteFromSavedSource(note.savedSource, study);
      setRecords((records) => ({ ...records, [note.id]: study }));
      refresh((version) => version + 1);
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Generation could not be requested. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    records,
    error,
    busy,
    generate,
    reload: () => refresh((version) => version + 1),
  };
}
