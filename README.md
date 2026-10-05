# Second Brain

### A connected study library for articles, PDFs and video transcripts.

Second Brain helps you turn learning material into structured notes, understand
how topics connect and revisit what you have learned. Bring in an article, a PDF
or a supported video link, then explore the ideas with citations, topic overviews
and a study assistant.

## From saved material to understanding

### Study notes you can trace back to the source

Each saved source gets its own note with an overview, key concepts and recall
questions. Examples and equations appear when the material supports them.
Click a citation number to read the supporting passage and open the original
source, including a PDF page or video timestamp when available.

### See how your topics connect

Your library starts with topic cards. As you save related material, a graph
shows meaningful connections supported by your sources. For example, notes
about retrieval-augmented generation, agents and prompt engineering can reveal
connections between the AI concepts you are studying.

Connections appear when at least two saved sources support a shared topic or
an explainable relationship. You can rename topics, merge duplicates, correct
where a source belongs, and accept or reject connections.

### Bring different sources together

Keep an article's notes separate from a lecture's notes, then generate a combined
topic overview when you want the bigger picture. Overviews retain references to
the original material and highlight disagreements between sources.

### Ask questions about your learning material

The study assistant answers from your saved material and includes citations.
It starts with the current note. Select **Ask this topic**, **Ask my library**,
or both to broaden the material it uses. When the saved evidence does not answer
your question, the assistant tells you.

### Find your next resource

Search for further reading when you want to go deeper. Browse relevant papers,
documentation and other public resources, inspect their original links, and
choose what to add to your library. Searching or opening a result does not save
it automatically.

### Practice and keep your library current

Use recall questions to check your understanding before revealing the answers.
For longer sources, choose PDF pages or a video time range to focus your study.
Refresh a source when it changes and revisit its earlier saved versions.

## How to use it

1. **Add material.** Paste a public article or supported video link, upload a PDF,
   or provide a transcript.
2. **Read your note.** Review the main ideas and click citations to inspect the
   passages behind them.
3. **Explore connections.** Open a topic overview or the graph, and correct the
   organization when needed.
4. **Check your understanding.** Try the recall questions or ask the assistant
   about your saved material.
5. **Go deeper.** Search for additional resources and save the ones you want to
   study next.

## What you can add

| Material | What is supported today |
| --- | --- |
| Web articles | Public web links, with a pasted-text fallback |
| PDFs | File uploads and public links containing selectable text |
| YouTube videos | English captions when publicly accessible; upload or paste a transcript if retrieval is unavailable |
| Teams, Zoom and Panopto recordings | Recording links accompanied by an uploaded or pasted transcript |
| Transcript files | TXT, VTT and SRT, preserving supplied timestamps and speaker labels |

Video notes come from captions or transcripts. Private lecture recordings need a
transcript you can access and provide. Scanned PDFs need selectable text; OCR is
not currently available. Notes and assistant answers currently use English.

## What the citation numbers mean

A number links an explanation to an excerpt from your saved source. The same
number can appear more than once when the same passage supports several points.

Text excerpts follow paragraph and sentence boundaries where possible. Video
excerpts group adjacent captions into readable passages, using the timestamps
provided by the transcript. PDF excerpts retain their original page. You can
read the evidence yourself to judge whether it supports the explanation.

## Architecture at a glance

The browser brings your learning material into the library. The API captures
sources, the background worker creates notes and topic mappings, and saved
evidence supports the graph, overviews and assistant. Supabase stores the library
and manages access; OpenAI supports generation and on-demand research.

![Second Brain architecture: browser, authentication, source capture, saved library, AI models and background processing](docs/architecture/architecture.svg)

Created with [Archify](https://github.com/tt-a1i/archify). For zoom, themes and
component details, download the [interactive map](docs/architecture/architecture.html)
and open the HTML file in your browser. See [how the parts work together](docs/architecture/architecture.md).

## Availability

**Available in the development web app:** saved sources, cited study notes,
topic cards and graph, combined overviews, organization corrections, source
refresh, recall questions, the study assistant and further-reading search.
Generated notes are read-only. Library access currently uses an anonymous browser
session; clearing browser data can remove access.

**Planned:** a public production release, linked accounts and recovery, scanned
PDF support, and automatic access to private Teams, Zoom and Panopto transcripts.
The existing iPhone app is an earlier article-sharing version; the connected
learning library described here is currently built for the browser.

For development setup, see the [web guide](web/README.md),
[backend guide](backend/README.md) and [database setup](supabase/README.md).
