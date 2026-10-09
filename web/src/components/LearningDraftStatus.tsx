import type {LearningDraftEditor} from '../lib/draft-workspace';
import ReadingText from './ReadingText';

export default function LearningDraftStatus({draft}:{draft:LearningDraftEditor}){
 const {state}=draft;
 const labels={loading:'Restoring draft…',saved:state.saved?.revision?'Draft saved':'No saved draft yet',unsaved:'Unsaved changes',saving:'Saving draft…',error:'Draft not saved',conflict:'Draft conflict',signedout:'Session changed'};
 return <div className="learning-draft-status">
  <p role="status" aria-live="polite">{labels[state.status]}{state.saved?.updated_at&&state.status==='saved'?` · ${new Date(state.saved.updated_at).toLocaleString()}`:''}</p>
  {['unsaved','saving','error'].includes(state.status)&&<p className="micro-copy">Keep this tab open until the draft is saved. Pending recovery covers reloads in this tab.</p>}
  {state.memoryOnly&&state.status!=='saved'&&<p role="alert">Browser recovery storage is unavailable. Keep this page open until the draft is saved.</p>}
  {state.saved&&!state.saved.evidence_current&&<p role="note">This plan’s evidence changed. Your own draft is retained; new practice and tutor replies require current evidence.</p>}
  {state.error&&<p className="study-error" role="alert">{state.error}{state.status==='signedout'?'':' Your text is retained here.'}</p>}
  {state.status==='error'&&<button type="button" className="button secondary" onClick={draft.retry}>Retry draft save</button>}
  {state.conflict&&<section className="draft-conflict" aria-label="Compare conflicting drafts"><h5>Another tab saved a different draft</h5><p>Your text is still in the editor above. Choose which version to keep.</p><h6>Saved version</h6><ReadingText text={state.conflict.text||'(Empty draft)'}/><div className="learning-actions"><button type="button" className="button secondary" onClick={draft.useSaved}>Use saved version</button><button type="button" className="button primary" onClick={draft.replaceSaved}>Replace saved with my draft</button></div></section>}
  <div className="learning-actions"><button type="button" className="text-button" disabled={state.status==='loading'||state.status==='signedout'} onClick={draft.download}>Download this draft</button><button type="button" className="text-button" disabled={!state.text||!!state.conflict||state.status==='loading'||state.status==='signedout'} onClick={()=>draft.edit('')}>Clear saved draft</button></div>
 </div>;
}
