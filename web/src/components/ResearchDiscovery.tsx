import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ExternalLink,FileText,LoaderCircle,Search,Sparkles} from 'lucide-react';
import type {SourceClient} from '../lib/source-client';
import type {ResearchResource,ResearchResults} from '../lib/research';

const kindLabels={paper:'Research paper',documentation:'Official documentation',university:'University resource',article:'Public web source'};
export default function ResearchDiscovery({client,connected,initialQuery,onSave,savedUrl}:{client:SourceClient|null;connected:boolean;initialQuery:string;onSave:(resource:ResearchResource)=>void;savedUrl:(url:string)=>boolean}){
 const [query,setQuery]=useState(initialQuery),[results,setResults]=useState<ResearchResults|null>(null),[working,setWorking]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),busy=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function search(){
  if(!client||!connected||busy.current||!query.trim())return;
  busy.current=true;setWorking(true);setError('');setResults(null);
  try{const found=await client.research(query.trim());if(mounted.current)setResults(found);}
  catch(e:unknown){if(mounted.current)setError(e instanceof Error?e.message:'Search could not finish. Please retry.');}
  finally{busy.current=false;if(mounted.current)setWorking(false);}
 }
 return <div className="discover-page">
  <div className="page-heading"><span className="eyebrow">GO ONE IDEA DEEPER</span><h1>Follow the original thinking<span className="brand-period">.</span></h1><p>Find research papers, official documentation and university material for your next question.</p></div>
  <div className="research-notice"><Sparkles size={19} aria-hidden="true"/><div><strong>A starting point for your next question</strong><p>Search when you need it. Inspect an original, then choose what belongs in your library.</p></div><span className="badge">External research</span></div>
  <form className="research-search" onSubmit={e=>{e.preventDefault();void search();}}>
   <label htmlFor="research-query">What would you like to explore?</label>
   <div><input id="research-query" value={query} maxLength={500} disabled={working} onChange={e=>setQuery(e.target.value)} placeholder="A topic or a question, such as RAG evaluation"/><button className="button primary" type="submit" disabled={working||!connected||!client||!query.trim()}>{working?<LoaderCircle size={16} className="spin" aria-hidden="true"/>:<Search size={16} aria-hidden="true"/>}{working?'Searching…':'Find reliable sources'}</button></div>
   <p className="micro-copy">Your search question is sent to a web search service. Results are external material, separate from your assistant’s saved evidence. Nothing is saved automatically.</p>
  </form>
  {!connected&&<p role="status">Connect your private library before searching.</p>}
  {working&&<p role="status">Searching and checking original resource links…</p>}
  {error&&<div className="study-error" role="alert"><p>{error}</p><button className="text-button" disabled={working} onClick={()=>void search()}>Retry search</button></div>}
  {results&&<>
   <p className="research-result-count" role="status">{results.resources.length} checked {results.resources.length===1?'resource':'resources'} for “{results.query}”</p>
   {results.partial&&<p className="micro-copy">Some links or search results could not be checked and were omitted. Try a more specific question or search again.</p>}
   {!results.resources.length&&<div className="research-empty"><h2>No checked resources to show</h2><p>Try another topic or a more specific question. Your library has not changed.</p></div>}
   <div className="reading-grid">{results.resources.map((resource,i)=><article className={`reading-card tone-${['mint','purple','peach'][i%3]}`} key={resource.url}>
    <div className="reading-card-top"><span className="topic-icon"><FileText size={24} aria-hidden="true"/></span><span className="badge">{kindLabels[resource.kind]} · {resource.capture_kind==='pdf'?'PDF':'Web page'}</span></div>
    <h2>{resource.title}</h2>
    <span className="reading-author">{resource.authors.length?resource.authors.join(', '):'Author not provided'} · {resource.date??'Date not provided'}</span>
    <p className="micro-copy">Publisher host: {resource.organization}</p>
    {resource.publication_status==='preprint'?<span className="badge">Preprint / repository manuscript · review status not confirmed</span>:resource.kind==='paper'&&<span className="badge">Publication review status not confirmed</span>}
    <div className="reading-relevance"><strong>Search relevance</strong><p>{resource.relevance}</p></div>
    <p className="micro-copy">Metadata: {resource.metadata_origin==='source'?'original page extraction':resource.metadata_origin==='mixed'?'page extraction and search index':'search index'}. Inspect the original to confirm details.</p>
    <div className="reading-actions"><a className="button secondary" href={resource.url} target="_blank" rel="noreferrer">Open original <ExternalLink size={14} aria-hidden="true"/></a><button className="text-button" onClick={()=>onSave(resource)}>{savedUrl(resource.url)?'View saved note':'Save to my library'} <ArrowRight size={14} aria-hidden="true"/></button></div>
   </article>)}</div>
   <p className="note-disclosure">Links returned readable public content when checked. Availability and metadata may change. Saving captures the current article or selectable-text PDF through your library’s normal source flow.</p>
  </>}
  {!results&&!working&&!error&&<div className="research-empty"><h2>Start with a question</h2><p>Search results will appear here. Opening the reading list does not start research or change your topic graph.</p></div>}
 </div>;
}
