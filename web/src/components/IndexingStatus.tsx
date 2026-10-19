import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Search } from 'lucide-react';
import type { SourceClient } from '../lib/source-client';
import type { IndexStatus } from '../lib/index-status';

export default function IndexingStatus({client, sourceId, version}: {
  client: SourceClient; sourceId: string; version: number;
}) {
  const [record, setRecord] = useState<IndexStatus | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const status = await client.indexStatus(sourceId,version);
        if (!active) return;
        setRecord(status);
        setError(false);
        if (status.status === 'queued' || status.status === 'processing') timer = setTimeout(load,5000);
      } catch {
        if (active) {setRecord(null); setError(true);}
      }
    }
    void load();
    return () => {active=false; clearTimeout(timer);};
  }, [client, sourceId, version, revision]);
  const current = record?.source_id === sourceId && record.source_version === version ? record : null;
  const label = error ? 'Search preparation status unavailable' : !current ? 'Checking search preparation…' :
    current.status === 'ready' ? 'Search index ready' :
    current.status === 'failed' ? 'Search preparation needs attention' :
    current.status === 'queued' ? 'Waiting to prepare search' : 'Preparing search';
  return <section className="indexing-status" aria-label="Search preparation">
    <div className="indexing-status-line" role="status">
      {current?.status === 'ready' ? <Check size={15} aria-hidden="true"/> :
        current?.status === 'processing' ? <LoaderCircle size={15} aria-hidden="true"/> : <Search size={15} aria-hidden="true"/>}
      <span>{label}</span>
      {current && current.status !== 'ready' && current.chunks_total>0 &&
        <span>{current.chunks_completed} of {current.chunks_total} sections</span>}
    </div>
    {current?.status === 'processing' && current.chunks_total>0 &&
      <progress aria-label="Search preparation progress" value={current.chunks_completed} max={current.chunks_total}/>}
    {current && current.status !== 'ready' && <p className="micro-copy">
      {current.status === 'failed' ? 'Your saved material is available. Search preparation could not finish.' :
        'Your saved material is available while search preparation finishes.'}
    </p>}
    {(error || current?.status === 'failed') && <button className="text-button" onClick={()=>{setError(false);setRevision(v=>v+1);}}>Check again</button>}
  </section>;
}
