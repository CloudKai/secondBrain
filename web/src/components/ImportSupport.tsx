export default function ImportSupport({ kind, suppliedTranscript }: {
  kind: string;
  suppliedTranscript: boolean;
}) {
  return <details className="import-help">
    <summary>Limits and what gets saved</summary>
    {kind === "PDF" ? <>
      <p>Up to 10 MB, 100 pages and 120,000 captured characters. Scanned-only and encrypted PDFs are unsupported.</p>
      <p>Notes use selectable text and original page numbers. Images and layout are not extracted. Uploads retain page text and filename; the original file is not stored.</p>
      <p>Missing or omitted text is labelled.</p>
    </> : kind === "Video" ? suppliedTranscript ? <>
      <p>Upload UTF-8 TXT, VTT or SRT up to 1 MB and 2,000 timed cues, or paste 120–100,000 characters. Up to 120,000 readable characters are captured; omitted text is labelled.</p>
      <p>TXT is untimed. Use VTT/SRT to retain supplied cue times. For DOCX or other exports, paste the readable text.</p>
      <p>The transcript is supplied by you. The app does not fetch or watch the recording or connect provider accounts.</p>
    </> : <>
      <p>English YouTube captions only, when anonymously accessible. Missing, restricted or blocked captions need an uploaded or pasted transcript.</p>
      <p>Up to 2,000 cues and 120,000 captured characters. Video completeness is unverified.</p>
      <p>No audio/video is downloaded or watched and no provider account is connected.</p>
    </> : <>
      <p>Public HTTP(S) articles: up to 2 MB per download and 120,000 captured characters. Incomplete coverage is labelled.</p>
      <p>Captured text and the generated study note are saved to your private library. Use PDF for selectable-text documents or Video for captions and transcripts.</p>
    </>}
  </details>;
}
