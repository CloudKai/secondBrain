import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/constants/theme';
import type { GraphEdge, GraphNode } from '@/types/knowledge';

export type GraphDirection = 'TB' | 'LR';

type InteractiveGraphViewerProps = {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  direction?: GraphDirection;
};

type WebViewMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string };

function forInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildHtml(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  direction: GraphDirection,
): string {
  const serializedNodes = forInlineScript(nodes);
  const serializedEdges = forInlineScript(edges);
  const serializedDirection = forInlineScript(direction);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reactflow@11.11.4/dist/style.css" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #0b0b0d;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-user-select: none;
        user-select: none;
        touch-action: none;
      }
      .react-flow__node-default {
        width: 190px;
        min-height: 68px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px 16px;
        border: 1px solid rgba(52, 211, 153, 0.72);
        border-radius: 16px;
        background: #1c1c1e;
        color: #ffffff;
        font-size: 14px;
        font-weight: 650;
        line-height: 1.35;
        text-align: center;
        box-shadow:
          0 0 0 1px rgba(167, 243, 208, 0.06) inset,
          0 0 18px rgba(52, 211, 153, 0.15),
          0 10px 28px rgba(0, 0, 0, 0.32);
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }
      .react-flow__node-default.selected,
      .react-flow__node-default.dragging {
        border-color: #a7f3d0;
        box-shadow:
          0 0 0 1px rgba(167, 243, 208, 0.28) inset,
          0 0 26px rgba(52, 211, 153, 0.38),
          0 14px 34px rgba(0, 0, 0, 0.45);
      }
      .react-flow__handle {
        width: 8px;
        height: 8px;
        border: 2px solid #1c1c1e;
        background: #34d399;
      }
      .react-flow__edge-path {
        stroke: #34d399;
        stroke-width: 2;
        filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.72));
      }
      .react-flow__edge-text { fill: #d1fae5; font-size: 11px; }
      .react-flow__edge-textbg { fill: #1c1c1e; fill-opacity: 0.92; }
      .react-flow__controls {
        overflow: hidden;
        border: 1px solid #34343a;
        border-radius: 12px;
        background: #1c1c1e;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.34);
      }
      .react-flow__controls-button {
        width: 34px;
        height: 34px;
        border-bottom-color: #34343a;
        background: #1c1c1e;
        fill: #ffffff;
      }
      .react-flow__controls-button:hover { background: #29292d; }
      .react-flow__attribution { display: none; }
      #error {
        display: none;
        position: absolute;
        inset: 0;
        align-items: center;
        justify-content: center;
        padding: 28px;
        color: #fda4af;
        text-align: center;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div id="error">Unable to load the interactive graph.</div>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/reactflow@11.11.4/dist/umd/index.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
    <script>
      (() => {
        const inputNodes = ${serializedNodes};
        const inputEdges = ${serializedEdges};
        const direction = ${serializedDirection};
        const nodeWidth = 190;
        const nodeHeight = 72;

        function notify(message) {
          window.ReactNativeWebView?.postMessage(JSON.stringify(message));
        }

        function layoutGraph() {
          const graph = new dagre.graphlib.Graph();
          graph.setDefaultEdgeLabel(() => ({}));
          graph.setGraph({
            rankdir: direction,
            nodesep: 44,
            ranksep: 76,
            marginx: 28,
            marginy: 28
          });

          inputNodes.forEach((node) => {
            graph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
          });
          inputEdges.forEach((edge) => graph.setEdge(edge.source, edge.target));
          dagre.layout(graph);

          const horizontal = direction === 'LR';
          const layoutedNodes = inputNodes.map((node) => {
            const point = graph.node(node.id);
            return {
              id: node.id,
              data: { label: node.label },
              position: {
                x: point.x - nodeWidth / 2,
                y: point.y - nodeHeight / 2
              },
              sourcePosition: horizontal ? 'right' : 'bottom',
              targetPosition: horizontal ? 'left' : 'top'
            };
          });

          const layoutedEdges = inputEdges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label || undefined,
            type: 'smoothstep',
            animated: false,
            markerEnd: { type: 'arrowclosed', color: '#34d399' },
            style: { stroke: '#34d399', strokeWidth: 2 }
          }));
          return { nodes: layoutedNodes, edges: layoutedEdges };
        }

        try {
          const {
            default: ReactFlowCanvas,
            Background,
            Controls,
            useNodesState,
            useEdgesState
          } = ReactFlow;
          const layouted = layoutGraph();

          function Graph() {
            const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
            const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);
            return React.createElement(
              ReactFlowCanvas,
              {
                nodes,
                edges,
                onNodesChange,
                onEdgesChange,
                nodesDraggable: true,
                nodesConnectable: false,
                elementsSelectable: true,
                panOnDrag: true,
                zoomOnPinch: true,
                zoomOnScroll: true,
                zoomOnDoubleClick: true,
                preventScrolling: true,
                minZoom: 0.25,
                maxZoom: 2.5,
                fitView: true,
                fitViewOptions: { padding: 0.2, duration: 420 },
                proOptions: { hideAttribution: true }
              },
              React.createElement(Background, {
                color: '#2f343d',
                gap: 22,
                size: 1
              }),
              React.createElement(Controls, {
                showInteractive: false,
                position: 'bottom-right'
              })
            );
          }

          ReactDOM.createRoot(document.getElementById('root')).render(
            React.createElement(Graph)
          );
          requestAnimationFrame(() => notify({ type: 'ready' }));
        } catch (error) {
          document.getElementById('error').style.display = 'flex';
          notify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Graph failed to render'
          });
        }
      })();
    </script>
  </body>
</html>`;
}

export function InteractiveGraphViewer({
  nodes,
  edges,
  direction = 'TB',
}: InteractiveGraphViewerProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = useMemo(
    () => ({ html: buildHtml(nodes, edges, direction) }),
    [direction, edges, nodes],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as WebViewMessage;
      if (message.type === 'ready') setIsReady(true);
      if (message.type === 'error') {
        setError(message.message);
        setIsReady(true);
      }
    } catch {
      setError('The graph returned an invalid status message.');
      setIsReady(true);
    }
  };

  return (
    <NativeViewGestureHandler disallowInterruption>
      <View style={styles.container}>
        {!isReady ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.accentStrong} />
            <Text style={styles.statusText}>Building visual map…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.status}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <WebView
          source={source}
          originWhitelist={['*']}
          onMessage={handleMessage}
          onError={() => {
            setError('The interactive graph could not be loaded.');
            setIsReady(true);
          }}
          style={styles.webView}
          containerStyle={styles.webViewContainer}
          javaScriptEnabled
          domStorageEnabled={false}
          scrollEnabled={false}
          nestedScrollEnabled
          setBuiltInZoomControls={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </NativeViewGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 480,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0B0B0D',
  },
  webView: { backgroundColor: '#0B0B0D' },
  webViewContainer: { backgroundColor: '#0B0B0D' },
  status: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#0B0B0D',
  },
  statusText: { color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
