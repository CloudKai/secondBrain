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

### Proposed test boundaries — user confirmation pending

Authenticated discovery API, external search/page HTTP responses, existing
article/PDF save APIs and browser search/open/save flows. Include missing
metadata, unverified/unsafe links, provider outages and no library changes
before saving. No tests will be written at unconfirmed boundaries.


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
User confirmation of proposed TDD boundaries is pending; no implementation or
tests written yet. Native/iOS and its progress tracker remain untouched.
