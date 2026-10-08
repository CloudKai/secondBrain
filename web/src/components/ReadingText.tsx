import type { ReactNode } from 'react';
import { readingBlocks } from '../lib/reading-format';

/** A reading projection; citations and storage always keep the original text. */
export default function ReadingText({text,source=false,children,original,originalLabel='Original captured text'}:{text:string;source?:boolean;children?:ReactNode;original?:ReactNode;originalLabel?:string}) {
  const blocks = readingBlocks(text,source);
  const simplified = source && blocks.map(block => block.text).join('\n\n') !== text;
  return <div className="reading-text">
    {!blocks.length && <p className="reading-paragraph">{text}{children}</p>}
    {blocks.map((block,index) => {
      const content = <>{block.text}{index === blocks.length - 1 && children && <> {children}</>}</>;
      return block.kind === 'literal'
        ? <div className="reading-literal" key={index}>{content}</div>
        : <p className="reading-paragraph" key={index}>{content}</p>;
    })}
    {(simplified || original) && <details className="reading-original"><summary>{originalLabel}</summary>{original ?? <pre>{text}</pre>}</details>}
  </div>;
}
