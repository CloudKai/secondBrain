import { Platform } from 'react-native';

import type {
  ProcessLinkRequest,
  ProcessLinkResponse,
} from '@/types/knowledge';

const developmentHost = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://127.0.0.1:8000',
});

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? developmentHost
).replace(/\/$/, '');

const diagramTypes = new Set(['flow', 'hierarchy', 'network']);

function isProcessLinkResponse(value: unknown): value is ProcessLinkResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const diagramOptions = Array.isArray(candidate.diagram_options)
    ? candidate.diagram_options
    : null;
  const nodes = Array.isArray(candidate.nodes) ? candidate.nodes : null;
  const edges = Array.isArray(candidate.edges) ? candidate.edges : null;
  const nodesAreValid =
    nodes !== null &&
    nodes.length >= 2 &&
    nodes.length <= 16 &&
    nodes.every(
      (node) =>
        typeof node === 'object' &&
        node !== null &&
        typeof (node as Record<string, unknown>).id === 'string' &&
        typeof (node as Record<string, unknown>).label === 'string',
    );
  const edgesAreValid =
    edges !== null &&
    edges.length >= 1 &&
    edges.length <= 24 &&
    edges.every(
      (edge) =>
        typeof edge === 'object' &&
        edge !== null &&
        typeof (edge as Record<string, unknown>).id === 'string' &&
        typeof (edge as Record<string, unknown>).source === 'string' &&
        typeof (edge as Record<string, unknown>).target === 'string' &&
        (typeof (edge as Record<string, unknown>).label === 'string' ||
          (edge as Record<string, unknown>).label === null),
    );
  const nodeIds = nodesAreValid
    ? nodes.map((node) => (node as Record<string, unknown>).id as string)
    : [];
  const edgeIds = edgesAreValid
    ? edges.map((edge) => (edge as Record<string, unknown>).id as string)
    : [];
  const nodeIdSet = new Set(nodeIds);
  const graphReferencesAreValid =
    nodesAreValid &&
    edgesAreValid &&
    nodeIdSet.size === nodeIds.length &&
    new Set(edgeIds).size === edgeIds.length &&
    edges.every((edge) => {
      const record = edge as Record<string, unknown>;
      return (
        nodeIdSet.has(record.source as string) &&
        nodeIdSet.has(record.target as string)
      );
    });
  const diagramOptionsAreValid =
    diagramOptions !== null &&
    diagramOptions.length > 0 &&
    diagramOptions.length <= 3 &&
    new Set(diagramOptions).size === diagramOptions.length &&
    diagramOptions.every(
      (option) => typeof option === 'string' && diagramTypes.has(option),
    );
  return (
    typeof candidate.folder_id === 'string' &&
    typeof candidate.source_url === 'string' &&
    typeof candidate.raw_text === 'string' &&
    typeof candidate.simplified_summary === 'string' &&
    typeof candidate.diagram_type === 'string' &&
    diagramTypes.has(candidate.diagram_type) &&
    diagramOptionsAreValid &&
    diagramOptions.includes(candidate.diagram_type) &&
    graphReferencesAreValid
  );
}

export async function processLink(
  payload: ProcessLinkRequest,
): Promise<ProcessLinkResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/process-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed with HTTP ${response.status}`;
    throw new Error(detail);
  }
  if (!isProcessLinkResponse(body)) {
    throw new Error('The backend returned an unexpected response.');
  }
  return body;
}
