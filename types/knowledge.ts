export type FolderId = 'ai-engineering' | 'system-design';

export type Folder = {
  id: FolderId;
  name: string;
  description: string;
};

export const folders: readonly Folder[] = [
  {
    id: 'ai-engineering',
    name: 'AI Engineering',
    description: 'Models, agents, evaluation, and production AI',
  },
  {
    id: 'system-design',
    name: 'System Design',
    description: 'Architecture, scale, reliability, and trade-offs',
  },
] as const;

export type ProcessLinkRequest = {
  url: string;
  raw_text: string;
  folder_id: FolderId;
};

export type GraphNode = {
  id: string;
  label: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string | null;
};

export type ProcessLinkResponse = {
  folder_id: string;
  source_url: string;
  raw_text: string;
  simplified_summary: string;
  mermaid_code: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type KnowledgeItem = ProcessLinkResponse & {
  title: string;
  source_links: string[];
};
