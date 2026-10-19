import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReadingText from '../components/ReadingText';

test('formatted source prose has readable paragraphs and inspectable escaped original text', () => {
  const html = renderToStaticMarkup(createElement(ReadingText,{text:'Keep original\nwording.\n\n<script>alert("x")</script>',source:true}));
  assert.match(html,/Keep original wording\./);
  assert.match(html,/Original captured text/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/Keep original\nwording\./);
});

test('assistant source cards retain numbered exact references including packed passages', async () => {
  const {default:AssistantExcerptCards} = await import('../components/AssistantExcerptCards');
  const id='33333333-3333-4333-8333-333333333333';
  const html=renderToStaticMarkup(createElement(AssistantExcerptCards,{references:[
    {id:id+':p0001',source_id:id,source_version:2,title:'MIT calculus',passage:{id:'p0001',start:0,end:19,excerpt:'A slope is a ratio.',page:1}},
    {id:id+':p0002',source_id:id,source_version:2,title:'MIT calculus',passage:{id:'p0002',start:20,end:38,excerpt:'Keep the limit.',page:2}},
  ],onCitation:()=>{}}));
  assert.equal((html.match(/MIT calculus<\/h4>/g)??[]).length,1);
  assert.match(html,/PDF page 1/);assert.match(html,/PDF page 2/);
  assert.match(html,/Inspect citation 1: MIT calculus, passage p0001/);
  assert.match(html,/Inspect citation 2: MIT calculus, passage p0002/);
  assert.ok(html.indexOf('A slope is a ratio.')<html.indexOf('Keep the limit.'));
});

test('study explanations keep their wording, equations and citation assignments', async () => {
  const {default:StructuredStudy} = await import('../components/StructuredStudy');
  const claim={text:'This may be useful.\nIt is not demonstrated.',citation_ids:['p0001']};
  const html=renderToStaticMarkup(createElement(StructuredStudy,{note:{overview:claim,concepts:[{title:'Scope',...claim}],examples:[],equations:[{expression:'dy/dx = lim Δy/Δx',...claim}],recall:[],references:[{id:'p0001',start:0,end:3,excerpt:'abc'}]},onCitation:()=>{}}));
  assert.equal((html.match(/This may be useful\.\nIt is not demonstrated\./g)??[]).length,3);
  assert.equal((html.match(/Inspect source passage p0001/g)??[]).length,3);
  assert.match(html,/dy\/dx = lim Δy\/Δx/);assert.doesNotMatch(html,/Original captured text/);
});

test('full caption reader groups prose and keeps original cue times inspectable', async () => {
  const {noteFromSavedSource}=await import('./api');
  const {default:CapturedSourceText}=await import('../components/CapturedSourceText');
  const first='A derivative captures the rate at which a quantity changes over time.',second='and these original words stay available in their source cue.';
  const captured=first+'\n'+second;
  const note=noteFromSavedSource({id:'33333333-3333-4333-8333-333333333333',title:'Derivatives',original_url:'https://www.youtube.com/watch?v=9vKqVkMQHKk',canonical_url:'https://www.youtube.com/watch?v=9vKqVkMQHKk',source_kind:'video',captured_text:captured,capture_origin:'pasted',coverage:'unknown',coverage_detail:'Supplied captions',captured_at:'2026-10-08T00:00:00Z',study_status:'pending',transcript:{provider:'youtube',format:'srt',filename:null,segments:[{start:0,end:first.length,start_ms:0,end_ms:3000},{start:first.length+1,end:captured.length,start_ms:3000,end_ms:6000}]}});
  const html=renderToStaticMarkup(createElement(CapturedSourceText,{note}));
  assert.equal((html.match(/class="source-section-location"/g)??[]).length,1);
  assert.match(html,/0:00–0:06/);assert.match(html,/0:00–0:03/);assert.match(html,/0:03–0:06/);
  assert.match(html,/Original caption cues/);assert.equal(note.evidence,captured);
});

test('PDF reading sections and citation links keep the saved page including archived captures', async () => {
  const {noteFromSavedSource}=await import('./api');
  const {default:CapturedSourceText}=await import('../components/CapturedSourceText');
  const {default:SourceEvidence}=await import('../components/SourceEvidence');
  const excerpt='The derivative is the slope\nof the tangent line.';
  const captured=excerpt+'\n\n'+('Original supporting material. '.repeat(4));
  const note=noteFromSavedSource({id:'33333333-3333-4333-8333-333333333333',source_version:2,title:'Archived calculus',original_url:'https://example.com/calculus.pdf',canonical_url:'https://example.com/calculus.pdf',source_kind:'pdf',captured_text:captured,capture_origin:'direct',coverage:'partial',coverage_detail:'Selected page',captured_at:'2026-10-08T00:00:00Z',study_status:'pending',document:{filename:null,page_count:2,selected_pages:{start:2,end:2},pages:[{page:2,start:0,end:captured.length}]}});
  assert.match(renderToStaticMarkup(createElement(CapturedSourceText,{note})),/PDF page 2/);
  const html=renderToStaticMarkup(createElement(SourceEvidence,{note,passage:{id:'p0001',start:0,end:excerpt.length,excerpt,page:2},onFullText:()=>{}}));
  assert.match(html,/https:\/\/example.com\/calculus.pdf#page=2/);
  assert.match(html,/The derivative is the slope of the tangent line\./);
  assert.match(html,/Original captured text/); assert.equal(note.savedSource?.source_version,2);
});

test('a whitespace-only explanation still exposes its existing citation', () => {
  const html=renderToStaticMarkup(createElement(ReadingText,{text:' \n ',children:createElement('button',{'aria-label':'Inspect retained citation'},'1')}));
  assert.match(html,/Inspect retained citation/);
});
