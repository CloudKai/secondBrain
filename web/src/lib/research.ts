import {z} from 'zod';
const publicUrl=z.string().max(2048).url().refine(value=>{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;});
export const researchResultsSchema=z.object({
 query:z.string().min(1).max(500),
 resources:z.array(z.object({
  url:publicUrl,title:z.string().min(1).max(200),authors:z.array(z.string().min(1).max(200)).max(20),organization:z.string().min(1).max(200),date:z.string().min(1).max(100).nullable(),
  kind:z.enum(['paper','documentation','university','article']),capture_kind:z.enum(['article','pdf']),publication_status:z.enum(['preprint','unverified']),metadata_origin:z.enum(['source','search_index','mixed']),relevance:z.string().min(1).max(1000),
 }).strict()).max(6),partial:z.boolean(),
}).strict();
export type ResearchResults=z.infer<typeof researchResultsSchema>;
export type ResearchResource=ResearchResults['resources'][number];
