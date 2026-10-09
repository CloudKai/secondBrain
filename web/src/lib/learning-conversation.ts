import {z} from 'zod';
const unicode=(limit:number)=>z.string().min(1).refine(text=>Array.from(text).length<=limit);
const replySchema=z.object({text:unicode(2000),citation_ids:z.array(z.string().min(1).max(16)).max(10),gap:z.string().refine(text=>Array.from(text).length<=500).nullable()}).strict().refine(reply=>!!reply.citation_ids.length||!!reply.gap);
const exchangeSchema=z.object({
 id:z.string().uuid(),question:unicode(2000),status:z.enum(['processing','failed','completed']),
 reply:replySchema.nullable(),redacted:z.boolean(),model:z.enum(['gpt-6-luna','gpt-6.1-sol']).nullable(),
 policy_version:z.literal('learning_v1'),created_at:z.string().datetime({offset:true}),completed_at:z.string().datetime({offset:true}).nullable(),
}).strict().refine(item=>item.status==='completed'?(item.model!==null&&item.completed_at!==null&&(item.reply===null)===item.redacted):(item.reply===null&&item.model===null&&item.completed_at===null));
export const lessonConversationSchema=z.object({collection_id:z.string().uuid(),plan_id:z.string().uuid(),lesson_index:z.number().int().min(0).max(3),scope:z.literal('lesson'),source_version:z.number().int().min(1).max(20),evidence_current:z.boolean(),revision:z.number().int().nonnegative(),exchanges:z.array(exchangeSchema).max(50)}).strict().refine(value=>new Set(value.exchanges.map(e=>e.id)).size===value.exchanges.length&&value.exchanges.every((item,index)=>index===0||Date.parse(item.created_at)>Date.parse(value.exchanges[index-1].created_at)||Date.parse(item.created_at)===Date.parse(value.exchanges[index-1].created_at)&&item.id>value.exchanges[index-1].id));
export const conversationSendSchema=z.object({question:unicode(2000).refine(text=>!!text.trim()),expected_revision:z.number().int().nonnegative(),request_id:z.string().uuid()}).strict();
export type ConversationSend=z.infer<typeof conversationSendSchema>;
export type LessonConversation=z.infer<typeof lessonConversationSchema>;
export type ConversationSlot={collectionId:string;planId:string;lessonIndex:number};
export function conversationPath(slot:ConversationSlot){return `/learning/collections/${encodeURIComponent(slot.collectionId)}/plans/${encodeURIComponent(slot.planId)}/lessons/${slot.lessonIndex}/conversation`;}
