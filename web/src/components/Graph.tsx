import { ArrowUpRight, Network } from "lucide-react";
import type { Connection, Topic } from "../types";
interface Props {
  topics: Topic[];
  connections: Connection[];
  selected?: string;
  onSelect: (id: string) => void;
  compact?: boolean;
  cardsOnly?: boolean;
}
export function Graph({
  topics,
  connections,
  selected,
  onSelect,
  compact = false,
  cardsOnly = false,
}: Props) {
  if (!topics.length)
    return (
      <div className="graph-empty">
        <Network size={32} />
        <h3>Your map starts with a source</h3>
        <p>Save something interesting. Its topics will appear here.</p>
      </div>
    );
  const connectedIds = new Set(
    connections.flatMap((c) => [c.source, c.target]),
  );
  if (cardsOnly)
    return (
      <div className={`graph-topic-grid ${compact ? "compact" : ""}`}>
        <p className="micro-copy">
          Select a topic to inspect its sources. Connections need meaningful support
          from two independent saved sources.
        </p>
        {topics.map((topic) => (
          <button
            key={topic.id}
            className={selected === topic.id ? "selected" : ""}
            onClick={() => onSelect(topic.id)}
          >
            <Network size={18} />
            <span>
              {topic.title}
              <small>{topic.notes.length} supporting sources</small>
            </span>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
    );
  const visibleIds = new Set<string>([selected ?? connections[0]?.source ?? topics[0].id]);
  if (topics.length > 6) {
    for (const connection of connections) {
      if (visibleIds.has(connection.source) || visibleIds.has(connection.target)) {
        const additions = [connection.source, connection.target].filter(id=>!visibleIds.has(id));
        if (visibleIds.size + additions.length <= 6) additions.forEach(id=>visibleIds.add(id));
      }
    }
    if (connections.length && !connections.some(c=>visibleIds.has(c.source)&&visibleIds.has(c.target))) {
      visibleIds.add(connections[0].source); visibleIds.add(connections[0].target);
    }
    for (const topic of topics) { if (visibleIds.size >= 6) break; visibleIds.add(topic.id); }
  }
  const visibleTopics = topics.length > 6 ? topics.filter(t=>visibleIds.has(t.id)) : topics;
  const positions = visibleTopics.map((t, i) => ({
    topic: t,
    x: 50 + 32 * Math.cos((i * 2 * Math.PI) / visibleTopics.length - Math.PI / 2),
    y: 50 + 30 * Math.sin((i * 2 * Math.PI) / visibleTopics.length - Math.PI / 2),
  }));
  return (
    <>
    {topics.length>6&&<label className="graph-focus">Focus on a topic
      <select aria-label="Choose graph focus" value={selected??visibleTopics[0].id} onChange={event=>onSelect(event.target.value)}>{topics.map(topic=><option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
      <span className="micro-copy">Showing up to six topics. Choose a focus to explore the rest.</span>
    </label>}
    <div className={`knowledge-map ${compact ? "compact" : ""}`}>
      <svg
        className="graph-lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {connections.map((c) => {
          const a = positions.find((p) => p.topic.id === c.source),
            b = positions.find((p) => p.topic.id === c.target);
          return a && b ? (
            <line key={c.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ) : null;
        })}
      </svg>
      {positions.map(({ topic, x, y }, i) => (
        <button
          key={topic.id}
          className={`graph-node tone-${["mint", "purple", "peach", "blue"][i % 4]} ${selected === topic.id ? "selected" : ""} ${connectedIds.has(topic.id) ? "" : "unconnected"}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onSelect(topic.id)}
          aria-label={`Explore ${topic.title}, ${topic.notes.length} sources`}
        >
          <span className="node-orbit">
            <Network size={compact ? 17 : 23} />
          </span>
          <span>{topic.title}</span>
          {!compact && (
            <small>
              {topic.notes.length} sources <ArrowUpRight size={12} />
            </small>
          )}
        </button>
      ))}
      {!connections.length && (
        <p className="graph-threshold">
          Shared topics can have several sources. Lines appear only for a supported
          uses, requires, or evaluates relationship.
        </p>
      )}
    </div>
    </>
  );
}
export function AttentionArt({ small = false }: { small?: boolean }) {
  return (
    <div className={`attention-art ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 360 230">
        <defs>
          <linearGradient id={small ? "line-small" : "line-large"}>
            <stop stopColor="#9be5c4" />
            <stop offset="1" stopColor="#9383c8" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].flatMap((a) =>
          [0, 1, 2, 3].map((b) => (
            <path
              key={`${a}-${b}`}
              d={`M 70 ${42 + a * 48} C 155 ${42 + a * 48}, 205 ${42 + b * 48}, 290 ${42 + b * 48}`}
              stroke={`url(#${small ? "line-small" : "line-large"})`}
              opacity={a === b ? ".7" : ".17"}
              fill="none"
            />
          )),
        )}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x="42"
              y={28 + i * 48}
              width="48"
              height="28"
              rx="8"
              fill="#203e32"
              stroke="#7fc7a3"
              strokeOpacity=".55"
            />
            <rect
              x="270"
              y={28 + i * 48}
              width="48"
              height="28"
              rx="8"
              fill="#30283f"
              stroke="#b09bcf"
              strokeOpacity=".6"
            />
            <circle cx="66" cy={42 + i * 48} r="3" fill="#9be5c4" />
            <circle cx="294" cy={42 + i * 48} r="3" fill="#c5b3e7" />
          </g>
        ))}
        <text x="65" y="224" textAnchor="middle">
          TOKENS
        </text>
        <text x="290" y="224" textAnchor="middle">
          CONTEXT
        </text>
      </svg>
      <span className="art-label">Everything is connected.</span>
    </div>
  );
}
