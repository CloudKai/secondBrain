import test from 'node:test';
import assert from 'node:assert/strict';
import { readingBlocks } from './reading-format';

test('source prose wraps become readable paragraphs without rewriting words', () => {
  assert.deepEqual(readingBlocks('Retrieval 🚀 finds\nsupporting evidence.\n\nThe model uses it.'), [
    {kind:'prose', text:'Retrieval 🚀 finds supporting evidence.'},
    {kind:'prose', text:'The model uses it.'},
  ]);
});

test('code, equations, lists and ambiguous layouts retain their literal formatting', () => {
  for (const text of ['async def run():\n    await task', 'dy/dx = lim\n  Δy/Δx', '- Keep evidence\n- Keep citations', 'Name  Value\nA     10', 'Title\nA long explanation follows this short heading.']) {
    assert.deepEqual(readingBlocks(text), [{kind:'literal', text}]);
  }
});

test('adjacent timed cues form reading groups while retaining exact offsets and overlapping times', async () => {
  const { transcriptReadingGroups } = await import('./reading-format');
  const text = 'A 🚀\nB\nC\nD';
  const cues = [
    {start:0,end:3,start_ms:0,end_ms:3000},
    {start:4,end:5,start_ms:2000,end_ms:2500},
    {start:6,end:7,start_ms:5000,end_ms:6000},
    {start:8,end:9,start_ms:6000,end_ms:51000},
  ];
  const groups = transcriptReadingGroups(text,cues);
  assert.deepEqual(groups.map(g => [g.text,g.start,g.end,g.start_ms,g.end_ms,g.cues.length]), [
    ['A 🚀\nB',0,5,0,3000,2], ['C',6,7,5000,6000,1], ['D',8,9,6000,51000,1],
  ]);
  assert.equal(cues[1].end_ms,2500);
});

test('fenced blocks keep blank lines and generated explanations retain existing line breaks', () => {
  assert.deepEqual(readingBlocks('```python\nvalue = 1\n\nprint(value)\n```'),[{kind:'literal',text:'```python\nvalue = 1\n\nprint(value)\n```'}]);
  assert.deepEqual(readingBlocks('Existing\nexplanation.',false),[{kind:'prose',text:'Existing\nexplanation.'}]);
});

test('caption groups stop at 900 code points and untimed cues remain separate', async () => {
  const { transcriptReadingGroups } = await import('./reading-format');
  const first='🚀'.repeat(450),second='b'.repeat(450);
  const groups=transcriptReadingGroups(first+'\n'+second,[{start:0,end:450,start_ms:0,end_ms:1000},{start:451,end:901,start_ms:1000,end_ms:2000}]);
  assert.equal(groups.length,2); assert.equal(groups[0].text,first);assert.equal(groups[1].start,451);
  assert.equal(transcriptReadingGroups('A\nB',[{start:0,end:1,start_ms:null,end_ms:null},{start:2,end:3,start_ms:null,end_ms:null}]).length,2);
});

test('all formatted blocks preserve every non-whitespace source character including qualifications', () => {
  for (const text of ['We suspect this\nmay help; it is not proven.','Math: α ≈ β\nKeep the qualifier.','Quotes: “exact”\r\n\r\nWords stay ordered.','```\n<a>\n\n</a>\n```','A 🚀\ncontinues here.']) {
    assert.equal(readingBlocks(text).map(block=>block.text).join('').replace(/\s/g,''),text.replace(/\s/g,''));
  }
});
