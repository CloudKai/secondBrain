# Live further-study discovery — planned 15 / GitHub #16

## Verified development behavior — 2026-10-05

Planned 15 / GitHub #16 is complete. The reading list performs explicit live
research and shows at most six checked external resources. Original links,
author/date availability, publisher hosts, resource type, relevance, metadata
origin and preprint status are visible. Missing metadata is labelled. Public
response MIME types determine article/PDF capture, including extensionless PDFs;
blocked pages and unverified links are omitted with partial-results feedback.

Search/open actions never save sources or modify the graph. Save to my library
prefills the existing article/PDF form; the learner confirms capture there.
Saved-note evidence gaps open an editable question without starting a search.
No database migration or new persistent discovery store was added. Native/iOS
and its progress tracker were not changed by this slice.

### Runtime configuration

Research now uses the existing server-only `OPENAI_API_KEY` in ignored
`backend/.env` or the backend process environment. No TinyFish key or call is
used. The canonical template no longer includes `TINYFISH_API_KEY`. Never expose
the OpenAI key through Vite or a client bundle. Existing Supabase/Redis settings
remain needed for authentication and the saved-source note/topic pipeline.

OpenAI Responses uses `gpt-4.1-mini` and a required `web_search` tool call, with
one tool call, 2,000 output tokens and `store: false`. Only URLs in completed
search tool results become candidates. Generated prose URLs are ignored.
FastAPI directly downloads public HTML/plain-text/PDF bodies with DNS pinning,
TLS verification and same-publisher redirects; it extracts readable text and
page-provided metadata. Direct checks never send provider keys to source sites.

Start the configured API and study worker using the existing setup instructions.
The authenticated research endpoint is `POST /api/v2/research` with an explicit
`query` of 1–500 characters. Missing configuration/provider failures return
actionable errors rather than example results. Discovery has a 60-second outer
deadline, bounded provider responses and public-only same-publisher redirects.

### Acceptance and limits

The original completion passed 182 backend tests, 66 web tests and
build/typecheck/lint; both reviews cleared `fecfb77`. The provider replacement
passes 188 backend tests (27 discovery tests); both reviews clear through
`a5491c3`. The unchanged frontend retains 66 passing tests and build/typecheck/lint.
Real hosted OpenAI search/direct-fetch checks prove no
source/topic changes before saving. Browser checks cover missing metadata,
original-link opening, explicit article capture, real model/worker notes and
four topics, original passage inspection, empty/partial results, and editable
assistant-gap navigation. Article/PDF API checks prove explicit capture,
extensionless PDF routing, duplicate reuse and cross-owner denial.

The browser-created article and dependent records were removed; reloading
restored the test library to zero. No original learner source was targeted.
Live browser PDF saving was not exercised for this slice. Its capture path has
existing hosted PDF acceptance and new discovery API coverage. A checked link
means readable public content was returned at that time, not a guarantee of
truth, peer review, full-paper access or future availability. Relevance identifies
the explicit search question rather than presenting generated claims as evidence;
original-page and search title metadata are distinguished.
Direct response verification can omit resources that block public downloads.
Discovery downloads are capped at 2 MB per source, including PDFs; larger PDFs
can still be captured separately through the existing 10 MB PDF form. No source
is saved during research verification. Production deployment/load acceptance
remains unverified.

## Provider replacement — 2026-10-05

The user requested no TinyFish usage after the original completion. OpenAI
search and direct fetching replace it; the route/client/UI contracts and explicit
save behavior are preserved. The original selection/checkpoint history below
records the earlier provider and does not configure the current runtime.

Official [OpenAI web search documentation](https://developers.openai.com/api/docs/guides/tools-web-search)
was checked before implementation. It documents required search, completed tool
sources, citation annotations and Responses support for `gpt-4.1-mini`.
The approved API/external HTTP/save/browser seams are reused. A regression first
failed without a TinyFish key, then passed using OpenAI and direct source content,
rejecting any TinyFish call and ignoring generated prose URLs. Provider failure,
incomplete responses, direct page limits, metadata, redirect/ownership and
article/PDF capture checks pass. Real hosted search produced six readable results
with unchanged library/topic reads; browser search produced six documentation/
web resources and left the library empty. Independent standards/spec review of
`e197edc..d465fd9` found only the already identified title provenance correction;
both follow-ups through `a5491c3` report no remaining findings. Directly extracted
titles are now labelled source metadata even when author/date are absent.
No new browser/API source was saved during replacement acceptance.

## Original selected target — historical, 2026-10-05

Not implemented or verified. Planned slices 01–14 are the current verified web
baseline. The user selected the final discovery slice by asking to continue.

### Selected implementation scope

Extend the supplied reading-list design. Add a server-only synchronous, bounded
`POST /api/v2/research` with an explicit learner query (1–500 characters), verified
anonymous authentication, TinyFish Search followed by Fetch verification, and
strict response validation. Run bounded paper/web searches, deduplicate results,
prioritize academic/first-party sources and return at most six inspectable
resources. Reject credential-bearing, private/local and unsupported URLs;
validate redirects. Bound provider response size and request deadlines. Do not
invent metadata or let source content execute instructions.

Results stay local to this browser page. No new persistence tables, migration,
vector provider or model-based link invention. A saved-note gap opens the reading
list with the learner question available to edit and explicitly search. Opening
a result does not save it. Explicit saving reuses current article/PDF capture
and async study/topic paths. Preserve the current mint palette and layout.
Native/iOS and its progress tracker remain untouched.

### Agreed test boundaries — user approved

Authenticated discovery API, external search/page HTTP responses, existing
article/PDF save APIs and browser search/open/save flows. Include missing
metadata, unverified/unsafe links, provider outages and no library changes
before saving. The user approved these boundaries on 2026-10-05.


## Original provider documentation checked — historical

Official TinyFish [Search API](https://docs.tinyfish.ai/search-api) and
[Fetch API](https://docs.tinyfish.ai/fetch-api) inspected on 2026-10-05.
Search exposes ranked URLs and snippets; research-paper results may supply
indexed authors, venue, year and a PDF URL. Fetch exposes final URL, extracted
text and optional metadata, and reports individual failures separately. Use
server-only credentials. Do not infer peer-review status from a repository URL.

No new storage migration is selected. Results are external material until the
learner explicitly saves them. Provider failures must not silently substitute
curated examples as live search results. Existing credentials are checked by
presence only; their values are not printed or committed.

## Selection progress — historical

GitHub #16 published with acceptance checks. API/UI/save boundaries inspected.
The user approved the proposed TDD boundaries. Local implementation is in
progress; hosted acceptance and review remain pending. Native/iOS and its progress tracker remain untouched.

## Local implementation checkpoint — historical

Authenticated Search → Fetch discovery returns at most six verified public
resources with honest metadata, preprint status and safe publisher redirects.
Research never writes library data; explicit saves use the existing article/PDF
form and study pipeline. Backend API tests demonstrated RED→GREEN for the missing
route and publisher-redirect rejection; the web client demonstrated RED→GREEN
for authenticated search. Eighteen API/capture checks and two client checks pass;
full 179 backend/66 web tests and build/typecheck/lint pass. Live browser search returned three checked resources,
with the library unchanged. Full checks, independent review, remaining hosted
save/browser flows and controlled cleanup are pending.
