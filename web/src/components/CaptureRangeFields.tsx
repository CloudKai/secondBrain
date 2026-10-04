import {useId,useState} from 'react';
import {selectedRange,type RangeFields} from '../lib/capture-range';
interface Props {kind:'PDF'|'Video';value:RangeFields;onChange:(value:RangeFields)=>void;disabled:boolean}
export default function CaptureRangeFields({kind,value,onChange,disabled}:Props){
 const id=useId(),[error,setError]=useState('');
 function update(next:RangeFields){setError('');onChange(next);}
 function validate(){try{selectedRange(kind,value);setError('');}catch(e:unknown){setError(e instanceof Error?e.message:'Choose a valid range.');}}
 return <fieldset className="capture-range" disabled={disabled}>
  <legend>Material to process</legend>
  <label className="range-choice"><input type="checkbox" checked={value.enabled} onChange={e=>update({...value,enabled:e.target.checked})}/>Choose {kind==='PDF'?'PDF pages':'a time range'}</label>
  {!value.enabled&&<p className="micro-copy">Process the whole supported capture by default, within the published limits.</p>}
  {value.enabled&&<>
   <div className="range-inputs">
    <label htmlFor={`${id}-start`}>{kind==='PDF'?'First page':'Start time'}<input id={`${id}-start`} type={kind==='PDF'?'number':'text'} min={kind==='PDF'?1:undefined} max={kind==='PDF'?100:undefined} step={kind==='PDF'?1:undefined} required value={value.start} placeholder={kind==='PDF'?'1':'0:00'} onChange={e=>update({...value,start:e.target.value})} onBlur={validate} aria-describedby={`${id}-help${error?` ${id}-error`:''}`} aria-invalid={!!error}/></label>
    <label htmlFor={`${id}-end`}>{kind==='PDF'?'Last page':'End time'}<input id={`${id}-end`} type={kind==='PDF'?'number':'text'} min={kind==='PDF'?1:undefined} max={kind==='PDF'?100:undefined} step={kind==='PDF'?1:undefined} required value={value.end} placeholder={kind==='PDF'?'10':'10:00'} onChange={e=>update({...value,end:e.target.value})} onBlur={validate} aria-describedby={`${id}-help${error?` ${id}-error`:''}`} aria-invalid={!!error}/></label>
   </div>
   <p className="micro-copy" id={`${id}-help`}>{kind==='PDF'?'Use original PDF page numbers, including both ends. The range is checked against the uploaded or linked PDF.':'Use m:ss or h:mm:ss, optionally with milliseconds. Requires real VTT/SRT cue times. Whole cues that overlap the interval keep their original times; video completeness remains unverified.'}</p>
   {error&&<p className="form-error" id={`${id}-error`} role="alert">{error}</p>}
  </>}
 </fieldset>;
}
