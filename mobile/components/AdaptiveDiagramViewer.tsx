import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/constants/theme';
import type { DiagramType, GraphEdge, GraphNode } from '@/types/knowledge';

export type GraphDirection = 'TB' | 'LR';

type AdaptiveDiagramViewerProps = {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  diagramType: DiagramType;
  direction?: GraphDirection;
  onNodePress?: (nodeId: string | null) => void;
};

type WebViewMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'nodePress'; nodeId: string | null };

const diagramNames: Record<DiagramType, string> = {
  flow: 'flow',
  hierarchy: 'hierarchy',
  network: 'network',
};

function forInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildHtml(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  diagramType: DiagramType,
  direction: GraphDirection,
): string {
  const serializedNodes = forInlineScript(nodes);
  const serializedEdges = forInlineScript(edges);
  const serializedType = forInlineScript(diagramType);
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
        min-height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 13px 15px;
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
        transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }
      .react-flow__node-default.node-flow { width: 190px; }
      .react-flow__node-default.node-hierarchy {
        width: 178px;
        border-color: rgba(96, 165, 250, 0.72);
        box-shadow: 0 0 18px rgba(96, 165, 250, 0.14), 0 10px 28px rgba(0, 0, 0, 0.32);
      }
      .react-flow__node-default.node-root {
        border-color: #c4b5fd;
        background: #241d35;
        font-size: 15px;
        box-shadow: 0 0 24px rgba(167, 139, 250, 0.28), 0 12px 30px rgba(0, 0, 0, 0.38);
      }
      .react-flow__node-default.node-network {
        width: 164px;
        min-height: 58px;
        border-color: rgba(167, 139, 250, 0.74);
        border-radius: 22px;
        box-shadow: 0 0 20px rgba(167, 139, 250, 0.16), 0 10px 28px rgba(0, 0, 0, 0.32);
      }
      .react-flow__node-default.selected,
      .react-flow__node-default.dragging {
        border-color: #f8fafc;
        box-shadow:
          0 0 0 1px rgba(248, 250, 252, 0.32) inset,
          0 0 28px rgba(52, 211, 153, 0.36),
          0 14px 34px rgba(0, 0, 0, 0.45);
        transform: translateY(-1px);
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
        filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.58));
      }
      .react-flow__edge.edge-hierarchy .react-flow__edge-path {
        stroke: #60a5fa;
        filter: drop-shadow(0 0 4px rgba(96, 165, 250, 0.5));
      }
      .react-flow__edge.edge-network .react-flow__edge-path {
        stroke: #a78bfa;
        stroke-width: 1.7;
        filter: drop-shadow(0 0 4px rgba(167, 139, 250, 0.45));
      }
      .react-flow__edge-text { fill: #e2e8f0; font-size: 11px; }
      .react-flow__edge-textbg { fill: #1c1c1e; fill-opacity: 0.94; }
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
    <div id="error">Unable to load the adaptive diagram.</div>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/reactflow@11.11.4/dist/umd/index.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
    <script>
      (() => {
        const inputNodes = ${serializedNodes};
        const inputEdges = ${serializedEdges};
        const diagramType = ${serializedType};
        const direction = ${serializedDirection};

        function notify(message) {
          window.ReactNativeWebView?.postMessage(JSON.stringify(message));
        }

        function hierarchyDepths() {
          const indegree = Object.fromEntries(inputNodes.map((node) => [node.id, 0]));
          const children = Object.fromEntries(inputNodes.map((node) => [node.id, []]));
          inputEdges.forEach((edge) => {
            indegree[edge.target] = (indegree[edge.target] || 0) + 1;
            children[edge.source]?.push(edge.target);
          });
          const root = inputNodes.find((node) => indegree[node.id] === 0)?.id;
          const depths = {};
          if (!root) return { root: null, depths };
          const pending = [[root, 0]];
          while (pending.length) {
            const [nodeId, depth] = pending.shift();
            if (depths[nodeId] !== undefined) continue;
            depths[nodeId] = depth;
            (children[nodeId] || []).forEach((child) => pending.push([child, depth + 1]));
          }
          return { root, depths };
        }

        function dagreLayout() {
          const hierarchy = diagramType === 'hierarchy';
          const nodeWidth = hierarchy ? 178 : 190;
          const nodeHeight = hierarchy ? 66 : 72;
          const graph = new dagre.graphlib.Graph();
          graph.setDefaultEdgeLabel(() => ({}));
          graph.setGraph({
            rankdir: direction,
            ranker: hierarchy ? 'tight-tree' : 'network-simplex',
            nodesep: hierarchy ? 34 : 44,
            ranksep: hierarchy ? 92 : 76,
            marginx: 30,
            marginy: 30
          });
          inputNodes.forEach((node) => {
            graph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
          });
          inputEdges.forEach((edge) => graph.setEdge(edge.source, edge.target));
          dagre.layout(graph);

          const horizontal = direction === 'LR';
          const { root, depths } = hierarchyDepths();
          const nodes = inputNodes.map((node) => {
            const point = graph.node(node.id);
            const depth = depths[node.id] ?? 0;
            return {
              id: node.id,
              data: { label: node.label },
              className: hierarchy
                ? 'node-hierarchy ' + (node.id === root ? 'node-root' : 'node-depth-' + Math.min(depth, 3))
                : 'node-flow',
              position: {
                x: point.x - nodeWidth / 2,
                y: point.y - nodeHeight / 2
              },
              sourcePosition: horizontal ? 'right' : 'bottom',
              targetPosition: horizontal ? 'left' : 'top'
            };
          });
          return { nodes, nodeWidth };
        }

        function networkLayout() {
          const nodeWidth = 164;
          const nodeHeight = 60;
          const radius = Math.max(190, inputNodes.length * 34);
          const simulationNodes = inputNodes.map((node, index) => {
            const angle = (index / inputNodes.length) * Math.PI * 2;
            return {
              ...node,
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius
            };
          });
          const links = inputEdges.map((edge) => ({
            source: edge.source,
            target: edge.target
          }));
          const simulation = d3.forceSimulation(simulationNodes)
            .force('link', d3.forceLink(links).id((node) => node.id).distance(180).strength(0.72))
            .force('charge', d3.forceManyBody().strength(-720))
            .force('center', d3.forceCenter(0, 0))
            .force('collision', d3.forceCollide(104))
            .stop();
          for (let tick = 0; tick < 220; tick += 1) simulation.tick();

          return {
            nodeWidth,
            nodes: simulationNodes.map((node) => ({
              id: node.id,
              data: { label: node.label },
              className: 'node-network',
              position: {
                x: node.x - nodeWidth / 2,
                y: node.y - nodeHeight / 2
              }
            }))
          };
        }

        function layoutGraph() {
          const layout = diagramType === 'network' ? networkLayout() : dagreLayout();
          const edgeColor = diagramType === 'hierarchy'
            ? '#60a5fa'
            : diagramType === 'network'
              ? '#a78bfa'
              : '#34d399';
          const edges = inputEdges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label || undefined,
            type: diagramType === 'network' ? 'default' : 'smoothstep',
            className: 'edge-' + diagramType,
            animated: diagramType === 'flow',
            markerEnd: { type: 'arrowclosed', color: edgeColor },
            style: { stroke: edgeColor, strokeWidth: diagramType === 'network' ? 1.7 : 2 }
          }));
          return { nodes: layout.nodes, edges };
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

          function Diagram() {
            const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
            const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);
            return React.createElement(
              ReactFlowCanvas,
              {
                nodes,
                edges,
                onNodesChange,
                onEdgesChange,
                onNodeClick: (_, node) => notify({
                  type: 'nodePress',
                  nodeId: node.id
                }),
                onPaneClick: () => notify({
                  type: 'nodePress',
                  nodeId: null
                }),
                nodesDraggable: true,
                nodesConnectable: false,
                elementsSelectable: true,
                panOnDrag: true,
                zoomOnPinch: true,
                zoomOnScroll: true,
                zoomOnDoubleClick: true,
                preventScrolling: true,
                minZoom: 0.22,
                maxZoom: 2.6,
                fitView: true,
                fitViewOptions: { padding: 0.22, duration: 420 },
                proOptions: { hideAttribution: true }
              },
              React.createElement(Background, {
                color: diagramType === 'network' ? '#332a4b' : '#2f343d',
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
            React.createElement(Diagram)
          );
          requestAnimationFrame(() => notify({ type: 'ready' }));
        } catch (error) {
          document.getElementById('error').style.display = 'flex';
          notify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Diagram failed to render'
          });
        }
      })();
    </script>
  </body>
