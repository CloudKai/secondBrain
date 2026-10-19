export default function VideoTranscriptInput({
  mode,
  onMode,
  onFile,
  text,
  onText,
  busy,
}: {
  mode: "paste" | "upload";
  onMode: (mode: "paste" | "upload") => void;
  onFile: (file: File | null) => void;
  text: string;
  onText: (text: string) => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="source-input-tabs" aria-label="Transcript input method">
        <button
          type="button"
          aria-pressed={mode === "paste"}
          className={mode === "paste" ? "active" : ""}
          disabled={busy}
          onClick={() => onMode("paste")}
        >
          Paste transcript
        </button>
        <button
          type="button"
          aria-pressed={mode === "upload"}
          className={mode === "upload" ? "active" : ""}
          disabled={busy}
          onClick={() => onMode("upload")}
        >
          Upload transcript
        </button>
      </div>
      <p className="micro-copy" id="transcript-format">Use VTT or SRT to keep timestamps. TXT and plain pasted text are untimed.</p>
      {mode === "paste" ? (
        <>
          <label className="form-label" htmlFor="transcript-text">
            Transcript text <span>120–100,000 characters</span>
          </label>
          <textarea
            id="transcript-text"
            key="transcript-paste"
            rows={4}
            required
            maxLength={100000}
            value={text}
            onChange={(e) => onText(e.target.value)}
            disabled={busy}
            aria-describedby="source-support transcript-format"
            placeholder="Paste the transcript or its VTT/SRT captions. Times are retained only when supplied in VTT/SRT format."
          />
        </>
      ) : (
        <>
          <label className="form-label" htmlFor="transcript-file">
            Transcript file <span>UTF-8 TXT, VTT or SRT</span>
          </label>
          <input
            id="transcript-file"
            key="transcript-upload"
            type="file"
            accept=".txt,.vtt,.srt,text/plain,text/vtt,application/x-subrip"
            required
            disabled={busy}
            aria-describedby="source-support transcript-format"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </>
      )}
    </>
  );
}
