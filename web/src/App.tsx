import ResearchDiscovery from "./components/ResearchDiscovery";
import SavedAssistant from "./components/SavedAssistant";
import {citationMatchesSource, type AssistantReference} from "./lib/assistant-answer";
import CaptureRangeFields from "./components/CaptureRangeFields";
import {selectedRange,wholeSourceFields,type RangeFields,type CaptureRange} from "./lib/capture-range";
import SavedSourceAssignments from "./components/SavedSourceAssignments";
import { useTopicLibrary } from "./lib/use-topic-library";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  Layers3,
  Library,
  Link2,
  LoaderCircle,
  Maximize2,
  Menu,
  Moon,
  Network,
  PanelRightClose,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { sampleNotes, topicTitles } from "./data";
import CapturedSourceText from "./components/CapturedSourceText";
import TeamsTranscriptHelp from "./components/TeamsTranscriptHelp";
import ZoomTranscriptHelp from "./components/ZoomTranscriptHelp";
import PanoptoTranscriptHelp from "./components/PanoptoTranscriptHelp";
import VideoTranscriptInput from "./components/VideoTranscriptInput";
import {
  formatVideoTime,
  videoIdentity,
  videoMomentUrl,
} from "./lib/transcript";

import type { Note, Page, PanelTab, Topic } from "./types";
import {
  canonicalUrl,
  findNotes,
  createLibrary,
  readLibrary,
  updateLibrary,
} from "./lib/library";
import { noteFromSavedSource } from "./lib/api";
import {
  createSourceClient,
  TranscriptFallbackError,
  type RevisionComparison,
  type SavedSource,
} from "./lib/source-client";
import { AttentionArt, Graph } from "./components/Graph";
import Modal from "./components/Modal";
import Assistant from "./components/Assistant";
import RecallCards from "./components/RecallCards";
import StructuredStudy from "./components/StructuredStudy";
import SourceVersions from "./components/SourceVersions";
import SavedTopicDetails from "./components/SavedTopicDetails";
import { studyLabel, studyMessage } from "./lib/study-note";
import { useSourceStudies } from "./lib/use-source-studies";

