# Second Brain

Language for learning from sources and connecting topics across a personal
learning library. These terms describe the product being designed.

## Language

**Learning library**:
A learner's personal collection of saved sources, study notes, and topics.
_Avoid_: Bookmark list

**Topic collection**:
A learner's study space around a topic, bringing together supporting sources,
teaching activities, a learning goal, and learning progress.
_Avoid_: Source folder

**Learning goal**:
What a learner wants to understand or be able to do through a topic collection.
It can change as their interests and needs develop.
_Avoid_: Topic title

**Background lesson**:
Optional teaching of prerequisite knowledge that helps a learner approach a
topic, with its relationship to saved-source evidence made clear.
_Avoid_: Source excerpt

**Learning plan**:
An ordered set of lessons and practice activities for a topic collection,
shaped by the learner's goal and available supporting material.
_Avoid_: Topic overview

**Learning path**:
A route through a topic collection toward a particular learning goal. A learner
can choose among starting paths or branch from a path as their goal changes.
_Avoid_: Source branch

**Understanding check**:
A practice activity where a learner explains or applies a concept and receives
feedback on their answer. Its result is evidence about that activity, not proof
of mastery of the entire topic.
_Avoid_: Read receipt

**Lesson**:
A guided teaching unit that helps a learner pursue a learning outcome through
explanations, examples and practice within a learning path.
_Avoid_: Study note

**Practice attempt**:
A learner's response to an understanding check at a particular difficulty.
Later retries are separate attempts, not replacements for earlier responses.
_Avoid_: Generation attempt

**Quiz**:
A short set of questions that checks understanding of one learning path
revision, written from the source passages that path cites. Its score and
per-outcome labels are evidence about that quiz, not proof of mastery of the
topic. Taking it is optional and never blocks progress.
_Avoid_: Exam, test, final assessment

**Quiz attempt**:
A learner's submitted answers to a quiz, kept with their per-question results.
A retake is a separate attempt on the same questions; the earlier attempt is
retained. Short-answer feedback in an attempt is provisional AI feedback.
_Avoid_: Quiz grade, quiz score record

**Topic correction**:
A learner's change to topic names, duplicate topics, source assignments, or
topic connections to make their learning library reflect their understanding.
_Avoid_: Note edit

**Source**:
A web page, PDF, or video that a learner brings into their library as learning
material.
_Avoid_: Input material

**Topic**:
A subject a learner studies, such as RAG, prompt engineering, calculus, or
algebra.
_Avoid_: Subject

**Study note**:
A structured explanation of one saved source, with an overview, concept
explanations, relevant examples, and references to supporting sources.
_Avoid_: Summary, lesson

**Topic overview**:
A combined explanation of a topic across its source notes, preserving
agreements, disagreements, and supporting references.
_Avoid_: Combined note

**Topic graph**:
A map of shared topics and meaningful relationships supported by a learner's
saved material, with source branches available to show individual perspectives.
_Avoid_: Folder tree

**Source branch**:
An individual source's study note shown beneath its parent topic when the
learner chooses to keep same-topic material separate.
_Avoid_: Duplicate topic

**Combined view**:
A topic's combined overview of its source notes, with the original notes and
their references retained.
_Avoid_: Destructive merge

**Separate view**:
A topic's individual source branches, each retaining its own study note and
references.
_Avoid_: Separate topic

**Topic placement**:
A topic's position within broader subjects and its connections to nearby
topics.
_Avoid_: Folder assignment

**Topic connection**:
A labelled relationship between two topics that explains how they relate.
_Avoid_: Similarity link

**Source reference**:
A reference from a study note, topic overview, or assistant answer to the
supporting passage or moment in its source.
_Avoid_: Redirect word

**Source passage**:
An exact excerpt of captured learning material that can support a claim, with
its location in the original source retained.
_Avoid_: Retrieval chunk

**Study assistant**:
A conversational guide for explaining study notes and exploring related topics.
_Avoid_: Chatbot

**Assistant scope**:
The saved learning material available to the study assistant for a question:
the current note, its topic, or the learner's library.
_Avoid_: Search filter

**Further-study resource**:
External learning material suggested to help a learner explore a topic more
deeply, available to inspect and optionally save as a source.
_Avoid_: Source reference


**Retrieval chunk**:
A derived searchable span of one captured source version. It preserves original
capture offsets and locations and can supply several smaller source passages.
It is separate from saved citation passage IDs.

**Index manifest**:
The authoritative Postgres record of a source's derived search generation,
configuration, progress and retry state. A deleted source retains a cleanup
tombstone until its derived vectors are removed.

**Goal branch**:
A new learning path for an explicitly changed goal, retaining its parent path,
supporting sources and earlier learner work. Confirmation opens the branch;
new application checks require separate attempts.

**Teaching map**:
A view of suggested lesson order and confirmable learning paths. Its arrows are
study guidance, separate from evidence-supported relationships in the topic graph.

**Applicable prior learning context**:
Earlier reading or attempts with an exactly matching outcome, difficulty and
original evidence, available to revisit within a goal branch. Provisional feedback
is not a verified result and never completes a new application check.