</html>`;
}

export function AdaptiveDiagramViewer({
  nodes,
  edges,
  diagramType,
  direction = 'TB',
  onNodePress,
}: AdaptiveDiagramViewerProps) {
  const [readySource, setReadySource] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    sourceKey: string;
    message: string;
  } | null>(null);
  const sourceKey = useMemo(
    () => JSON.stringify({ diagramType, direction, nodes, edges }),
    [diagramType, direction, edges, nodes],
  );
  const source = useMemo(
    () => ({ html: buildHtml(nodes, edges, diagramType, direction) }),
    [diagramType, direction, edges, nodes],
  );
  const isReady = readySource === sourceKey;
  const error = errorState?.sourceKey === sourceKey ? errorState.message : null;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as WebViewMessage;
      if (message.type === 'ready') setReadySource(sourceKey);
      if (message.type === 'error') {
        setErrorState({ sourceKey, message: message.message });
        setReadySource(sourceKey);
      }
      if (message.type === 'nodePress') onNodePress?.(message.nodeId);
    } catch {
      setErrorState({
        sourceKey,
        message: 'The diagram returned an invalid status message.',
      });
      setReadySource(sourceKey);
    }
  };

  const diagramName = diagramNames[diagramType];

  return (
    <NativeViewGestureHandler disallowInterruption>
      <View style={styles.container}>
        {!isReady ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.accentStrong} />
            <Text style={styles.statusText}>Building {diagramName} view…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.status}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <WebView
          key={sourceKey}
          accessibilityLabel={`Interactive ${diagramName} diagram. Pinch to zoom, drag to pan, or tap a concept for details.`}
          source={source}
          originWhitelist={['*']}
          onMessage={handleMessage}
          onError={() => {
            setErrorState({
              sourceKey,
              message: 'The adaptive diagram could not be loaded.',
            });
            setReadySource(sourceKey);
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
