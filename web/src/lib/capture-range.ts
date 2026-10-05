import {z} from 'zod';
export const MAX_CAPTURE_CHARS=120_000;
export const pageRangeSchema=z.object({start:z.number().int().min(1).max(100),end:z.number().int().min(1).max(100)}).strict().refine(r=>r.end>=r.start,'Choose the last page after the first page.');
export const timeRangeSchema=z.object({start_ms:z.number().int().min(0).max(604800000),end_ms:z.number().int().min(1).max(604800000)}).strict().refine(r=>r.end_ms>r.start_ms,'Choose the end time after the start time.');
export type PageRange=z.infer<typeof pageRangeSchema>;
export type TimeRange=z.infer<typeof timeRangeSchema>;
export interface CaptureRange {pages?:PageRange|null;times?:TimeRange|null}
export interface RangeFields {enabled:boolean;start:string;end:string}
export const wholeSourceFields:RangeFields={enabled:false,start:'',end:''};

export function rangeQuery(input:CaptureRange):URLSearchParams{
 const params=new URLSearchParams();
 if(input.pages&&input.times)throw new Error('Choose PDF pages or transcript times.');
 if(input.pages){const range=pageRangeSchema.safeParse(input.pages);if(!range.success)throw new Error('Choose PDF pages between 1 and 100, with the last after the first.');params.set('page_start',String(range.data.start));params.set('page_end',String(range.data.end));}
 if(input.times){const range=timeRangeSchema.safeParse(input.times);if(!range.success)throw new Error('Choose valid start and end times, with the end after the start.');params.set('start_ms',String(range.data.start_ms));params.set('end_ms',String(range.data.end_ms));}
 if(input.pages===null||input.times===null)params.set('whole_source','true');
 return params;
}
function readTime(text:string):number{
 const match=/^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(text.trim());
 if(!match)throw new Error('Use times such as 0:30 or 1:02:30, with optional milliseconds.');
 return ((Number(match[1]??0)*3600+Number(match[2])*60+Number(match[3]))*1000)+Number((match[4]??'').padEnd(3,'0'));
}
export function selectedRange(kind:'PDF'|'Video',fields:RangeFields):CaptureRange{
 if(!fields.enabled)return kind==='PDF'?{pages:null}:{times:null};
 const result:CaptureRange=kind==='PDF'?{pages:{start:Number(fields.start),end:Number(fields.end)}}:{times:{start_ms:readTime(fields.start),end_ms:readTime(fields.end)}};
 if(kind==='PDF'&&(!/^\d+$/.test(fields.start)||!/^\d+$/.test(fields.end)))throw new Error('Choose both first and last PDF pages.');
 rangeQuery(result);return result;
}
