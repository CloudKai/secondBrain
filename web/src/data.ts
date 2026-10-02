import type { Note } from "./types";
export const sampleNotes: Note[] = [
  {
    id: "attention",
    title: "Attention is all you need",
    subtitle: "The idea that changed how machines understand language.",
    author: "Vaswani et al.",
    year: "2017",
    url: "https://arxiv.org/abs/1706.03762",
    kind: "Paper",
    color: "mint",
    overview:
      "The Transformer replaces recurrence with attention. Instead of reading a sequence one step at a time, it learns which parts of the input matter to each other. This makes training more parallelizable.",
    concepts: [
      {
        title: "Attention connects the context",
        topic: "attention",
        text: "Attention combines value vectors using weights determined by how well a query matches each key. Self-attention takes queries, keys, and values from the same sequence.",
      },
      {
        title: "Different heads, different perspectives",
        topic: "transformers",
        text: "Multi-head attention runs several attention operations in parallel, allowing information from different representation subspaces to contribute to the result.",
      },
      {
        title: "Position still matters",
        topic: "embeddings",
        text: "Positional encodings add order information to token embeddings. This supplies sequence position without relying on recurrent processing.",
      },
    ],
    example:
      "An illustrative analogy: in “The animal did not cross the street because it was tired,” attention can help a token incorporate relevant context from other words. This example explains the idea; it is not a measured attention result.",
    equation: "Attention(Q, K, V) = softmax(QKᵀ / √dₖ)V",
    recall: [
      {
        question: "What does self-attention let a token do?",
        answer:
          "Combine information from other positions in the same sequence using learned attention weights.",
      },
      {
        question: "Why does a Transformer need positional information?",
        answer:
          "Attention alone does not encode sequence order. Positional information supplies that missing signal.",
      },
      {
        question: "What is the purpose of multiple attention heads?",
        answer:
          "They allow attention to different representation subspaces in parallel.",
      },
    ],
    topics: ["transformers", "attention", "embeddings"],
    evidence:
      "The Transformer uses attention instead of recurrence. Section 3.2 describes query-key compatibility and weighted value vectors, including scaled dot-product and multi-head attention. Sections 3.4–3.5 explain token embeddings and added positional encodings.",
    evidenceLabel: "Model architecture, §3 · paraphrased evidence",
    demo: true,
    addedAt: 3,
  },
  {
    id: "annotated",
    title: "The annotated Transformer",
    subtitle: "From the original idea to a line-by-line implementation.",
    author: "Alexander Rush · Harvard NLP",
    year: "2018",
    url: "https://nlp.seas.harvard.edu/2018/04/03/attention.html",
    kind: "Article",
    color: "purple",
    overview:
      "A code-first companion to the Transformer paper. The annotated implementation connects the architecture to working PyTorch components, making the roles of attention, embeddings, and masking easier to inspect.",
    concepts: [
      {
        title: "Queries, keys, and values",
        topic: "attention",
        text: "Queries are compared with keys. A softmax converts scaled dot products into weights, which are used to combine values.",
      },
      {
        title: "Build the architecture in blocks",
        topic: "transformers",
        text: "Encoder and decoder layers combine attention, feed-forward networks, residual connections, and normalization.",
      },
      {
        title: "Represent tokens and their positions",
        topic: "embeddings",
        text: "Embeddings turn tokens into vectors. Positional encodings add information about where each token appears in the sequence.",
      },
    ],
    example:
      "An illustrative query-key-value analogy: a query is what you are looking for, keys describe what is available, and values carry the information you collect. The analogy is a teaching aid, not a literal description of learned vectors.",
    equation: "scores = (query × keyᵀ) / √dₖ",
    recall: [
      {
        question: "What does softmax do in attention?",
        answer:
          "It turns attention scores into normalized weights used to combine value vectors.",
      },
      {
        question: "Why mask future positions in the decoder?",
        answer:
          "To prevent a prediction from using tokens that would not yet be available during autoregressive generation.",
      },
      {
        question: "How are token order and token identity represented?",
        answer:
          "Embeddings represent tokens; positional encodings add order information.",
      },
    ],
    topics: ["transformers", "attention", "embeddings"],
    evidence:
      "The attention implementation scales query-key dot products before softmax. The decoder uses a mask to prevent positions from attending to future positions. Embeddings and positional encodings are separate components.",
    evidenceLabel: "Attention and model components · paraphrased evidence",
    demo: true,
    addedAt: 2,
  },
  {
    id: "rag",
    title: "Retrieval-augmented generation",
    subtitle: "Give a language model a library it can look things up in.",
    author: "Patrick Lewis et al.",
    year: "2020",
    url: "https://arxiv.org/abs/2005.11401",
    kind: "Paper",
    color: "peach",
    overview:
      "RAG combines a pretrained sequence-to-sequence model with retrieved information. In this paper, a neural retriever accesses a dense vector index of Wikipedia to supply evidence for generation.",
    concepts: [
      {
        title: "Retrieve before generating",
        topic: "retrieval",
        text: "A retriever selects passages from an external index. The generator conditions its output on retrieved material rather than relying only on knowledge stored in model parameters.",
      },
      {
        title: "An external memory",
        topic: "embeddings",
        text: "The paper uses a dense vector index as non-parametric memory, accessed by a pretrained neural retriever.",
      },
    ],
    example:
      "An illustrative comparison: a closed-book answer relies on memory; an open-book answer can consult relevant passages. Retrieval gives generation an external reference, but does not guarantee every answer is correct.",
    recall: [
      {
        question: "Which two forms of memory does RAG combine?",
        answer:
          "Parametric memory in model weights and non-parametric memory in an external retrieval index.",
      },
      {
        question: "Does retrieval guarantee a correct answer?",
        answer:
          "No. The retrieved passages and the generated answer still need to be evaluated.",
      },
    ],
    topics: ["retrieval", "embeddings"],
    evidence:
      "The paper combines a pretrained sequence-to-sequence model with a dense Wikipedia index accessed by a neural retriever. It evaluates two ways to condition generation on retrieved passages.",
    evidenceLabel: "Abstract · paraphrased evidence",
    demo: true,
    addedAt: 1,
  },
];
export const topicTitles: Record<string, string> = {
  transformers: "Transformers",
  attention: "Self-attention",
  embeddings: "Embeddings",
  retrieval: "Retrieval & RAG",
};
