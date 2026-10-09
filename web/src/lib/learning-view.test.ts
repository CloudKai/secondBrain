import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LearningLessonView from '../components/LearningLessonView';
import type {LearningPlan} from './learning';

export const plan:LearningPlan={id:'55555555-5555-4555-8555-555555555555',path_id:'66666666-6666-4666-8666-666666666666',request_id:'44444444-4444-4444-8444-444444444444',source_id:'33333333-3333-4333-8333-333333333333',source_title:'Evidence',source_version:1,evidence:[],source_members:[],revision:null,base_plan_id:null,branch_of_plan_id:null,goal:'Reason about support',difficulty:'foundation',confirmed_at:'2026-10-09T00:00:00Z',active:true,needs_review:false,model:'gpt-6-luna',policy_version:'learning_v1',created_at:'2026-10-09T00:00:00Z',references:[{id:'p0001',start:0,end:19,excerpt:'Evidence is needed.'}],content:{title:'Understand evidence',outcomes:['Explain relevance and support'],prerequisites:[],coverage:'One source, selected passages',gaps:['Implementation details'],background:[],lessons:[{title:'Relevance and support',outcome:'Explain why similarity is not support',explanation:{text:'Relevant passages still need to support the answer.',citation_ids:['p0001']},example:{text:'Imagine comparing two recipes before cooking.',provenance:'generated_example',citation_ids:[]},check:{kind:'apply',question:'Would you accept a similar but unsupported answer?',criteria:['Distinguishes relevance from support'],hint:'What does similarity establish?',worked_answer:{text:'Check the support first.',citation_ids:['p0001']}}}]} };

test('lesson teaches an outcome and labels generated examples separately from source citations',()=>{
 const html=renderToStaticMarkup(createElement(LearningLessonView,{plan,lessonIndex:0,onCitation:()=>{}}));
 assert.match(html,/Explain why similarity is not support/);
 assert.match(html,/Relevant passages still need to support the answer/);
 assert.match(html,/Generated teaching example/);
 assert.match(html,/Inspect source passage p0001/);
 assert.doesNotMatch(html,/Mastered|Verified answer/);
});

test('learning map exposes teaching order and closed previews without claiming topic mastery',async()=>{
 const {default:LearningMap}=await import('../components/LearningMap');
 const closed={...plan,id:'77777777-7777-4777-8777-777777777777',confirmed_at:null,active:false};
 const html=renderToStaticMarkup(createElement(LearningMap,{data:{source_id:plan.source_id!,selected_plan_id:null,selected_lesson_index:0,plans:[plan,closed],attempts:[],activities:[]},onChoose:()=>{}}));
 assert.match(html,/Suggested teaching order/);assert.match(html,/Preview and confirm/);
 assert.match(html,/0 practice attempts/);assert.match(html,/Source relationships use the separate topic graph/);
 assert.doesNotMatch(html,/Mastered|Topic complete/);
});

test('branch reuses equivalent prior learning context but never completes its new application check',async()=>{
 const {default:SharedLearningContext}=await import('../components/SharedLearningContext');
 const prior={...plan,content:{...plan.content,lessons:[{...plan.content.lessons[0],check:{...plan.content.lessons[0].check,kind:'explain' as const}}]}};
 const branch={...plan,id:'77777777-7777-4777-8777-777777777777',branch_of_plan_id:plan.id,base_plan_id:plan.id};
 const data={source_id:plan.source_id!,selected_plan_id:null,selected_lesson_index:0,plans:[prior,branch],activities:[{plan_id:plan.id,lesson_index:0,kind:'read' as const}],attempts:[{id:'88888888-8888-4888-8888-888888888888',plan_id:plan.id,lesson_index:0,response:'My original conceptual explanation',difficulty:plan.difficulty,status:'pending' as const,feedback:null,created_at:plan.created_at}]};
 const render=(value:LearningPlan)=>renderToStaticMarkup(createElement(SharedLearningContext,{data,plan:value,lessonIndex:0,onReview:()=>{}}));
 assert.match(render(branch),/My original conceptual explanation/);
 assert.match(render(branch),/New application checks still need their own attempt/);
 assert.doesNotMatch(render({...branch,difficulty:'advanced'}),/My original conceptual explanation/);
 assert.doesNotMatch(render({...branch,needs_review:true}),/My original conceptual explanation/);
 const changed={...branch,references:[{...branch.references[0],excerpt:'Different evidence.'}]};
 assert.doesNotMatch(render(changed),/My original conceptual explanation/);
});

test('topic graph activity distinguishes source coverage from collection learning and inconclusive checks',async()=>{
 const {LearningGraphIndicators}=await import('../components/LearningTopicProgress');
 const html=renderToStaticMarkup(createElement(LearningGraphIndicators,{data:{partial:false,collections:[{source_id:plan.source_id!,title:'Evidence',source_available:true,source_ids:[plan.source_id!],path_count:2,studied_lessons:3,practice_attempts:4,provisional_checks:4,flagged_plans:1}]},sourceIds:[plan.source_id!]}));
 assert.match(html,/3 lessons marked studied/);assert.match(html,/4 provisional checks/);
 assert.match(html,/Across paths using these sources/);assert.match(html,/Evidence needs review/);
 assert.doesNotMatch(html,/100%|Topic mastered|4 passed/);
});


test('removed graph anchors link to retained history instead of an unavailable source',async()=>{
 const {LearningGraphIndicators}=await import('../components/LearningTopicProgress');
 const html=renderToStaticMarkup(createElement(LearningGraphIndicators,{data:{partial:false,collections:[{source_id:plan.source_id!,title:'Evidence',source_available:false,source_ids:[plan.source_id!],path_count:1,studied_lessons:1,practice_attempts:1,provisional_checks:0,flagged_plans:1}]},sourceIds:[plan.source_id!]}));
 assert.match(html,/href="#library"/);assert.match(html,/Review retained learning history/);
 assert.doesNotMatch(html,/href="#note\//);
});
