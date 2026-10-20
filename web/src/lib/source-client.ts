import {lessonConversationSchema,conversationPath,type ConversationSend} from './learning-conversation';
import {lessonDraftSchema,DraftConflictError,draftPath,type DraftSave,type DraftKind} from './learning-draft';
import {collectionDetailSchema,collectionListSchema} from './collections';
import {indexStatusSchema} from "./index-status";
import {learningSummarySchema,learningGraphSchema,learningCandidatesSchema,learningHistorySchema,learningSnapshotSchema,learningTutorSchema,type LearningRevisionInput,type LearningPreviewInput,type LearningAttemptInput,type LearningActivity,type LearningTutorQuestion} from './learning';
import {researchResultsSchema} from "./research";
import {quizStateSchema,quizAttemptResultSchema,quizErrorBodySchema,type QuizGenerateInput,type QuizSubmitInput} from './quiz';
import {QUIZ_TIMEOUTS,QuizApiError,quizApiErrorFrom} from './quiz-logic';
import {assistantAnswerSchema, type AssistantQuestion} from "./assistant-answer";
import { type TopicCorrection, topicLibrarySchema, topicRecordSchema, topicAnalysisSchema } from "./topic-library";
import { overviewSnapshotSchema } from "./topic-overview";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { studyPageSchema, studySchema, type StudyRecord } from "./study-note";
import { transcriptSchema, videoIdentity } from "./transcript";
import {MAX_CAPTURE_CHARS,pageRangeSchema,rangeQuery,type CaptureRange,type PageRange,type TimeRange} from "./capture-range";