type Dialog = "add" | "about" | "delete" | "rename" | "assign" | "merge" | "versions" | null;
// One auth client owns session recovery, including during StrictMode remounts.
const sourceClient = (() => {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return url && publicKey ? createSourceClient({ url, publicKey }) : null;
  } catch {
    return null;
  }
})();
function readRoute(): { page: Page; noteId: string } {
  const [page, id] = window.location.hash.slice(1).split("/");
  return {
    page: ["library", "note", "topics", "discover"].includes(page)
      ? (page as Page)
      : "library",
    noteId: id || "attention",
  };
}
export default function App() {
  const [storage, setStorage] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [storageError, setStorageError] = useState("");
  const [storageAttempt, setStorageAttempt] = useState(0);
  const [route, setRoute] = useState(readRoute);
  const [library, changeLibrary] = useReducer(updateLibrary, undefined, () =>
    createLibrary([], topicTitles),
  );
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All sources"),
    [sort, setSort] = useState("recent");
  const [selectedTopic, setSelectedTopic] = useState("transformers");
  const [panelTab, setPanelTab] = useState<PanelTab>("Topic"),
    [panelOpen, setPanelOpen] = useState(true),
    [expanded, setExpanded] = useState(false),
    [combined, setCombined] = useState(true);
  const [mobileNav, setMobileNav] = useState(false),
    [dialog, setDialog] = useState<Dialog>(null),
    [theme, setTheme] = useState("dark"),
    [toast, setToast] = useState("");
  const [researchSeed,setResearchSeed]=useState('');
  const [captureRange,setCaptureRange]=useState<RangeFields>(wholeSourceFields);
  const [pdfMode, setPdfMode] = useState("upload");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [videoMode, setVideoMode] = useState<"auto" | "supplied">("auto");
  const [transcriptMode, setTranscriptMode] = useState<"paste" | "upload">(
    "paste",
  );
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [sourceTab, setSourceTab] = useState("Article"),
    [sourceUrl, setSourceUrl] = useState(""),
    [sourceTitle, setSourceTitle] = useState(""),
    [rawText, setRawText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const videoProvider = (() => {
    if (sourceTab !== "Video") return null;
    try {
      return videoIdentity(sourceUrl).provider;
    } catch {
      return null;
    }
  })();
  const hasExportGuidance = videoProvider !== null && videoProvider !== "youtube";
  const videoInputMode = hasExportGuidance ? "supplied" : videoMode;
  const [topicName, setTopicName] = useState(""),
    [mergeTarget, setMergeTarget] = useState("");
  const [revisionTarget,setRevisionTarget]=useState('');
  const [revisionComparison,setRevisionComparison]=useState<RevisionComparison|null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width:760px)").matches,
  );
  const {
    notes: baseNotes,
    names: exampleNames,
    rejected,
    mastered,
    topics: exampleTopics,
    connections: exampleConnections,
    demo,
  } = readLibrary(library, query, filter, sort);
  const studies = useSourceStudies(
    sourceClient,
    library.notes,
    storage === "ready",
  );
  const topicMaps = useTopicLibrary(sourceClient,storage === 'ready',library.notes,studies.records);
  const [topicMode,setTopicMode]=useState<'saved'|'examples'>('saved');
  const showingSavedGraph = route.page === 'note' ? library.notes.find(n=>n.id===route.noteId)?.demo !== true : topicMode === 'saved';
  const names=showingSavedGraph?Object.fromEntries(topicMaps.library.topics.map(t=>[t.id,t.title])):exampleNames;
  const [selectedPassage, setSelectedPassage] = useState<{
    sourceId: string;
    id: string;
  } | null>(null);
  const [assistantEvidence,setAssistantEvidence]=useState<{anchor:string;anchorVersion:number;note:Note;reference:AssistantReference}|null>(null);
  const activeNote=useRef<string|undefined>(undefined);
  activeNote.current=route.noteId;
  const enrichNote = (note: Note) =>
    note.savedSource && studies.records[note.id] && (note.savedSource.source_version??1)===(studies.records[note.id].source_version??1)
      ? noteFromSavedSource(note.savedSource, studies.records[note.id])
      : note;
  const notes = baseNotes.map(enrichNote).map(n=>({...n,topics:n.savedSource?(topicMaps.library.maps.find(m=>m.source_id===n.id)?.analysis?.topics.map(t=>t.id)??[]):n.topics}));
  const filtered = findNotes(notes,query,filter,{...exampleNames,...names}).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title):b.addedAt-a.addedAt);
  const topics:Topic[]=showingSavedGraph?topicMaps.library.topics.map(t=>({id:t.id,title:t.title,notes:notes.filter(n=>t.source_ids.includes(n.id)),saved:true,context:t.context,groups:t.groups,description:t.description,uncertain:t.uncertain})):exampleTopics.filter(t=>t.notes.some(n=>n.demo));
  const connections=showingSavedGraph?topicMaps.library.connections.map(c=>({id:c.id,source:c.source,target:c.target,label:c.kind,reason:c.reason,noteIds:c.source_ids,saved:true,evidence:c.evidence})):exampleConnections;

  const currentNote =
    notes.find((n) => n.id === route.noteId) ||
    (route.page === "note" ? undefined : notes[0]);
  const activeAssistantEvidence=assistantEvidence && assistantEvidence.anchor===currentNote?.id && assistantEvidence.anchorVersion===(currentNote.savedSource?.source_version??1)?assistantEvidence:null;
  const evidenceNote=activeAssistantEvidence?.note??currentNote;
  const passage =
    selectedPassage?.sourceId === evidenceNote?.id
      ? (activeAssistantEvidence ? [activeAssistantEvidence.reference.passage] : currentNote?.study?.note?.references)?.find(
          (r) => r.id === selectedPassage?.id,
        )
      : undefined;
  const topic = topics.find((t) => t.id === selectedTopic) || topics[0];
  const assignmentTopics = [
    ...new Set([
      ...topics.map((t) => t.id),
      ...(currentNote?.concepts.map((c) => c.topic) || []),
    ]),
  ];
  useEffect(() => {
    let active = true;
    setStorage("loading");
    setStorageError("");
    if (!sourceClient) {
      setStorage("unavailable");
      setStorageError(
        "Your private library is not connected yet. Examples are available; saving needs library setup.",
      );
      return;
    }
    sourceClient
      .list()
      .then((sources) => {
        if (!active) return;
        changeLibrary({
          type: "load-sources",
          notes: sources.map((source) => noteFromSavedSource(source)),
        });
        setStorage("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStorage("unavailable");
        setStorageError(
          error instanceof Error
            ? error.message
            : "Your library could not be loaded. Retry connecting.",
        );
      });
    return () => {
      active = false;
    };
  }, [storageAttempt]);
  useEffect(() => {
    const handler = () => {
      setRoute(readRoute());
      setMobileNav(false);
      mainRef.current?.focus();
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!narrow || !mobileNav) return;
    sidebarRef.current
      ?.querySelector<HTMLButtonElement>(".mobile-nav-close")
      ?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus(),
        );
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [narrow, mobileNav]);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector("dialog[open]") ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select, [contenteditable]"))
      )
        return;
      event.preventDefault();
      window.location.hash = "library";
      requestAnimationFrame(() =>
        document.getElementById("library-search")?.focus(),
      );
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(page: Page, id?: string) {
    window.location.hash =
      page === "note" ? `note/${id || currentNote?.id || ""}` : page;
    setMobileNav(false);
  }
  function openNote(n: Note) {
    setSelectedPassage(null);
    setAssistantEvidence(null);
    setTopicMode(n.savedSource ? "saved" : "examples");
    setSelectedTopic(n.topics[0]);
    if (n.savedSource) {
      setPanelTab("Sources");
      setPanelOpen(true);
    }
    go("note", n.id);
  }
  function openTopic(id: string) {
    setSelectedTopic(id);
    setPanelTab("Topic");
    setPanelOpen(true);
  }
  function showEvidence(id: string, passageId?: string) {
    setAssistantEvidence(null);
    setSelectedPassage(passageId ? {sourceId:id,id:passageId} : null);
    const n = notes.find((n) => n.id === id);
    if (n) {
      setTopicMode(n.savedSource ? "saved" : "examples");
      go("note", id);
      setPanelTab("Sources");
      setPanelOpen(true);
    }
  }
  function inspectPassage(id: string) {
    setAssistantEvidence(null);
    if (!currentNote) return;
    setSelectedPassage({ sourceId: currentNote.id, id });
    setPanelTab("Sources");
    setPanelOpen(true);
    requestAnimationFrame(() =>
      document.getElementById("source-passage")?.focus(),
    );
  }
  async function inspectAssistantCitation(ref:AssistantReference) {
    if(!sourceClient||!currentNote)return;
    const anchor=currentNote.id;
    const source=await sourceClient.get(ref.source_id);
    if(activeNote.current!==anchor)return;
    if(!citationMatchesSource(ref,source))throw new Error('This evidence changed. Reload the note and ask again.');
    setAssistantEvidence({anchor,anchorVersion:currentNote.savedSource?.source_version??1,note:noteFromSavedSource(source),reference:ref});
    setSelectedPassage({sourceId:source.id,id:ref.passage.id});
    setPanelTab('Sources');setPanelOpen(true);
    requestAnimationFrame(()=>document.getElementById('source-passage')?.focus());
  }
  function findSavedResource(url:string) {
    return notes.find(n=>!!n.savedSource&&!!n.url&&canonicalUrl(n.url)===canonicalUrl(url));
  }
  function showAdd(url = "") {
    setSourceUrl(url);
    setError("");
    setSourceTab(/\.pdf(?:[?#]|$)/i.test(url ?? "") ? "PDF" : "Article");
    setPdfMode(url ? "url" : "upload");
    setPdfFile(null);
    setCaptureRange(wholeSourceFields);
    setVideoMode("auto");
    setDialog("add");
  }
  async function submitSource(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const isPDF = sourceTab === "PDF";
    const isVideo = sourceTab === "Video";
    const uploading = isPDF && pdfMode === "upload";
    let url = "";
    let existingNote: Note | undefined;
    if (uploading) {
      if (!pdfFile) {
        setError("Choose a selectable-text PDF to upload.");
        return;
      }
    } else {
      try {
        canonicalUrl(sourceUrl);
        url = new URL(sourceUrl).href;
      } catch {
        setError("Enter a valid public http or https URL.");
        return;
      }
      let identity = canonicalUrl(url);
      if (isVideo) {
        try {
          identity = videoIdentity(url).canonicalUrl;
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Use a supported recording link.",
          );
          return;
        }
        if (
          videoInputMode === "auto" &&
          videoIdentity(url).provider !== "youtube"
        ) {
          setVideoMode("supplied");
          setError(
            "Upload or paste a transcript for this recording platform. Automatic import supports accessible English YouTube captions.",
          );
          return;
        }
        if (
          videoInputMode === "supplied" &&
          (transcriptMode === "upload"
            ? !transcriptFile
            : !transcriptText.trim())
        ) {
          setError(
            "Upload or paste the transcript for this video. A link alone cannot create a note.",
          );
          return;
        }
      }
      const existing = notes.find(
        (n) =>
          !n.demo &&
          n.url &&
          (isVideo
            ? n.savedSource?.canonical_url === identity
            : canonicalUrl(n.url) === identity),
      );
      existingNote = existing;
      if (
        !isVideo &&
        /(?:youtube\.com|youtu\.be|zoom\.us|panopto|teams\.microsoft|sharepoint\.com|teams\.cloud\.microsoft)/i.test(
          new URL(url).hostname,
        )
      ) {
        setError(
          "Use the Video form and upload or paste the transcript for this recording.",
        );
        return;
      }
      if (!isPDF && !isVideo && /\.pdf(?:[?#]|$)/i.test(url)) {
        setSourceTab("PDF");
        setPdfMode("url");
        setError("Use the PDF form to save this document.");
        return;
      }
    }
    if (!sourceClient || storage !== "ready") {
      setError(
        storageError || "Wait for your library to connect, then retry saving.",
      );
      return;
    }
    let range:CaptureRange={};
    try{range=isPDF?selectedRange('PDF',captureRange):isVideo?selectedRange('Video',captureRange):{};}catch(e:unknown){setError(e instanceof Error?e.message:'Choose a valid range.');return;}
    setBusy(true);
    try {
      const source = existingNote?.savedSource ?? (
        isVideo
          ? videoInputMode === "auto"
            ? await sourceClient.importYouTube({ url, title: sourceTitle, times:range.times })
            : await sourceClient.saveVideo({
                times:range.times,
                url,
                title: sourceTitle,
                file:
                  transcriptMode === "upload"
                    ? (transcriptFile ?? undefined)
                    : undefined,
                text: transcriptMode === "paste" ? transcriptText : undefined,
              })
          : isPDF
            ? await sourceClient.savePDF({
                pages:range.pages,
                file: uploading ? (pdfFile ?? undefined) : undefined,
                url: uploading ? undefined : url,
                title: sourceTitle,
              })
            : await sourceClient.save({
                url,
                title: sourceTitle,
                raw_text: rawText || null,
              })
      );
      const savedBefore = library.notes.find(n=>n.id===source.id && n.savedSource);
      if (savedBefore) {
        const compared=await sourceClient.compareSource(source.id,{...range,file:isPDF&&uploading?(pdfFile??undefined):isVideo&&videoInputMode==='supplied'&&transcriptMode==='upload'?(transcriptFile??undefined):undefined,rawText:!isPDF&&!isVideo&&rawText.trim()?rawText:undefined,transcriptText:isVideo&&videoInputMode==='supplied'&&transcriptMode==='paste'?transcriptText:undefined});
        replaceSavedSource(compared.current);
        openNote(noteFromSavedSource(compared.current));
        if(compared.changed){setRevisionTarget(source.id);setRevisionComparison(compared);setDialog('versions');}
        else{setDialog(null);setToast('No captured changes. Opened your saved note.');}
        return;
      }
      const note=noteFromSavedSource(source);
      changeLibrary({ type: "add-sources", notes: [note] });
      setDialog(null);
      setSourceUrl("");
      setSourceTitle("");
      setRawText("");
      setPdfFile(null);
      setTranscriptFile(null);
      setTranscriptText("");
      openNote(note);
      setToast("Source saved to your private library.");
      await studies.generate(note);
    } catch (err) {
      if (err instanceof TranscriptFallbackError) {
        setVideoMode("supplied");
        setTranscriptMode("paste");
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not save this source. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function replaceSavedSource(source: SavedSource) {
    changeLibrary({type:'refresh-source',note:noteFromSavedSource(source)});
    setSelectedPassage(null);studies.reload();topicMaps.invalidate();
  }
  function openVersions(note:Note){setRevisionTarget(note.id);setRevisionComparison(null);setError('');setDialog('versions');}
  async function removeCurrentSource() {
    if (!currentNote || busy) return;
    setError("");
    setBusy(true);
    try {
      if (currentNote.savedSource) {
        if (!sourceClient || storage !== "ready")
          throw new Error(
            "Reconnect your library before removing this source.",
          );
        await sourceClient.remove(currentNote.id);
      }
      changeLibrary({ type: "remove-source", id: currentNote.id });
      setDialog(null);
      go("library");
      setToast("Source removed. Its topic connections have updated.");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "The source could not be removed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function renameTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!topic || !topicName.trim()) return;
    if(topic.saved){if(!await topicMaps.correct({action:"rename",topic_id:topic.id,title:topicName.trim()}))return;}
    else changeLibrary({ type: "rename-topic", id: topic.id, name: topicName });
    setDialog(null);
    setToast("Topic renamed. Source notes are preserved.");
  }
  async function mergeTopics(e: React.FormEvent) {
    e.preventDefault();
    if (!topic || !mergeTarget) return;
    if(topic.saved){if(!await topicMaps.correct({action:"merge",topic_id:topic.id,target_id:mergeTarget}))return;}
    else changeLibrary({
      type: "merge-topics",
      source: topic.id,
      target: mergeTarget,
    });
    setSelectedTopic(mergeTarget);
    setDialog(null);
    setToast("Topics combined. Original source notes are preserved.");
  }
  function markMaster(id: string) {
    changeLibrary({ type: "toggle-recall", id });
  }
  function topicDetails(t: Topic) {
    if (t.saved) return <SavedTopicDetails key={t.id} topic={t} maps={topicMaps.library.maps} client={sourceClient} enabled={storage === 'ready'} topicError={topicMaps.error} placementBusy={topicMaps.busy} names={names} onReloadTopics={topicMaps.reload} onPlace={topicMaps.place} onOpen={openNote} onEvidence={showEvidence} onRename={()=>{setSelectedTopic(t.id);setTopicName(t.title);setDialog("rename");}} onMerge={()=>{setSelectedTopic(t.id);setMergeTarget(topics.find(x=>x.id!==t.id)?.id??"");setDialog("merge");}} canMerge={topics.length>1}/>;
    return (
      <>
        <div className="panel-topic-icon">
          <Network size={24} />
        </div>
        <span className="eyebrow">SHARED TOPIC</span>
        <h2>{t.title}</h2>
        <p className="panel-description">
          {t.notes.length > 1
            ? `An idea explored across ${t.notes.length} independent sources in your library.`
            : "An idea from one saved source. Add related material to build its connections."}
        </p>
        <div className="topic-meta">
          <span className="dot mint" />
          {t.notes.length} supporting{" "}
          {t.notes.length === 1 ? "source" : "sources"}
        </div>
        {t.notes.length > 1 && (
          <>
            <div className="segmented">
              <button
                className={combined ? "active" : ""}
                onClick={() => setCombined(true)}
              >
                Combine
              </button>
              <button
                className={!combined ? "active" : ""}
                onClick={() => setCombined(false)}
              >
                Keep separate
              </button>
            </div>
            <p className="micro-copy">
              {combined
                ? "See the shared idea, with each source attributed."
                : "Keep each source note as a separate branch."}
            </p>
          </>
        )}
        <div className="topic-overviews">
          {t.notes.map((n) => (
            <div className="topic-overview" key={n.id}>
              <button className="source-title" onClick={() => openNote(n)}>
                <FileText size={15} />
                {n.title}
                <ArrowUpRight size={14} />
              </button>
              {combined && (
                <p>
                  {n.concepts.find((c) => c.topic === t.id)?.text || n.overview}
                </p>
              )}
              <small>
                {n.author} · {n.year}
              </small>
            </div>
          ))}
        </div>
        <div className="panel-actions">
          <button
            className="text-button"
            onClick={() => {
              setTopicName(t.title);
              setDialog("rename");
            }}
          >
            Rename topic <ChevronRight size={14} />
          </button>
          <button
            className="text-button"
            disabled={topics.length < 2}
            onClick={() => {
              setMergeTarget(topics.find((x) => x.id !== t.id)?.id || "");
              setDialog("merge");
            }}
          >
            Merge with a topic <ChevronRight size={14} />
          </button>
        </div>
      </>
    );
  }
  function notePanel() {
    if (!currentNote) return null;
    return (
      <aside
        className={`context-panel ${expanded ? "expanded" : ""}`}
        aria-label="Note context"
      >
        <div className="panel-top">
          <div className="panel-tabs" role="tablist" aria-label="Note context">
            {(["Topic", "Graph", "Sources"] as PanelTab[]).map((tab) => (
              <button
                role="tab"
                tabIndex={panelTab === tab ? 0 : -1}
                id={`tab-${tab}`}
                aria-controls="context-tab-content"
                aria-selected={panelTab === tab}
                key={tab}
                className={panelTab === tab ? "active" : ""}
                onClick={() => setPanelTab(tab)}
                onKeyDown={(event) => {
                  const tabs: PanelTab[] = ["Topic", "Graph", "Sources"];
                  const index = tabs.indexOf(tab);
                  const next =
                    event.key === "ArrowRight"
                      ? tabs[(index + 1) % 3]
                      : event.key === "ArrowLeft"
                        ? tabs[(index + 2) % 3]
                        : event.key === "Home"
                          ? tabs[0]
                          : event.key === "End"
                            ? tabs[2]
                            : undefined;
                  if (!next) return;
                  event.preventDefault();
                  setPanelTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            aria-label={
              expanded ? "Collapse context panel" : "Expand context panel"
            }
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <PanelRightClose size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
        <div
          className="panel-content"
          role="tabpanel"
          id="context-tab-content"
          aria-labelledby={`tab-${panelTab}`}
          tabIndex={0}
        >
          {panelTab === "Topic" &&
            (currentNote.savedSource && !currentNote.topics.length ? <p>Topics appear after this saved note is mapped. Its source passages remain available under Sources.</p> : topic ? (
              topicDetails(topic)
            ) : (
              <p>
                Topics appear after the saved note is mapped. Inspect its passages under Sources.
              </p>
            ))}
          {panelTab === "Graph" && (
            <>
              <span className="eyebrow">FOLLOW THE CONNECTIONS</span>
              <h2>Your topic map</h2>
              <p className="panel-description">
                {currentNote.savedSource
                  ? "Topics and connections are supported by your saved material."
                  : "Built from what you save. Select a topic to explore it."}
              </p>
              <Graph
                cardsOnly={showingSavedGraph && !topicMaps.library.graph_ready}
                topics={topics}
                connections={connections}
                selected={topic?.id}
                onSelect={openTopic}
                compact
              />
              <button
                className="button secondary full"
                onClick={() => go("topics")}
              >
                Explore full graph <ArrowUpRight size={15} />
              </button>
            </>
          )}
          {panelTab === "Sources" && (
            <>
              <span className="eyebrow">TRACE IT TO THE SOURCE</span>
              <h2>Source evidence</h2>
              <div className="evidence-source">
                <FileText size={20} />
                <div>
                  <strong>{evidenceNote!.title}</strong>
                  <small>
                    {evidenceNote!.author} · {evidenceNote!.year}
                  </small>
                </div>
              </div>
              <span className="evidence-label">
                {passage
                  ? passage.page
                    ? `PDF page ${passage.page} · passage ${passage.id}`
                    : passage.start_ms != null && passage.end_ms != null
                      ? `${formatVideoTime(passage.start_ms)}–${formatVideoTime(passage.end_ms)} · passage ${passage.id} · ${evidenceNote!.savedSource?.capture_origin === "direct" ? "retrieved captions" : "supplied transcript"}`
                      : `Passage ${passage.id} · captured-text characters ${passage.start + 1}–${passage.end}`
                  : evidenceNote!.evidenceLabel}
              </span>
              {passage ? (
                <p className="evidence-text" id="source-passage" tabIndex={-1}>
                  {passage.excerpt}
                </p>
              ) : (
                <CapturedSourceText note={evidenceNote!} />
              )}
              {passage && (
                <button
                  className="text-button"
                  onClick={() => setSelectedPassage(null)}
                >
                  Show full captured text
                </button>
              )}
              {evidenceNote!.demo && (
                <p className="micro-copy">
                  This example note includes paraphrased evidence, not a
                  verbatim excerpt or a full-source extraction.
                </p>
              )}
              {evidenceNote!.url ? (
                <a
                  className="button secondary full"
                  href={
                    passage?.page
                      ? `${evidenceNote!.url.split("#")[0]}#page=${passage.page}`
                      : evidenceNote!.kind === "Video"
                        ? videoMomentUrl(evidenceNote!.url, passage?.start_ms)
                        : evidenceNote!.url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {evidenceNote!.kind === "Video" &&
                  passage?.start_ms != null &&
                  evidenceNote!.savedSource?.transcript?.provider === "youtube"
                    ? `Open video at ${formatVideoTime(Math.floor(passage.start_ms / 1000) * 1000)}`
                    : "Open original"}{" "}
                  <ExternalLink size={15} />
                </a>
              ) : (
                <p className="micro-copy">
                  Uploaded PDF · saved page text. The original file is not
                  stored; refer to your local copy for images and layout.
                </p>
              )}
              {evidenceNote!.kind === "Video" && (
                <p className="micro-copy">
                  {evidenceNote!.savedSource?.capture_origin === "direct"
                    ? evidenceNote!.savedSource.coverage_detail
                    : `User-supplied transcript · ${evidenceNote!.savedSource?.transcript?.filename ?? "pasted text"}. No video was fetched or watched.`}
                  {passage?.start_ms != null &&
                    evidenceNote!.savedSource?.transcript?.provider !==
                      "youtube" &&
                    " Times are retained from your transcript; this link opens the recording without seeking to a time."}
                </p>
              )}
            </>
          )}
        </div>
        <div className="panel-foot">
          <Link2 size={13} /> Grounded in your saved material
        </div>
      </aside>
    );
  }
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`sidebar ${mobileNav ? "mobile-open" : ""}`}
        aria-hidden={narrow && !mobileNav}
        inert={narrow && !mobileNav}
      >
        <button
          className="icon-button mobile-nav-close"
          aria-label="Close navigation"
          onClick={() => {
            setMobileNav(false);
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLButtonElement>(".mobile-menu")
                ?.focus(),
            );
          }}
        >
          <X size={18} />
        </button>
        <a className="brand" href="#library">
          <span className="brand-symbol">
            <BrainCircuit size={24} />
          </span>
          <span>
            second brain<span className="brand-period">.</span>
            <small>A PLACE FOR YOUR CURIOSITY</small>
          </span>
        </a>
        <button className="workspace-switch" onClick={() => setDialog("about")}>
          <span className="workspace-avatar">S</span>
          <span>
            Personal workspace
            <small>
              {storage === "ready" ? "Private library" : "Example preview"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button
          className="sidebar-search"
          onClick={() => {
            go("library");
            requestAnimationFrame(() =>
              document.getElementById("library-search")?.focus(),
            );
          }}
        >
          <Search size={16} /> Search your library <span>/</span>
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {(
            [
              { page: "library", title: "My library", icon: Library },
              { page: "topics", title: "Topic graph", icon: Network },
              { page: "note", title: "Study space", icon: BookOpen },
              { page: "discover", title: "Reading list", icon: Sparkles },
            ] as const
          ).map(({ page, title, icon: Icon }) => (
            <a
              key={page}
              href={
                page === "note" ? `#note/${currentNote?.id || ""}` : `#${page}`
              }
              className={`nav-item ${route.page === page ? "active" : ""}`}
              aria-current={route.page === page ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <Icon size={18} />
              {title}
              {page === "library" && (
                <span className="nav-count">{notes.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-topics">
          <div className="nav-label">
            YOUR TOPICS <span>{topics.length}</span>
          </div>
          {topics.map((t, i) => (
            <button
              key={t.id}
              className="sidebar-topic"
              onClick={() => {
                openTopic(t.id);
                go("topics");
              }}
            >
              <span
                className={`dot ${["mint", "purple", "peach", "blue"][i % 4]}`}
              />
              {t.title}
              <span>{t.notes.length}</span>
            </button>
          ))}
          {!topics.length && (
            <p className="micro-copy">Topics grow from saved sources.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={17} />
            </span>
            <strong>Stay curious.</strong>
            <p>Your next big idea starts with one small question.</p>
            <button onClick={() => showAdd()}>
              Add something interesting <Plus size={14} />
            </button>
          </div>
          <button
            className="appearance"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === "dark" ? "Dark" : "Light"} appearance</span>
            <span className="theme-switch">
              <span />
            </span>
          </button>
          <button className="profile" onClick={() => setDialog("about")}>
            <span className="profile-avatar">Y</span>
            <span>
              Your workspace
              <small>
                {demo
                  ? "Exploring example material"
                  : "Learning, one idea at a time"}
              </small>
            </span>
            <CircleHelp size={16} />
          </button>
        </div>
      </aside>
      <div className="app-main" inert={narrow && mobileNav}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  library: "My library",
                  note: "Study space",
                  topics: "Topic graph",
                  discover: "Reading list",
                }[route.page]
              }
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="demo-indicator"
              onClick={() => setDialog("about")}
            >
              <span className="dot mint" />
              {demo ? "Includes examples" : "Private library"}
            </button>
            <button
              className="button primary small-button"
              onClick={() => showAdd()}
            >
              <Plus size={16} />
              Add source
            </button>
          </div>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <div
            className="library-connection"
            role={storage === "unavailable" ? "alert" : "status"}
          >
            <span>
              {storage === "loading"
                ? "Connecting your private library…"
                : storage === "ready"
                  ? "Your saved sources are private and available after reload."
                  : storageError}
            </span>
            {storage === "unavailable" && (
              <button
                className="text-button"
                onClick={() => setStorageAttempt((attempt) => attempt + 1)}
              >
                Retry connection
              </button>
            )}
          </div>
          {route.page === "library" && (
            <div className="library-layout">
              <section className="library-main">
                <div className="page-heading">
                  <span className="eyebrow">
                    YOUR PERSONAL LEARNING LIBRARY
                  </span>
                  <h1>
                    A little curiosity.
                    <br />
                    <span>A lot of understanding.</span>
                  </h1>
                  <p>
                    A home for what you find interesting — and what you learn
                    from it.
                  </p>
                </div>
                <div className="stat-strip">
                  <span>
                    <FileText size={16} />
                    <strong>
                      {notes.filter((note) => note.savedSource).length}
                    </strong>{" "}
                    saved sources
                    {demo &&
                      ` · ${notes.filter((note) => note.demo).length} examples`}
                  </span>
                  <span>
                    <Network size={16} />
                    <strong>{topics.length}</strong> topics to explore
                  </span>
                  <span>
                    <Check size={16} />
                    <strong>{mastered.length}</strong> recall cards understood
                  </span>
                </div>
                {currentNote ? (
                  <section className="resume-card">
                    <div className="resume-content">
                      <span className="resume-label">
                        <span className="dot mint" /> PICK UP AN IDEA
                      </span>
                      <h2>{currentNote.title}</h2>
                      <p>{currentNote.subtitle}</p>
                      <div className="resume-meta">
                        <BookOpen size={14} />
                        {currentNote.concepts.length} key concepts{" "}
                        <span>·</span>{" "}
                        {currentNote.demo
                          ? "Example study note"
                          : `${currentNote.kind} study note`}
                      </div>
                      <button
                        className="button primary"
                        onClick={() => openNote(currentNote)}
                      >
                        Continue learning <ArrowRight size={16} />
                      </button>
                    </div>
                    <AttentionArt />
                  </section>
                ) : (
                  <section className="resume-card empty-hero">
                    <span className="assistant-icon">
                      <BookOpen size={28} />
                    </span>
                    <h2>Give your curiosity a home.</h2>
                    <p>
                      Add your first article to create a note and discover its
                      topics.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => showAdd()}
                    >
                      Add your first source <Plus size={16} />
                    </button>
                  </section>
                )}
                <div className="section-heading">
                  <div>
                    <h2>
                      Your sources <span>{notes.length}</span>
                    </h2>
                    <p>Good ideas, ready to become understanding.</p>
                  </div>
                  <label className="sort-control">
                    <ArrowDownWideNarrow size={15} />
                    <span className="sr-only">Sort sources</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">Recently added</option>
                      <option value="title">Title A–Z</option>
                    </select>
                  </label>
                </div>
                <div className="library-toolbar">
                  <div className="filter-tabs" aria-label="Source filters">
                    {["All sources", "Article", "PDF", "Video", "Paper"].map(
                      (f) => (
                        <button
                          key={f}
                          aria-pressed={filter === f}
                          className={filter === f ? "active" : ""}
                          onClick={() => setFilter(f)}
                        >
                          {f === "Article"
                            ? "Articles"
                            : f === "Paper"
                              ? "Papers"
                              : f}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="search-field">
                    <Search size={15} />
                    <span className="sr-only">Search sources</span>
                    <input
                      id="library-search"
                      placeholder="Search sources…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </label>
                </div>
                <div className="source-grid">
                  {filtered.map((n) => (
                    <button
                      className={`source-card tone-${n.color}`}
                      key={n.id}
                      onClick={() => openNote(n)}
                    >
                      <div className="source-card-art">
                        {n.id === "attention" ? (
                          <AttentionArt small />
                        ) : n.id === "annotated" ? (
                          <div className="code-art">
                            <span>class Transformer:</span>
                            <span>
                              {" "}
                              attention = <b>all_you_need</b>
                            </span>
                            <span> context = learn(tokens)</span>
                            <i>01 &nbsp; 02 &nbsp; 03 &nbsp; 04</i>
                          </div>
                        ) : (
                          <div className="retrieval-art">
                            <span>
                              <FileText size={20} />
                            </span>
                            <i />
                            <span>
                              <BrainCircuit size={26} />
                            </span>
                            <i />
                            <span>
                              <Sparkles size={20} />
                            </span>
                          </div>
                        )}
                        <span className="source-type">
                          <FileText size={11} />
                          {n.kind}
                        </span>
                      </div>
                      <div className="source-card-content">
                        <small>
                          {n.author} · {n.year}
                        </small>
                        <h3>
                          {n.title}
                          <ArrowUpRight size={16} />
                        </h3>
                        <p>{n.subtitle}</p>
                        <div className="topic-chips">
                          {n.topics.slice(0, 2).map((t) => (
                            <span key={t}>{names[t] || t}</span>
                          ))}
                        </div>
                        <div className="source-card-footer">
                          <span>
                            {n.demo
                              ? "Example note"
                              : n.savedSource
                                ? "Saved privately"
                                : "This session"}
                          </span>
                          <span>
                            <BookOpen size={12} />
                            {n.savedSource
                              ? studyLabel(n.study)
                              : `${n.concepts.length} concepts`}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!filtered.length && notes.length > 0 && (
                  <div className="empty-results">
                    <Search size={28} />
                    <h3>No matching sources</h3>
                    <p>Try another title, author, or topic.</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setFilter("All sources");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                <button className="add-source-strip" onClick={() => showAdd()}>
                  <span className="add-icon">
                    <Plus size={19} />
                  </span>
                  <span>
                    <strong>Found something worth understanding?</strong>
                    <small>
                      Add an article, selectable-text PDF or video transcript to
                      your library.
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <div className="library-footnote">
                  <span>
                    <Link2 size={13} />
                    Every idea starts with a source.
                  </span>
                  <button onClick={() => setDialog("about")}>
                    {demo
                      ? "About the example workspace"
                      : "About this session"}{" "}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </section>
              <aside className="library-aside">
                <div className="aside-heading">
                  <span className="eyebrow">THE BIGGER PICTURE</span>
                  <h2>
                    Your knowledge,
                    <br />
                    connected.
                  </h2>
                  <p>
                    Small ideas build a bigger picture.
                    <br />
                    See how your sources fit together.
                  </p>
                </div>
                <Graph
                  cardsOnly={showingSavedGraph && !topicMaps.library.graph_ready}
                  topics={topics}
                  connections={connections}
                  compact
                  onSelect={(id) => {
                    openTopic(id);
                    go("topics");
                  }}
                />
                <div className="map-legend">
                  <span>
                    <span className="dot mint" /> Topic
                  </span>
                  <span>
                    <i /> Source-supported overlap
                  </span>
                </div>
                <button
                  className="button secondary full"
                  onClick={() => go("topics")}
                >
                  Explore topic graph <ArrowUpRight size={15} />
                </button>
                <div className="aside-divider" />
                <div className="aside-section-heading">
                  <h3>Follow your curiosity</h3>
                  <Sparkles size={16} />
                </div>
                {topics.slice(0, 3).map((t, i) => (
                  <button
                    className="curiosity-topic"
                    key={t.id}
                    onClick={() => {
                      openTopic(t.id);
                      go("topics");
                    }}
                  >
                    <span
                      className={`topic-icon tone-${["mint", "purple", "peach"][i]}`}
                    >
                      <Network size={18} />
                    </span>
                    <span>
                      <strong>{t.title}</strong>
                      <small>{t.notes.length} supporting sources</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
                <div className="gentle-note">
                  <span className="quote-mark">“</span>
                  <p>
                    Learning isn’t collecting more.
                    <br />
                    It’s connecting what you know.
                  </p>
                  <span>A SMALL REMINDER FROM SECOND BRAIN</span>
                </div>
              </aside>
            </div>
          )}
          {route.page === "note" &&
            (currentNote ? (
              <div
                className={`study-layout ${!panelOpen ? "panel-hidden" : ""} ${expanded && panelOpen ? "panel-expanded" : ""}`}
              >
                <article className="note-main">
                  <div className="note-toolbar">
                    <button
                      className="text-button"
                      onClick={() => go("library")}
                    >
                      <ArrowLeft size={15} /> Back to library
                    </button>
                    <div>
                      {currentNote.savedSource&&<button className="text-button" disabled={busy} onClick={()=>openVersions(currentNote)}>Source versions &amp; refresh</button>}
                      <button
                        className="icon-button"
                        onClick={() => setDialog("assign")}
                        aria-label="Manage this source’s topics"
                        disabled={Boolean(currentNote.savedSource)&&(!currentNote.study?.note||!topicMaps.library.maps.find(m=>m.source_id===currentNote.id)?.analysis||topicMaps.busy)}
                      >
                        <Layers3 size={17} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => {
                          setError("");
                          setDialog("delete");
                        }}
                        aria-label="Delete source"
                        disabled={busy}
                      >
                        <Trash2 size={17} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setPanelOpen(!panelOpen)}
                        aria-label={
                          panelOpen
                            ? "Hide context panel"
                            : "Show context panel"
                        }
                      >
                        <PanelRightClose size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="note-heading">
                    <div className="note-kicker">
                      <span className={`topic-icon tone-${currentNote.color}`}>
                        <FileText size={18} />
                      </span>
                      <span>
                        {currentNote.savedSource && !currentNote.study?.note
                          ? "SAVED SOURCE"
                          : "STUDY NOTE"}
                      </span>
                      <span className="badge">
                        {currentNote.demo
                          ? "Example"
                          : currentNote.savedSource
                            ? studyLabel(currentNote.study)
                            : "Four-point article"}
                      </span>
                    </div>
                    <h1>{currentNote.title}</h1>
                    <p>{currentNote.subtitle}</p>
                    <div className="note-byline">
                      <span>{currentNote.author}</span>
                      <span>·</span>
                      <span>{currentNote.year}</span>
                      <span>·</span>
                      <span>
                        <BookOpen size={13} />
                        {currentNote.savedSource && !currentNote.study?.note
                          ? "Read-only source"
                          : currentNote.savedSource ? `Read-only note · version ${currentNote.savedSource.source_version??1}` : "Read-only note"}
                      </span>
                    </div>
                    <div className="topic-chips clickable">
                      {currentNote.topics.map((t) => (
                        <button key={t} onClick={() => openTopic(t)}>
                          <span className="dot mint" />
                          {names[t] || t}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  </div>
                  {currentNote.savedSource && studies.error && (
                    <div className="study-error" role="alert">
                      <p>{studies.error}</p>
                      <button className="text-button" onClick={studies.reload}>
                        Retry loading study notes
                      </button>
                    </div>
                  )}
                  {currentNote.study?.note ? (
                    <>
                      <p className="note-disclosure">
                        {currentNote.savedSource?.coverage_detail} This note
                        uses the captured text; verify explanations against the
                        cited passages.
                      </p>
                      <StructuredStudy
                        note={currentNote.study.note}
                        onCitation={inspectPassage}
                      />
                      <RecallCards
                        key={`recall-${currentNote.id}-${currentNote.savedSource?.source_version??1}`}
                        note={currentNote}
                        mastered={mastered}
                        onMaster={markMaster}
                        onCitation={inspectPassage}
                      />
                      {sourceClient&&<SavedAssistant
                        key={`saved-assistant-${currentNote.id}-${currentNote.savedSource?.source_version??1}-${currentNote.study.updated_at}`}
                        sourceId={currentNote.id}
                        sourceVersion={currentNote.savedSource?.source_version??1}
                        topics={topicMaps.library.maps.find(m=>m.source_id===currentNote.id)?.analysis?.topics.filter(t=>!t.uncertain).map(t=>({id:t.id,title:t.title}))??[]}
                        client={sourceClient}
                        onCitation={inspectAssistantCitation}
                        onDiscover={(question)=>{setResearchSeed(Array.from(`${currentNote.title}: ${question}`).slice(0,500).join(''));go('discover');}}
                      />}

                    </>
                  ) : currentNote.savedSource ? (
                    <section className="pending-source">
                      <h2>{studyLabel(currentNote.study)}</h2>
                      <p role="status" aria-live="polite">
                        {studyMessage(currentNote.study)}
                      </p>
                      {!!currentNote.study?.sections_total&&currentNote.study.status!=='succeeded'&&<progress className="section-progress" aria-label="Study sections completed; synthesis follows" value={currentNote.study.sections_completed??0} max={currentNote.study.sections_total+1}/>}
                      {(!currentNote.study ||
                        currentNote.study.status === "failed") && (
                        <button
                          className="button primary"
                          disabled={studies.busy || storage !== "ready"}
                          onClick={() => void studies.generate(currentNote)}
                        >
                          {studies.busy
                            ? "Requesting generation…"
                            : currentNote.study
                              ? "Retry generation"
                              : "Generate study note"}
                        </button>
                      )}
                      <div className="capture-details">
                        <span className="badge">
                          {currentNote.savedSource.coverage === "partial"
                            ? "Partial capture"
                            : currentNote.savedSource.coverage === "unknown"
                              ? "Coverage unconfirmed"
                              : "Page text captured"}
                        </span>
                        <span>
                          {currentNote.savedSource.capture_origin === "pasted"
                            ? "You supplied this text"
                            : currentNote.savedSource.capture_origin ===
                                "reader"
                              ? "Captured through a page reader"
                              : currentNote.savedSource.capture_origin ===
                                  "upload"
                                ? currentNote.kind === "Video"
                                  ? "You uploaded this transcript"
                                  : "You uploaded this PDF"
                                : "Captured from the public source"}
                        </span>
                      </div>
                      <p className="note-disclosure">
                        {currentNote.savedSource.coverage_detail}
                      </p>
                      {currentNote.url && (
                        <a
                          className="text-button"
                          href={currentNote.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open original <ExternalLink size={14} />
                        </a>
                      )}
                      <h3>Captured source text</h3>
                      <CapturedSourceText note={currentNote} />
                    </section>
                  ) : (
                    <>
                      <section className="overview-block">
                        <span className="section-icon">
                          <Sparkles size={17} />
                        </span>
                        <div>
                          <h2>The big picture</h2>
                          <p>
                            {currentNote.overview}{" "}
                            <button
                              className="citation"
                              onClick={() => showEvidence(currentNote.id)}
                              aria-label="Inspect source evidence"
                            >
                              1
                            </button>
                          </p>
                        </div>
                      </section>
                      <section className="concept-section">
                        <span className="eyebrow">LET’S BREAK IT DOWN</span>
                        <h2>The ideas to take with you</h2>
                        {currentNote.concepts.map((c, i) => (
                          <div className="concept" key={`${c.title}-${i}`}>
                            <span className="concept-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <h3>{c.title}</h3>
                              <p>
                                {c.text}{" "}
                                <button
                                  className="citation"
                                  onClick={() => showEvidence(currentNote.id)}
                                  aria-label={`Inspect evidence for key idea ${i + 1}`}
                                >
                                  1
                                </button>
                              </p>
                              <button
                                className="concept-topic"
                                onClick={() => openTopic(c.topic)}
                              >
                                Explore {names[c.topic] || c.topic}{" "}
                                <ArrowUpRight size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </section>
                      {currentNote.equation && (
                        <div className="equation">
                          <span>THE IDEA, IN ONE LINE</span>
                          <code>{currentNote.equation}</code>
                          <button
                            className="citation"
                            onClick={() => showEvidence(currentNote.id)}
                            aria-label="Inspect equation source"
                          >
                            1
                          </button>
                        </div>
                      )}
                      {currentNote.example && (
                        <section className="example-block">
                          <h3>
                            <span className="dot peach" /> Make it concrete
                          </h3>
                          <p>{currentNote.example}</p>
                        </section>
                      )}
                      <RecallCards
                        key={`recall-${currentNote.id}`}
                        note={currentNote}
                        mastered={mastered}
                        onMaster={markMaster}
                      />
                      <Assistant
                        key={`assistant-${currentNote.id}`}
                        note={currentNote}
                        notes={notes.filter((note) => !note.savedSource)}
                        onCitation={showEvidence}
                        onDiscover={() => go("discover")}
                      />
                    </>
                  )}
                  <p className="note-disclosure">
                    {currentNote.savedSource
                      ? "This source is stored in your private library. Your anonymous browser session restores it after reload."
                      : currentNote.demo
                        ? "Curated example note. Evidence is paraphrased; examples are illustrative."
                        : "Imported through the existing four-point article API. Captured text is available under Sources; passage-aligned citations are planned."}
                    {!currentNote.savedSource &&
                      " Example interactions stay in this browser session."}
                  </p>
                </article>
                {panelOpen && notePanel()}
              </div>
            ) : (
              <div className="standalone-empty">
                <BookOpen size={38} />
                <h1>
                  {storage === "loading"
                    ? "Loading your source…"
                    : "This source is not available."}
                </h1>
                <p>
                  {storage === "loading"
                    ? "Restoring your private library."
                    : "Return to your library to choose a saved source or add one."}
                </p>
                <button className="text-button" onClick={() => go("library")}>
                  Back to library
                </button>
                <button className="button primary" onClick={() => showAdd()}>
                  Add source <Plus size={16} />
                </button>
              </div>
            ))}
          {route.page === "topics" && (
            <div className="topics-page">
              <div className="page-heading compact-heading">
                <span className="eyebrow">BUILT FROM YOUR CURIOSITY</span>
                <h1>
                  See the bigger picture<span className="brand-period">.</span>
                </h1>
                <p>
                  Your topics grow from saved sources. Every connection has a
                  reason.
                </p>
              </div>
              <div className="segmented" aria-label="Topic graph material">
                <button className={showingSavedGraph?'active':''} onClick={()=>setTopicMode('saved')}>Saved topics</button>
                <button className={!showingSavedGraph?'active':''} onClick={()=>{changeLibrary({type:'show-examples',notes:sampleNotes});setTopicMode('examples');}}>Example topics</button>
              </div>
              {showingSavedGraph&&<div className="topic-progress" aria-live="polite">
                {topicMaps.error&&<p>{topicMaps.error} <button className="text-button" onClick={topicMaps.reload}>Reload topics</button></p>}
                {topicMaps.library.partial&&<p>Partial topic mapping: some material was outside the current processing limits.</p>}
                {topicMaps.library.maps.filter(m=>m.status!=='succeeded').map(m=><p key={m.source_id}>{notes.find(n=>n.id===m.source_id)?.title??'Saved source'}: {m.status==='failed'?'Topic mapping failed; your note is safe.':'Mapping its main and supporting topics…'} {m.status==='failed'&&<button className="text-button" disabled={topicMaps.busy} onClick={()=>void topicMaps.retry(m.source_id)}>Retry topic mapping</button>}</p>)}
              </div>}
              <div className="graph-workspace">
                <section className="large-graph">
                  <div className="graph-toolbar">
                    <span>
                      <Network size={16} />
                      {topics.length} topics <span className="muted">·</span>{" "}
                      {connections.length} connections
                    </span>
                    {!showingSavedGraph && rejected.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() =>
                          changeLibrary({ type: "restore-connections" })
                        }
                      >
                        Restore connections
                      </button>
                    )}
                    <span className="badge">Source coverage, not mastery</span>
                  </div>
                  <Graph
                    cardsOnly={showingSavedGraph && !topicMaps.library.graph_ready}
                  topics={topics}
                    connections={connections}
                    selected={topic?.id}
                    onSelect={openTopic}
                  />
                  <div className="graph-caption">
                    <span className="dot mint" />
                    Select any topic to see what supports it.
                  </div>
                </section>
                <aside className="graph-detail">
                  {topic ? (
                    topicDetails(topic)
                  ) : (
                    <>
                      <Network size={28} />
                      <h2>A blank canvas for your ideas</h2>
                      <p>Add your first source to discover its topics.</p>
                      <button
                        className="button primary"
                        onClick={() => showAdd()}
                      >
                        Add source
                      </button>
                    </>
                  )}
                </aside>
              </div>
              <div className="section-heading">
                <div>
                  <h2>Why these ideas connect</h2>
                  <p>
                    Connections come from substantive coverage across
                    independent sources.
                  </p>
                </div>
              </div>
              <div className="connection-grid">
                {connections.map((c) => (
                  <div className="connection-card" key={c.id}>
                    <div className="connection-label">
                      <span>{names[c.source] || c.source}</span>
                      <Link2 size={14} />
                      <span>{names[c.target] || c.target}</span>
                    </div>
                    <p><strong>{c.label}</strong> · {c.reason}</p>
                    {c.evidence&&Object.entries(c.evidence).flatMap(([source,ids])=>ids.map(id=><button className="text-button" key={`${source}:${id}`} onClick={()=>showEvidence(source,id)}>Inspect {notes.find(n=>n.id===source)?.title??'source'} · {id}</button>))}
                    <div>
                      <span>{c.noteIds.length} supporting sources</span>
                      {c.saved&&<button disabled={topicMaps.busy} onClick={()=>void topicMaps.correct({action:"connection",source:c.source,target:c.target,state:"accepted"})}>{topicMaps.library.connection_decisions.some(d=>d.state==="accepted"&&[d.source,d.target].includes(c.source)&&[d.source,d.target].includes(c.target))?"Connection accepted":"Accept connection"}</button>}
                      <button
                        disabled={c.saved && topicMaps.busy}
                        onClick={() => {
                          if(c.saved){void topicMaps.correct({action:"connection",source:c.source,target:c.target,state:"rejected"});return;}
                          changeLibrary({
                            type: "reject-connection",
                            source: c.source,
                            target: c.target,
                          });
                          setToast("Connection removed for this session.");
                        }}
                      >
                        Reject connection <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {showingSavedGraph&&topicMaps.library.connection_decisions.filter(d=>d.state==="rejected").map(d=><div className="connection-card" key={`${d.source}:${d.target}`}><div className="connection-label"><span>{names[d.source]??"Topic no longer supported"}</span><Link2 size={14}/><span>{names[d.target]??"Topic no longer supported"}</span></div><p>You rejected this connection. It stays rejected through later automatic organization and topic merges.</p><button className="text-button" disabled={topicMaps.busy} onClick={()=>void topicMaps.correct({action:"connection",source:d.source,target:d.target,state:"accepted"})}>Accept if supported</button></div>)}
                {!connections.length && (
                  <div className="empty-results">
                    <Link2 size={25} />
                    <h3>Let connections grow naturally.</h3>
                    <p>
                      At least two independent sources need to cover related
                      topics before a connection appears.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {route.page === "discover" && <ResearchDiscovery
            key={researchSeed} client={sourceClient} connected={storage==='ready'} initialQuery={researchSeed}
            savedUrl={url=>!!findSavedResource(url)}
            onSave={resource=>{
              const existing=findSavedResource(resource.url);
              if(existing){openNote(existing);return;}
              showAdd(resource.url);setSourceTab(resource.capture_kind==='pdf'?'PDF':'Article');
              setSourceTitle(resource.title);setRawText('');
            }}
          />}

        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            {
              add: "Add a little curiosity",
              about: "A place to learn, thoughtfully",
              delete: "Remove this source?",
              rename: "Give this topic a better name",
              assign: "Organize this source",
              merge: "Combine two topics",
              versions: "Source versions and refresh",
            }[dialog]
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "add" && (
            <>
              <div className="source-input-tabs">
                {["Article", "PDF", "Video"].map((t) => (
                  <button
                    aria-pressed={sourceTab === t}
                    key={t}
                    className={sourceTab === t ? "active" : ""}
                    disabled={busy}
                    onClick={() => {
                      setSourceTab(t);
                        setCaptureRange(wholeSourceFields);
                      setError("");
                    }}
                  >
                    {t === "Article" ? (
                      <Link2 size={16} />
                    ) : t === "PDF" ? (
                      <Upload size={16} />
                    ) : (
                      <FileText size={16} />
                    )}{" "}
                    {t}
                  </button>
                ))}
              </div>
              <form onSubmit={submitSource}>
                <p className="modal-intro">
                  {sourceTab === "Video"
                    ? "Import accessible English YouTube captions, or upload/paste a transcript for YouTube, Teams/SharePoint, Zoom or Panopto. Real caption times are retained."
                    : sourceTab === "PDF"
                      ? "Upload a selectable-text PDF or save a direct public PDF link. Notes cite the original PDF page numbers."
                      : "Save a public web article to your private library and reopen its captured text and generated study note after reload. Saved notes include citations you can inspect."}
                </p>
                {sourceTab === "Video" && (
                  <div
                    className="source-input-tabs"
                    aria-label="Video import method"
                  >
                    <button
                      type="button"
                      disabled={busy || hasExportGuidance}
                      aria-pressed={videoInputMode === "auto"}
                      className={videoInputMode === "auto" ? "active" : ""}
                      onClick={() => {
                        setVideoMode("auto");
                        setError("");
                      }}
                    >
                      Import YouTube captions
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={videoInputMode === "supplied"}
                      className={videoInputMode === "supplied" ? "active" : ""}
                      onClick={() => {
                        setVideoMode("supplied");
                        setError("");
                      }}
                    >
                      Upload or paste
                    </button>
                  </div>
                )}
                {sourceTab === "PDF" && (
                  <div className="source-input-tabs">
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={pdfMode === "upload"}
                      className={pdfMode === "upload" ? "active" : ""}
                      onClick={() => {
                        setPdfMode("upload");
                        setError("");
                      }}
                    >
                      Upload PDF
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={pdfMode === "url"}
                      className={pdfMode === "url" ? "active" : ""}
                      onClick={() => {
                        setPdfMode("url");
                        setError("");
                      }}
                    >
                      PDF link
                    </button>
                  </div>
                )}
                {sourceTab === "PDF" && pdfMode === "upload" ? (
                  <>
                    <label className="form-label" htmlFor="pdf-file">
                      PDF file
                    </label>
                    <input
                      key="pdf-upload"
                      id="pdf-file"
                      type="file"
                      accept="application/pdf,.pdf"
                      required
                      disabled={busy}
                      aria-describedby="source-support"
                      onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    />
                  </>
                ) : (
                  <>
                    <label className="form-label" htmlFor="source-url">
                      {sourceTab === "Video"
                        ? "Video or recording URL"
                        : sourceTab === "PDF"
                          ? "Public PDF URL"
                          : "Article URL"}
                    </label>
                    <input
                      key="source-url"
                      id="source-url"
                      type="url"
                      required
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder={
                        sourceTab === "Video"
                          ? "https://www.youtube.com/watch?v=..."
                          : sourceTab === "PDF"
                            ? "https://example.com/document.pdf"
                            : "https://example.com/an-interesting-idea"
                      }
                      disabled={busy}
                      aria-describedby="source-support"
                    />
                  </>
                )}
                <label className="form-label" htmlFor="source-title">
                  {sourceTab !== "Article" ? "Topic title" : "Title"}{" "}
                  <span>optional</span>
                </label>
                <input
                  id="source-title"
                  maxLength={200}
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder={
                    sourceTab !== "Article"
                      ? "e.g. Algebra and calculus"
                      : "Give your source a recognizable name"
                  }
                  disabled={busy}
                />
                {videoProvider === "teams" && (
                  <TeamsTranscriptHelp url={sourceUrl} />
                )}
                {videoProvider === "zoom" && (
                  <ZoomTranscriptHelp url={sourceUrl} />
                )}
                {videoProvider === "panopto" && (
                  <PanoptoTranscriptHelp url={sourceUrl} />
                )}
                {sourceTab === "Video" && videoInputMode === "supplied" && (
                  <VideoTranscriptInput
                    mode={transcriptMode}
                    onMode={setTranscriptMode}
                    onFile={setTranscriptFile}
                    text={transcriptText}
                    onText={setTranscriptText}
                    busy={busy}
                  />
                )}
                {(sourceTab==='PDF'||sourceTab==='Video')&&<CaptureRangeFields kind={sourceTab} value={captureRange} onChange={setCaptureRange} disabled={busy}/>}
                {sourceTab === "Article" && (
                  <details className="paste-details">
                    <summary>
                      Have the article text? Paste it as a fallback.
                    </summary>
                    <label className="form-label" htmlFor="article-text">
                      Article text <span>up to 120,000 characters</span>
                    </label>
                    <textarea
                      id="article-text"
                      rows={5}
                      value={rawText}
                      maxLength={120000}
                      disabled={busy}
                      onChange={(e) => setRawText(e.target.value)}
                    />
                  </details>
                )}
                <p className="support-copy" id="source-support">
                  <CircleHelp size={15} />
                  {sourceTab === "Video"
                    ? videoInputMode === "auto"
                      ? "English YouTube captions only, when anonymously accessible. Missing, restricted or blocked captions need upload/paste. No audio/video is downloaded or watched and no provider account is connected. Up to 2,000 cues and 120,000 captured characters; video completeness is unverified."
                      : "Supply UTF-8 TXT, VTT or SRT up to 1 MB and 2,000 timed cues, or paste 120–100,000 characters. Up to 120,000 readable characters are captured; omitted text is labelled. TXT is untimed; paste VTT/SRT to retain times. For DOCX or other exports, paste the readable text. Transcripts are user-supplied; the app does not retrieve or watch the video or connect provider accounts."
                    : sourceTab === "PDF"
                      ? "Selectable-text PDFs: up to 10 MB, 100 pages and 120,000 captured characters. Missing or omitted text is labelled. Scanned-only and encrypted files are unsupported. Images and layout are not extracted. Uploads retain page text and filename; the original file is not stored."
                      : "Public HTTP(S) articles: up to 2 MB per download and 120,000 captured characters. Incomplete coverage is labelled. Use the PDF tab for selectable-text PDFs or the Video tab with an uploaded/pasted transcript."}
                </p>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                {busy && (
                  <p className="processing-status" role="status">
                    Capturing and saving the{" "}
                    {sourceTab === "Video"
                      ? videoInputMode === "auto"
                        ? "accessible YouTube captions"
                        : "supplied transcript"
                      : sourceTab === "PDF"
                        ? "PDF"
                        : "article"}
                    , then requesting its study note.
                  </p>
                )}
                <div className="modal-footer">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setDialog(null)}
                  >
                    {busy ? "Keep browsing" : "Cancel"}
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || storage !== "ready"}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle size={16} className="spin" />
                        Saving source…
                      </>
                    ) : (
                      <>
                        {sourceTab === "Video" && videoInputMode === "auto"
                          ? "Import captions"
                          : "Save source"}{" "}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
          {dialog === "about" && (
            <>
              <p className="modal-intro">
                Second Brain turns saved material into a place to understand,
                connect, and recall ideas.
              </p>
              <div className="about-block">
                <strong>What works in this browser slice</strong>
                <p>
                  Library search, read-only notes, saved topic views,
                  source evidence, recall practice, and an assistant grounded in saved passages. Articles, PDFs, accessible English YouTube captions
                  and supplied video transcripts have persistent structured
                  notes and inspectable citations when the study worker is
                  configured. Confirmed topic placements, cited combined
                  overviews, separate source branches, topic renames and merges,
                  source assignments, and connection decisions persist in your library. On-demand research checks external resource links and lets you explicitly save articles or PDFs.
                </p>
                <strong>What is still planned</strong>
                <p>
                  Automatic Teams/Zoom/Panopto transcript access,
                  linked accounts, and production deployment.
                </p>
                <strong>Your data</strong>
                <p>
                  Saved sources and generated notes use your private anonymous
                  library and reopen after reload. Clearing browser data can
                  lose access to that session. Confirmed topic placements and
                  Combine/Keep separate choices and saved-topic corrections persist. Example material,
                  example topic corrections, and recall progress stay in memory; examples use
                  labelled paraphrased evidence.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="button secondary"
                  onClick={() => {
                    if (demo) {
                      changeLibrary({ type: "hide-examples" });
                      go("library");
                    } else
                      changeLibrary({
                        type: "show-examples",
                        notes: sampleNotes,
                      });
                    setDialog(null);
                  }}
                >
                  {demo ? "Hide example material" : "Load example material"}
                </button>
                <button
                  className="button primary"
                  onClick={() => setDialog(null)}
                >
                  Keep exploring <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
          {dialog === "delete" && currentNote && (
            <>
              <p className="modal-intro">
                Remove “{currentNote.title}” from{" "}
                {currentNote.savedSource
                  ? "your private library"
                  : "this session"}
                ? Its topic coverage and connections will update. Other source
                notes are preserved.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-footer">
                <button
                  className="button secondary"
                  onClick={() => setDialog(null)}
                >
                  Keep source
                </button>
                <button
                  className="button danger"
                  onClick={removeCurrentSource}
                  disabled={busy}
                >
                  {busy ? "Removing source…" : "Remove source"}{" "}
                  <Trash2 size={15} />
                </button>
              </div>
            </>
          )}
          {dialog === "rename" && topic && (
            <form onSubmit={renameTopic}>
              {topic.saved&&topicMaps.error&&<p role="alert" className="form-error">{topicMaps.error}</p>}
              <p className="modal-intro">
                Use a name that makes sense to you. Supporting source notes stay
                intact.
              </p>
              <label htmlFor="topic-name" className="form-label">
                Topic name
              </label>
              <input
                id="topic-name"
                required
                maxLength={80}
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
              />
              <div className="modal-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={topicMaps.busy}>
                  Save name <Check size={15} />
                </button>
              </div>
            </form>
          )}
          {dialog === "merge" && topic && (
            <form onSubmit={mergeTopics}>
              {topic.saved&&topicMaps.error&&<p role="alert" className="form-error">{topicMaps.error}</p>}
              <p className="modal-intro">
                Merge “{topic.title}” into another topic. Original source notes
                and their evidence will be preserved.
              </p>
              <label className="form-label" htmlFor="merge-target">
                Keep this topic
              </label>
              <select
                id="merge-target"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                {topics
                  .filter((t) => t.id !== topic.id)
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <div className="modal-footer">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={topicMaps.busy}>
                  Merge topics <Layers3 size={15} />
                </button>
              </div>
            </form>
          )}
          {dialog === 'versions' && sourceClient && (()=>{const note=notes.find(n=>n.id===revisionTarget);return note?.savedSource?<SourceVersions key={note.id} note={note} client={sourceClient} initial={revisionComparison} onApplied={(source,active)=>{replaceSavedSource(source);if(active)setToast(`Source refreshed to version ${source.source_version??1}. Creating its new study note.`);}} onReviewed={()=>topicMaps.invalidate()} onClose={()=>setDialog(null)}/>:<p>This source is no longer available.</p>;})()}
          {dialog === "assign" && currentNote?.savedSource && <SavedSourceAssignments key={currentNote.id} note={currentNote} library={topicMaps.library} busy={topicMaps.busy} error={topicMaps.error} onSave={topicMaps.correct} onDone={()=>{setDialog(null);}}/>}
          {dialog === "assign" && currentNote && !currentNote.savedSource && (
            <>
              <p className="modal-intro">
                Correct which existing topics this source belongs to. Your study
                note stays read-only.
              </p>
              <div className="assignment-list">
                {assignmentTopics.map((id) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={currentNote.topics.includes(id)}
                      onChange={(e) =>
                        changeLibrary({
                          type: "assign-topic",
                          noteId: currentNote.id,
                          topicId: id,
                          assigned: e.target.checked,
                        })
                      }
                    />
                    {names[id] || id}
                  </label>
                ))}
              </div>
              <div className="modal-footer">
                <button
                  className="button primary"
                  onClick={() => {
                    setDialog(null);
                    setToast("Topic assignments updated for this session.");
                  }}
                >
                  Done <Check size={15} />
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
