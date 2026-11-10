import type {ExportEntity} from '../model';

interface Node {
  entity?: ExportEntity;
  start: number;
  end: number;
  children: Node[];
}

export interface EntityRenderer {
  /** Escape a plain text fragment */
  text(value: string): string;
  /** Wrap the rendered content of an entity. `raw` is the unescaped source text. */
  wrap(entity: ExportEntity, inner: string, raw: string): string;
}

/** Entities that must not contain formatted children */
const VERBATIM = new Set(['code', 'pre']);

function buildTree(text: string, entities: ExportEntity[]): Node {
  const root: Node = {start: 0, end: text.length, children: []};
  const sorted = [...entities]
    .filter((e) => e.length > 0 && e.offset < text.length)
    .sort((a, b) => a.offset - b.offset || b.length - a.length);

  const stack: Node[] = [root];
  for(const entity of sorted) {
    while(stack.length > 1 && stack[stack.length - 1].end <= entity.offset) stack.pop();
    const parent = stack[stack.length - 1];
    // Overlapping (non-nested) entities are clipped to the parent.
    const node: Node = {
      entity,
      start: entity.offset,
      end: Math.min(entity.offset + entity.length, parent.end),
      children: []
    };
    parent.children.push(node);
    stack.push(node);
  }
  return root;
}

function renderNode(text: string, node: Node, r: EntityRenderer): string {
  const raw = text.slice(node.start, node.end);
  if(node.entity && VERBATIM.has(node.entity.type)) {
    return r.wrap(node.entity, r.text(raw), raw);
  }

  let out = '';
  let pos = node.start;
  for(const child of node.children) {
    if(child.start > pos) out += r.text(text.slice(pos, child.start));
    out += renderNode(text, child, r);
    pos = child.end;
  }
  if(pos < node.end) out += r.text(text.slice(pos, node.end));

  return node.entity ? r.wrap(node.entity, out, raw) : out;
}

export function renderEntities(text: string, entities: ExportEntity[], r: EntityRenderer): string {
  return renderNode(text, buildTree(text, entities), r);
}