const httpUrl = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//.test(url));
const documentSchema = z
  .object({
    filename: boundedText(1, 200).nullable(),
    page_count: z.number().int().min(1).max(100),
    selected_pages: pageRangeSchema.nullish(),
    pages: z
      .array(
        z
          .object({
            page: z.number().int().min(1).max(100),
            start: z.number().int().min(0).max(MAX_CAPTURE_CHARS),
            end: z.number().int().min(0).max(MAX_CAPTURE_CHARS),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
// Python and Postgres constrain Unicode code points, rather than UTF-16 units.
function boundedText(min: number, max: number) {
  return z.string().refine((value) => {
    const length = Array.from(value).length;
    return length >= min && length <= max;
  }, `Expected ${min}–${max} characters.`);
}
export const sourceSchema = z
  .object({
    source_version: z.number().int().min(1).max(20).optional(),
    id: z.string().uuid(),
    original_url: httpUrl.nullable(),
    canonical_url: z.union([
      httpUrl,
      z.string().regex(/^urn:pdf:sha256:[a-f0-9]{64}$/),
    ]),
    source_kind: z.enum(["article", "pdf", "video"]).optional(),
    document: documentSchema.nullish(),
    transcript: transcriptSchema.nullish(),
    title: boundedText(1, 200),
    captured_text: boundedText(120, MAX_CAPTURE_CHARS),
    captured_at: z.string().datetime({ offset: true }),
    capture_origin: z.enum(["direct", "reader", "pasted", "upload"]),
    coverage: z.enum(["complete", "partial", "unknown"]),
    coverage_detail: boundedText(1, 500),
    study_status: z.literal("pending"),
  })
  .strict()
  .superRefine((source, ctx) => {
    const pdf = source.source_kind === "pdf";
    const video = source.source_kind === "video";
    let invalid =
      !pdf &&
      !video &&
      (source.original_url === null ||
        !!source.document ||
        source.capture_origin === "upload");
    invalid ||= !video && !!source.transcript;
    if (video) {
      const transcript = source.transcript;
      invalid ||=
        source.coverage === "complete" ||
        !source.original_url ||
        !!source.document ||
        !transcript ||
        !["pasted", "upload", "direct"].includes(source.capture_origin);
      if (transcript) {
        invalid ||=
          source.capture_origin === "direct" &&
          (transcript.provider !== "youtube" || transcript.format !== "vtt");
        invalid ||=
          (source.capture_origin === "upload") !==
            (transcript.filename !== null) ||
          transcript.segments[transcript.segments.length - 1].end !==
            Array.from(source.captured_text).length;
        try {
          const identity = videoIdentity(source.original_url ?? "");
          invalid ||=
            identity.provider !== transcript.provider ||
            identity.canonicalUrl !== source.canonical_url;
        } catch {
          invalid = true;
        }
      }
    }
    if (pdf) {
      const doc = source.document;
      invalid ||=
        !doc ||
        !["direct", "upload"].includes(source.capture_origin) ||
        (source.capture_origin === "upload") !== (source.original_url === null);
      invalid ||= source.capture_origin === "upload" && !doc?.filename;
      if (doc) {
        invalid ||=
          doc.pages.length > doc.page_count ||
          (!!doc.selected_pages && (doc.selected_pages.end>doc.page_count || doc.pages[doc.pages.length-1].page>doc.selected_pages.end)) ||
          doc.pages[0].start !== 0 ||
          doc.pages[doc.pages.length - 1].end !==
            Array.from(source.captured_text).length;
        doc.pages.forEach((p, i) => {
          invalid ||=
            p.page !== i + (doc.selected_pages?.start??1) ||
            p.end < p.start ||
            (i > 0 && p.start !== doc.pages[i - 1].end + 1);
        });
      }
    }
    invalid ||=
      source.original_url === null
        ? !source.canonical_url.startsWith("urn:pdf:sha256:")
        : !/^https?:/.test(source.canonical_url);
    if (invalid)
      ctx.addIssue({
        code: "custom",
        message: "Invalid source identity or page locations",
      });
  });
export type SavedSource = z.infer<typeof sourceSchema>;
export const revisionComparisonSchema = z.object({
  source_id:z.string().uuid(), base_version:z.number().int().min(1).max(20),
  candidate_id:z.string().uuid().nullable(), changed:z.boolean(),
  current:sourceSchema, replacement:sourceSchema.nullable(),
}).strict().refine(v=>v.source_id===v.current.id && v.base_version===(v.current.source_version??1) && v.changed===(v.candidate_id!==null) && v.changed===(v.replacement!==null) && (!v.replacement || v.replacement.id===v.source_id && (v.replacement.source_version??1)===Math.min(v.base_version+1,20)));
const reviewSchema=topicAnalysisSchema.nullable();
export const versionHistorySchema=z.object({source_id:z.string().uuid(),current_version:z.number().int().min(1).max(20),versions:z.array(z.object({version:z.number().int().min(1).max(19),captured_at:z.string().datetime({offset:true}),has_note:z.boolean()}).strict()).max(19),correction_review:reviewSchema}).strict();
export const savedVersionSchema=z.object({source:sourceSchema,study:studySchema.nullable()}).strict();
export type RevisionComparison=z.infer<typeof revisionComparisonSchema>;
export type VersionHistory=z.infer<typeof versionHistorySchema>;
export type SavedVersion=z.infer<typeof savedVersionSchema>;
export interface ComparisonInput extends CaptureRange {rawText?:string;file?:File;transcriptText?:string}

const pageSchema = z
  .object({
    sources: z.array(sourceSchema),
    next_offset: z.number().int().nonnegative().nullable(),
  })
  .strict();

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class TranscriptFallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptFallbackError";
  }
}

function quizPath(collectionId:string,planId:string,suffix=''){return `/learning/collections/${encodeURIComponent(collectionId)}/plans/${encodeURIComponent(planId)}/quiz${suffix}`;}

export function createSourceClient(
  settings: { url: string; publicKey: string },
  dependencies: { fetch?: typeof fetch; storage?: Storage } = {},
) {
  if (
    !settings.url ||
    !settings.publicKey ||
    settings.publicKey.startsWith("sb_secret_")
  )
    throw new Error(
      "Configure the Supabase project URL and public publishable key.",
    );
  const fetcher = dependencies.fetch ?? fetch;
  const supabase = createClient(settings.url, settings.publicKey, {
    global: { fetch: fetcher },
    auth: {
      persistSession: true,
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: false,
      storage: dependencies.storage,
    },
  });
  let connecting: Promise<void> | null = null;

  async function ready(): Promise<void> {
    const { data, error } = await supabase.auth.getSession();
    if (error)
      throw new Error(
        "Your library session could not be restored. Retry connecting.",
      );
    if (data.session) return;
    if (!connecting) {
      connecting = (async () => {
        const result = await supabase.auth.signInAnonymously();
        if (result.error || !result.data.session)
          throw new Error(
            "Could not connect your library. Check that anonymous sign-ins are enabled and retry.",
          );
      })().finally(() => {
        connecting = null;
      });
    }
    await connecting;
  }

  async function request(path: string, init?: RequestInit, expectedOwner?:string): Promise<Response> {
    await ready();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session)
      throw new Error("Your library session is unavailable. Retry connecting.");
    if(expectedOwner&&data.session.user.id!==expectedOwner)throw new Error("Your draft session changed. Reopen the collection.");
    let response: Response;
    try {
      response = await fetcher(`/api/v2${path}`, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          "Content-Type":
            init?.body instanceof Blob
              ? init.body.type || "application/octet-stream"
              : "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        signal: init?.signal ?? AbortSignal.timeout(120_000),
      });
    } catch {
      throw new Error(
        "Could not reach the library service. Check the connection and retry.",
      );
    }
    if (response.status===404 && path.endsWith("/learning/collection")) return response;
    if (!response.ok) {
      if(response.status===409&&path.includes("/drafts/"))throw new DraftConflictError("This draft changed in another tab. Compare the saved version before replacing it.");
      if(path.includes('/quiz')){const body:unknown=await response.json().catch(()=>null);const parsed=quizErrorBodySchema.safeParse(body);throw quizApiErrorFrom(response.status,parsed.success?parsed.data:null);}
      if(path.endsWith('/ask') || path === '/research' || path.includes('/learning')) {
        const body:unknown=await response.json().catch(()=>null);
        const detail=z.object({detail:boundedText(1,500)}).safeParse(body);
        throw new Error(detail.success?detail.data.detail:'The assistant is unavailable. Check the connection and retry.');
      }
      if(/\/(revision-check|refresh|versions|correction-review)(?:[/?]|$)/.test(path)) {
        const body:unknown=await response.json().catch(()=>null);const detail=z.object({detail:boundedText(1,500)}).safeParse(body);
        throw new Error(detail.success?detail.data.detail:'Source comparison or refresh is unavailable. Reload and retry.');
      }

      if (path === "/sources/youtube" && response.status === 422) {
        const body: unknown = await response.json().catch(() => null);
        const error = z.object({ detail: boundedText(1, 500) }).safeParse(body);
        throw new TranscriptFallbackError(
          error.success
            ? error.data.detail
            : "YouTube captions are unavailable. Upload or paste the transcript instead.",
        );
      }
      if (
        (path.startsWith("/sources/pdf") ||
          path.startsWith("/sources/video")) &&
        [408, 413, 422].includes(response.status)
      ) {
        const body: unknown = await response.json().catch(() => null);
        const error = z
          .object({ detail: z.string().min(1).max(500) })
          .safeParse(body);
        throw new Error(
          error.success
            ? error.data.detail
            : path.startsWith("/sources/video")
              ? "Use a readable UTF-8 TXT, VTT or SRT transcript up to 1 MB, or paste its text."
              : "This PDF is unsupported. Use an unencrypted selectable-text PDF up to 10 MB and 100 pages.",
        );
      }
      if (path === "/topic-corrections") throw new Error(response.status === 404 ? "This topic or source is no longer available. Reload topics." : response.status === 422 ? "Choose valid topic names and supporting passages, then retry." : "Topic corrections could not be saved. Check the connection and migration, then retry.");
      throw new Error(
        path.includes("topic") && response.status !== 401 && response.status !== 404
          ? "Topic mapping is unavailable. Check the topic migration and worker, then reload topics."
          : path.includes("stud") &&
          response.status !== 401 &&
          response.status !== 404
          ? "Study notes are unavailable. Check the study migration and worker setup, then retry."
          : response.status === 422
            ? "This article could not be captured. Use a public article URL or paste its text."
            : response.status === 401
              ? "Your library session could not be verified. Retry connecting."
              : response.status === 404
                ? "This source is no longer in your library."
                : "Library storage is unavailable. Check the configuration and retry.",
      );
    }
    return response;
  }

  async function parse<T>(
    response: Response,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ): Promise<T> {
    try {
      return schema.parse(await response.json());
    } catch {
      throw new Error(
        "The library returned incomplete material. Retry loading it.",
      );
    }
  }

  return {
    async draftOwner() {
      await ready();const {data,error}=await supabase.auth.getSession();
      if(error||!data.session)throw new Error('Your draft session is unavailable.');
      return z.string().uuid().parse(data.session.user.id);
    },
    onDraftOwnerChange(listener:(owner:string|null)=>void) {
      const {data}=supabase.auth.onAuthStateChange((_event,session)=>listener(session?.user.id??null));
      return ()=>data.subscription.unsubscribe();
    },
    async getLearningConversation(collectionId:string,planId:string,lessonIndex:number) {
      const result=await parse(await request(conversationPath({collectionId,planId,lessonIndex}),{signal:AbortSignal.timeout(10000)}),lessonConversationSchema);
      if(result.collection_id!==collectionId||result.plan_id!==planId||result.lesson_index!==lessonIndex)throw new Error('Unexpected saved conversation. Reload and retry.');
      return result;
    },
    async sendLearningConversation(collectionId:string,planId:string,lessonIndex:number,input:ConversationSend,expectedOwner?:string) {
      const result=await parse(await request(conversationPath({collectionId,planId,lessonIndex}),{method:'POST',body:JSON.stringify(input)},expectedOwner),lessonConversationSchema);
      const exchange=result.exchanges.find(item=>item.id===input.request_id);
      if(result.collection_id!==collectionId||result.plan_id!==planId||result.lesson_index!==lessonIndex||exchange?.question!==input.question||exchange.status!=='completed')throw new Error('This reply was not confirmed saved. Reload or retry the same send.');
      return result;
    },
    async clearLearningConversation(collectionId:string,planId:string,lessonIndex:number,revision:number,expectedOwner?:string) {
      const result=await parse(await request(conversationPath({collectionId,planId,lessonIndex}),{method:'DELETE',body:JSON.stringify({expected_revision:revision}),signal:AbortSignal.timeout(10000)},expectedOwner),lessonConversationSchema);
      if(result.collection_id!==collectionId||result.plan_id!==planId||result.lesson_index!==lessonIndex||result.exchanges.length||result.revision!==revision+1)throw new Error('Conversation clear was not confirmed. Reload to check it.');
      return result;
    },
    async getLearningDraft(collectionId:string,planId:string,lessonIndex:number,kind:DraftKind) {
      const result=await parse(await request(draftPath({collectionId,planId,lessonIndex,kind}),{signal:AbortSignal.timeout(10000)}),lessonDraftSchema);
      if(result.collection_id!==collectionId||result.plan_id!==planId||result.lesson_index!==lessonIndex||result.kind!==kind)throw new Error('Unexpected draft slot. Reload and retry.');
      return result;
    },
    async saveLearningDraft(collectionId:string,planId:string,lessonIndex:number,kind:DraftKind,input:DraftSave,expectedOwner?:string) {
      const result=await parse(await request(draftPath({collectionId,planId,lessonIndex,kind}),{method:'PUT',body:JSON.stringify(input),signal:AbortSignal.timeout(10000)},expectedOwner),lessonDraftSchema);
      if(result.collection_id!==collectionId||result.plan_id!==planId||result.lesson_index!==lessonIndex||result.kind!==kind||result.text!==input.text||result.save_id!==input.save_id||result.revision!==input.expected_revision+1)throw new Error('Unexpected saved draft. Reload and retry.');
      return result;
    },
    async collections(offset=0) {
      const result=await parse(await request(`/learning/collections?offset=${offset}`),collectionListSchema);
      if(result.next_offset!==null&&result.next_offset!==offset+50)throw new Error('Invalid collection pagination. Retry.');
      return result;
    },
    async collection(id:string) {
      const result=await parse(await request(`/learning/collections/${encodeURIComponent(id)}`),collectionDetailSchema);
      if(result.collection.id!==id)throw new Error('The collection changed. Reload and retry.');
      return result;
    },
    async sourceCollection(sourceId:string) {
      const response=await request(`/sources/${encodeURIComponent(sourceId)}/learning/collection`);
      // No learning root exists until the first path preview creates one.
      if(response.status===404)return null;
      const result=await parse(response,collectionDetailSchema);
      if(result.collection.legacy_source_id!==sourceId)throw new Error('The collection changed. Reload and retry.');
      return result;
    },
    async selectCollectionLesson(id:string,planId:string,index:number,revision:number) {
      const result=await parse(await request(`/learning/collections/${encodeURIComponent(id)}/plans/${encodeURIComponent(planId)}/place`,{method:'POST',body:JSON.stringify({lesson_index:index,expected_revision:revision})}),collectionDetailSchema);
      if(result.collection.id!==id||result.learning.selected_plan_id!==planId||result.learning.selected_lesson_index!==index||result.learning.selected_place_revision!==revision+1)throw new Error('The collection place changed. Reload and retry.');
      return result.learning;
    },
    async learningHistory(offset=0) {
      return parse(await request(`/learning/history?offset=${offset}`),learningHistorySchema);
    },
    async learning(sourceId:string) {
      const result=await parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning`),learningSnapshotSchema);
      if(result.source_id!==sourceId)throw new Error('The learning collection changed. Reload and retry.');
      return result;
    },
    async previewLearning(sourceId:string,input:LearningPreviewInput) {
      const result=await parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/preview`,{method:'POST',body:JSON.stringify(input),signal:AbortSignal.timeout(input.evidence_mode==='capture'?150000:120000)}),learningSnapshotSchema);
      if(result.source_id!==sourceId)throw new Error('The learning collection changed. Reload and retry.');
      return result;
    },
    async learningSummary() {
      return parse(await request('/learning/summary'),learningSummarySchema);
    },
    async learningGraph() {
      return parse(await request('/learning/graph'),learningGraphSchema);
    },
    async learningCandidates(sourceId:string,planId:string) {
      const result=await parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/candidates`),learningCandidatesSchema);
      if(result.source_id!==sourceId||result.plan_id!==planId)throw new Error('The learning collection changed. Reload and retry.');
      return result;
    },
    async reviseLearning(sourceId:string,planId:string,input:LearningRevisionInput) {
      const result=await parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/revision`,{method:'POST',body:JSON.stringify(input)}),learningSnapshotSchema);
      if(result.source_id!==sourceId)throw new Error('The learning collection changed. Reload and retry.');
      return result;
    },
    async selectLearningLesson(sourceId:string,planId:string,lessonIndex:number,expectedRevision?:number) {
      const result=await parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/place`,{method:'POST',body:JSON.stringify({lesson_index:lessonIndex,...(expectedRevision===undefined?{}:{expected_revision:expectedRevision})})}),learningSnapshotSchema);
      if(result.source_id!==sourceId)throw new Error('The learning collection changed. Reload and retry.');
      return result;
    },
    async confirmLearning(sourceId:string,planId:string) {
      return parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/confirm`,{method:'POST'}),learningSnapshotSchema);
    },
    async submitLearningAttempt(sourceId:string,planId:string,input:LearningAttemptInput) {
      return parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/attempts`,{method:'POST',body:JSON.stringify(input)}),learningSnapshotSchema);
    },
    async learningFeedback(sourceId:string,attemptId:string) {
      return parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/attempts/${encodeURIComponent(attemptId)}/feedback`,{method:'POST'}),learningSnapshotSchema);
    },
    async learningActivity(sourceId:string,planId:string,input:Omit<LearningActivity,'plan_id'>) {
      return parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/activity`,{method:'POST',body:JSON.stringify(input)}),learningSnapshotSchema);
    },
    async learningTutor(sourceId:string,planId:string,input:LearningTutorQuestion) {
      return parse(await request(`/sources/${encodeURIComponent(sourceId)}/learning/plans/${encodeURIComponent(planId)}/tutor`,{method:'POST',body:JSON.stringify(input)}),learningTutorSchema);
    },
    async quizState(collectionId:string,planId:string,signal?:AbortSignal) {
      return parse(await request(quizPath(collectionId,planId),{signal:signal??AbortSignal.timeout(QUIZ_TIMEOUTS.state)}),quizStateSchema);
    },
    // Generation can take about two minutes and the server keeps working if the page goes away: callers never abort it.
    async generateQuiz(collectionId:string,planId:string,input:QuizGenerateInput) {
      return parse(await request(quizPath(collectionId,planId),{method:'POST',body:JSON.stringify(input),signal:AbortSignal.timeout(QUIZ_TIMEOUTS.generate)}),quizStateSchema);
    },
    async submitQuizAttempt(collectionId:string,planId:string,input:QuizSubmitInput) {
      const result=await parse(await request(quizPath(collectionId,planId,'/attempts'),{method:'POST',body:JSON.stringify(input),signal:AbortSignal.timeout(QUIZ_TIMEOUTS.submit)}),quizAttemptResultSchema);
      if(result.plan_id!==planId||result.quiz_id!==input.quiz_id)throw new QuizApiError({status:200,code:'quiz_storage_unavailable'});
      return result;
    },
    async quizAttempt(collectionId:string,planId:string,attemptId:string) {
      const result=await parse(await request(quizPath(collectionId,planId,`/attempts/${encodeURIComponent(attemptId)}`),{signal:AbortSignal.timeout(QUIZ_TIMEOUTS.submit)}),quizAttemptResultSchema);
      if(result.plan_id!==planId||result.attempt_id!==attemptId)throw new QuizApiError({status:200,code:'quiz_storage_unavailable'});
      return result;
    },
    async quizShortAnswerFeedback(collectionId:string,planId:string,attemptId:string,questionId:string) {
      const result=await parse(await request(quizPath(collectionId,planId,`/attempts/${encodeURIComponent(attemptId)}/feedback/${encodeURIComponent(questionId)}`),{method:'POST',signal:AbortSignal.timeout(QUIZ_TIMEOUTS.feedback)}),quizAttemptResultSchema);
      if(result.plan_id!==planId||result.attempt_id!==attemptId)throw new QuizApiError({status:200,code:'quiz_storage_unavailable'});
      return result;
    },
    ready,
    async indexStatus(id: string, version: number) {
      const result = await parse(await request(`/sources/${encodeURIComponent(id)}/index-status`,
        {signal: AbortSignal.timeout(10_000)}), indexStatusSchema);
      if (result.source_id !== id || result.source_version !== version)
        throw new Error('This source changed. Reload it to check search preparation.');
      return result;
    },
    async research(query: string) {
      const results=await parse(await request('/research',{method:'POST',body:JSON.stringify({query})}),researchResultsSchema);
      if(results.query!==query.trim())throw new Error('The research results do not match your question. Search again.');
      return results;
    },
    async ask(id:string,question:AssistantQuestion) {
      const answer=await parse(await request(`/sources/${encodeURIComponent(id)}/ask`,{method:'POST',body:JSON.stringify(question)}),assistantAnswerSchema);
      if(answer.source_ids[0]!==id || answer.references.some(r=>r.source_id===id&&r.source_version!==question.source_version) || (!question.library&&!question.topic_id&&answer.source_ids.length!==1))throw new Error('The library returned incomplete assistant evidence. Reload and ask again.');
      return answer;
    },
    async get(id:string) {
      const source=await parse(await request(`/sources/${encodeURIComponent(id)}`),sourceSchema);
      if(source.id!==id)throw new Error('The library returned incomplete source evidence. Reload and ask again.');
      return source;
    },
    async topicOverview(topicId: string) {
      const value = await parse(await request(`/topics/${encodeURIComponent(topicId)}/overview`), overviewSnapshotSchema);
      if (value.topic_id !== topicId) throw new Error("The library returned incomplete topic material. Reload topics.");
      return value;
    },
    async setTopicView(topicId: string, viewMode: "combined" | "separate", retry = false) {
      const value = await parse(await request(`/topics/${encodeURIComponent(topicId)}/overview`, { method: 'POST', body: JSON.stringify({view_mode: viewMode, retry}) }), overviewSnapshotSchema);
      if (value.topic_id !== topicId) throw new Error("The library returned incomplete topic material. Reload topics.");
      return value;
    },
    async compareSource(id:string,input:ComparisonInput={}) {
      const query=rangeQuery(input);if(input.file)query.set('filename',input.file.name);const params=query.size?`?${query}`:'';
      const body=input.file??(input.transcriptText!==undefined?new Blob([input.transcriptText],{type:'text/plain;charset=utf-8'}):JSON.stringify({raw_text:input.rawText??null}));
      const result=await parse(await request(`/sources/${encodeURIComponent(id)}/revision-check${params}`,{method:'POST',body}),revisionComparisonSchema);
      if(result.source_id!==id)throw new Error('The comparison source could not be verified. Compare again.');
      return result;
    },
    async refreshSource(id:string,candidateId:string,expectedVersion:number) {
      const source=await parse(await request(`/sources/${encodeURIComponent(id)}/refresh`,{method:'POST',body:JSON.stringify({candidate_id:candidateId,expected_version:expectedVersion})}),sourceSchema);
      if(source.id!==id||(source.source_version??1)!==expectedVersion+1)throw new Error('The refreshed source version could not be verified. Reload your library.');
      return source;
    },
    async sourceVersions(id:string) {
      const data=await parse(await request(`/sources/${encodeURIComponent(id)}/versions`),versionHistorySchema);
      if(data.source_id!==id)throw new Error('The version history could not be verified.');return data;
    },
    async sourceVersion(id:string,version:number) {
      const data=await parse(await request(`/sources/${encodeURIComponent(id)}/versions/${version}`),savedVersionSchema);
      if(data.source.id!==id||(data.source.source_version??1)!==version||(data.study&&(data.study.source_id!==id||(data.study.source_version??1)!==version)))throw new Error('The saved version could not be verified.');return data;
    },
    async reviewSourceAssignments(action:Extract<TopicCorrection,{action:'assign'}>) {
      await request(`/sources/${encodeURIComponent(action.source_id)}/correction-review`,{method:'POST',body:JSON.stringify(action)});
    },
    async correctTopics(action: TopicCorrection) { await request("/topic-corrections", {method:"POST",body:JSON.stringify(action)}); },
    async topicLibrary() { return parse(await request('/topic-library'),topicLibrarySchema); },
    async mapTopics(id: string,retry=false) { return parse(await request(`/sources/${encodeURIComponent(id)}/topics`,{method:'POST',body:JSON.stringify({retry})}),topicRecordSchema); },
    async confirmPlacement(sourceId:string,topicId:string,targetId:string|null) { return parse(await request(`/sources/${encodeURIComponent(sourceId)}/topics/placement`,{method:'POST',body:JSON.stringify({topic_id:topicId,target_id:targetId})}),topicRecordSchema); },
    async list(): Promise<SavedSource[]> {
      const sources: SavedSource[] = [];
      let offset = 0;
      for (;;) {
        const page = await parse(
          await request(`/sources?offset=${offset}`),
          pageSchema,
        );
        sources.push(...page.sources);
        if (page.next_offset === null) return sources;
        if (page.next_offset <= offset)
          throw new Error(
            "The library returned invalid pagination. Retry loading.",
          );
        offset = page.next_offset;
      }
    },
    async save(input: {
      url: string;
      title: string;
      raw_text: string | null;
    }): Promise<SavedSource> {
      return parse(
        await request("/sources", {
          method: "POST",
          body: JSON.stringify(input),
        }),
        sourceSchema,
      );
    },
    async remove(id: string): Promise<void> {
      await request(`/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async savePDF(input: {
      file?: File;
      url?: string;
      title: string;
      pages?: PageRange|null;
    }): Promise<SavedSource> {
      const query=rangeQuery({pages:input.pages});
      if (input.file) {
        if (input.file.size > 10_000_000)
          throw new Error(
            "PDFs must be 10 MB or smaller. Export a smaller document.",
          );
        if (Array.from(input.file.name).length > 200)
          throw new Error("Use a PDF filename with 200 characters or fewer.");
        return parse(
          await request(
            `/sources/pdf?${new URLSearchParams({...Object.fromEntries(query), filename: input.file.name, title: input.title })}`,
            { method: "POST", body: input.file },
          ),
          sourceSchema,
        );
      }
      return parse(
        await request("/sources/pdf-link", {
          method: "POST",
          body: JSON.stringify({ url: input.url, title: input.title, ...(input.pages!==undefined?{pages:input.pages}:{}) }),
        }),
        sourceSchema,
      );
    },
    async importYouTube(input: {
      url: string;
      title: string;
      times?: TimeRange|null;
    }): Promise<SavedSource> {
      rangeQuery({times:input.times});
      if (videoIdentity(input.url).provider !== "youtube")
        throw new TranscriptFallbackError(
          "Automatic import supports YouTube. Upload or paste a transcript for other recording platforms.",
        );
      return parse(
        await request("/sources/youtube", {
          method: "POST",
          body: JSON.stringify(input),
        }),
        sourceSchema,
      );
    },
    async saveVideo(input: {
      url: string;
      title: string;
      file?: File;
      text?: string;
      times?: TimeRange|null;
    }): Promise<SavedSource> {
      videoIdentity(input.url);
      if (input.file && input.text !== undefined)
        throw new Error("Choose a transcript file or paste text, not both.");
      const params = rangeQuery({times:input.times});
      params.set("title",input.title);
      let body: Blob;
      if (input.file) {
        if (input.file.size > 1_000_000)
          throw new Error(
            "Transcripts must be 1 MB or smaller. Export a shorter transcript or paste its text.",
          );
        if (Array.from(input.file.name).length > 200)
          throw new Error(
            "Use a transcript filename with 200 characters or fewer.",
          );
        if (!/\.(txt|vtt|srt)$/i.test(input.file.name))
          throw new Error(
            "Upload UTF-8 TXT, VTT or SRT. Copy and paste transcript text from other formats.",
          );
        params.set("filename", input.file.name);
        body = input.file;
      } else {
        const text = input.text?.trim() ?? "";
        if (Array.from(text).length < 120 || Array.from(text).length > 100_000)
          throw new Error(
            "Paste 120–100,000 transcript characters, or upload a UTF-8 TXT, VTT or SRT file.",
          );
        body = new Blob([text], { type: "text/plain;charset=utf-8" });
      }
      return parse(
        await request(`/sources/video?${params}`, {
          method: "POST",
          body,
          headers: { "X-Video-URL": input.url },
        }),
        sourceSchema,
      );
    },
    async generate(id: string, retry = false): Promise<StudyRecord> {
      return parse(
        await request(`/sources/${encodeURIComponent(id)}/study`, {
          method: "POST",
          body: JSON.stringify({ retry }),
        }),
        studySchema,
      );
    },
    async studies(): Promise<StudyRecord[]> {
      const records: StudyRecord[] = [];
      let offset = 0;
      for (;;) {
        const page = await parse(
          await request(`/studies?offset=${offset}`),
          studyPageSchema,
        );
        records.push(...page.studies);
        if (page.next_offset === null) return records;
        if (page.next_offset <= offset)
          throw new Error(
            "The library returned invalid pagination. Retry loading.",
          );
        offset = page.next_offset;
      }
    },
  };
}

export type SourceClient = ReturnType<typeof createSourceClient>;
