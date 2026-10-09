import type { SourceReference } from '../lib/study-note';
import { formatVideoTime } from '../lib/transcript';

export default function PassageLocation({passage}:{passage:SourceReference}) {
  const label = passage.page != null ? `PDF page ${passage.page}`
    : passage.start_ms != null && passage.end_ms != null
      ? `${formatVideoTime(passage.start_ms)}–${formatVideoTime(passage.end_ms)}`
      : `Captured text · characters ${passage.start + 1}–${passage.end}`;
  return <span className="source-location">{label}</span>;
}
