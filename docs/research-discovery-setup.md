# Live further-study discovery — planned 15 / GitHub #16

## Selected target — 2026-10-05

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

## Progress

GitHub #16 published with acceptance checks. API/UI/save boundaries inspected.
The user approved the proposed TDD boundaries. Local implementation is in
progress; hosted acceptance and review remain pending. Native/iOS and its progress tracker remain untouched.

## Local implementation checkpoint

Authenticated Search → Fetch discovery returns at most six verified public
resources with honest metadata, preprint status and safe publisher redirects.
Research never writes library data; explicit saves use the existing article/PDF
form and study pipeline. Backend API tests demonstrated RED→GREEN for the missing
route and publisher-redirect rejection; the web client demonstrated RED→GREEN
for authenticated search. Eighteen API/capture checks and two client checks pass;
full 179 backend/66 web tests and build/typecheck/lint pass. Live browser search returned three checked resources,
with the library unchanged. Full checks, independent review, remaining hosted
save/browser flows and controlled cleanup are pending.
