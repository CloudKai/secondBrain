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

function isProcessLinkResponse(value: unknown): value is ProcessLinkResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const nodesAreValid =
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(
      (node) =>
        typeof node === 'object' &&
        node !== null &&
        typeof (node as Record<string, unknown>).id === 'string' &&
        typeof (node as Record<string, unknown>).label === 'string',
    );
  const edgesAreValid =
    Array.isArray(candidate.edges) &&
    candidate.edges.every(
      (edge) =>
        typeof edge === 'object' &&
        edge !== null &&
        typeof (edge as Record<string, unknown>).id === 'string' &&
        typeof (edge as Record<string, unknown>).source === 'string' &&
        typeof (edge as Record<string, unknown>).target === 'string' &&
        (typeof (edge as Record<string, unknown>).label === 'string' ||
          (edge as Record<string, unknown>).label === null),
    );
  return (
    typeof candidate.folder_id === 'string' &&
    typeof candidate.source_url === 'string' &&
    typeof candidate.raw_text === 'string' &&
    typeof candidate.simplified_summary === 'string' &&
    typeof candidate.mermaid_code === 'string' &&
    nodesAreValid &&
    edgesAreValid
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
