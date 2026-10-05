import test from 'node:test';
import assert from 'node:assert/strict';
import {citationMatchesSource, type AssistantReference} from './assistant-answer';
import {noteFromSavedSource} from './api';
import {sourceSchema} from './source-client';
import {studySchema} from './study-note';

const id='33333333-3333-4333-8333-333333333333';
const first='Retrieval 🚀 pulls supporting documents', second='and supplies them to the generator.', third='The generator uses that evidence to support a reliable and grounded answer.';
const text=[first,second,third].join('\n');
const source=sourceSchema.parse({id,study_status:'pending',source_version:1,title:'RAG',original_url:'https://www.youtube.com/watch?v=aircAruvnKk',canonical_url:'https://www.youtube.com/watch?v=aircAruvnKk',source_kind:'video',captured_text:text,capture_origin:'pasted',coverage:'unknown',coverage_detail:'Supplied transcript',captured_at:'2026-10-05T00:00:00Z',transcript:{provider:'youtube',format:'vtt',filename:null,segments:[{start:0,end:Array.from(first).length,start_ms:12000,end_ms:18000},{start:Array.from(first).length+1,end:Array.from(first+'\n'+second).length,start_ms:14000,end_ms:16000},{start:Array.from(first+'\n'+second).length+1,end:Array.from(text).length,start_ms:16000,end_ms:20000}]}});
const passage={id:'p0001',start:0,end:Array.from(first+'\n'+second).length,excerpt:first+'\n'+second,page:null,start_ms:12000,end_ms:18000};
const reference:AssistantReference={id:id+':p0001',source_id:id,source_version:1,title:'RAG',passage};

test('browser notes and assistant accept exact grouped captions with original overlapping cue times',()=>{
 assert.equal(citationMatchesSource(reference,source),true);
 const claim={text:'Retrieval supplies evidence.',citation_ids:['p0001']};
 const study=studySchema.parse({source_id:id,source_version:1,status:'succeeded',attempts:1,max_attempts:3,next_attempt_at:'2026-10-05T00:00:00Z',updated_at:'2026-10-05T00:00:00Z',error_code:null,note:{overview:claim,concepts:[{title:'Retrieval',...claim}],examples:[],equations:[],recall:[{question:'What is retrieved?',answer:'Supporting documents.',citation_ids:['p0001']}],references:[passage]}});
 assert.equal(noteFromSavedSource(source,study).study?.note?.references[0].excerpt,first+'\n'+second);
 assert.equal(citationMatchesSource({...reference,passage:{...passage,end_ms:16000}},source),false);
 assert.equal(citationMatchesSource({...reference,passage:{...passage,start_ms:13000}},source),false);
 assert.equal(citationMatchesSource({...reference,passage:{...passage,excerpt:first}},source),false);
 const legacy={...passage,end:Array.from(first).length,excerpt:first};
 assert.equal(citationMatchesSource({...reference,passage:legacy},source),true);
});
