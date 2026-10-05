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

Set `TINYFISH_API_KEY` in the ignored `backend/.env`, or provide it through the
backend process environment. The example file contains only a placeholder.
The development API used the existing process credential during acceptance;
that credential was not copied into `.env`. A separately launched API needs
its own server environment configuration. Never expose this key through Vite
or a client bundle. Existing Supabase/Redis/OpenAI configuration remains needed
for authentication and the saved-source note/topic pipeline.

Start the configured API and study worker using the existing setup instructions.
The authenticated research endpoint is `POST /api/v2/research` with an explicit
`query` of 1–500 characters. Missing configuration/provider failures return
actionable errors rather than example results. Discovery has a 60-second outer
deadline, bounded provider responses and public-only same-publisher redirects.

### Acceptance and limits

182 backend tests, 66 web tests, build/typecheck/lint pass; both independent
reviews clear through `fecfb77`. Real hosted auth/Search/Fetch checks prove no
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
truth, peer review, full-paper access or future availability. Search snippets
are labelled search relevance; original-page and index metadata are distinguished.
Direct response verification can omit resources that block public header
requests. Production deployment/load acceptance remains unverified.

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


## Documentation checked

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
