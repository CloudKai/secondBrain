import type { KnowledgeItem } from '@/types/knowledge';

export const demoKnowledgeItem: KnowledgeItem = {
  id: 'demo-agent-loop',
  title: 'How AI agents turn goals into action',
  folder_id: 'ai-engineering',
  source_url:
    'https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/',
  raw_text:
    'An AI agent starts with a goal, decides which action is most useful, uses a tool, observes the result, and updates its next decision. The loop matters more than any single model call because each observation grounds the next step in the environment. Memory lets the agent carry useful facts between steps, while evaluation checks whether the final result actually satisfies the original goal. Guardrails limit which tools can be used and what data can leave the system.',
  simplified_summary: [
    '- An agent begins with a clear goal, then breaks it into the next useful action.',
    '- Tools let the agent affect the outside world instead of only producing text.',
    '- Every tool result becomes a new observation that changes what the agent should do next.',
    '- Memory, evaluation, and guardrails keep the loop useful, measurable, and safe.',
  ].join('\n'),
  mermaid_code:
    'graph TD\nGoal[Goal] --> Plan[Choose next action]\nPlan --> Tool[Use a tool]\nTool --> Observe[Observe result]\nObserve --> Plan\nMemory[Memory] --> Plan\nEvaluate[Evaluation] --> Goal',
  nodes: [
    { id: 'goal', label: 'Goal' },
    { id: 'plan', label: 'Choose next action' },
    { id: 'tool', label: 'Use a tool' },
    { id: 'observe', label: 'Observe the result' },
    { id: 'memory', label: 'Working memory' },
    { id: 'evaluate', label: 'Evaluate success' },
  ],
  edges: [
    { id: 'e1', source: 'goal', target: 'plan', label: 'guides' },
    { id: 'e2', source: 'plan', target: 'tool', label: 'selects' },
    { id: 'e3', source: 'tool', target: 'observe', label: 'produces' },
    { id: 'e4', source: 'observe', target: 'plan', label: 'updates' },
    { id: 'e5', source: 'memory', target: 'plan', label: 'informs' },
    { id: 'e6', source: 'evaluate', target: 'goal', label: 'checks' },
  ],
  source_links: [
    'https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/',
  ],
  saved_at: '2026-09-17T12:00:00.000Z',
  is_demo: true,
};
