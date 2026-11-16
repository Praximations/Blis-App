// Product descriptions come from Shopify as HTML. The app shows them as
// native text, so this turns the HTML into paragraphs, headings and list
// items with bold, italic and links. Anything else (tables, images, styles)
// is read as plain text or left out.

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export interface Block {
  kind: 'paragraph' | 'heading' | 'item';
  spans: Span[];
  /** List items: "•" or "1." */
  marker?: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  eacute: 'é',
  egrave: 'è',
  copy: '©',
  reg: '®',
  trade: '™',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'blockquote', 'table', 'tr', 'figure', 'figcaption']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const SKIPPED = new Set(['script', 'style', 'iframe', 'svg', 'noscript', 'template', 'video', 'audio', 'form']);

export function parseHtml(html: string | null | undefined): Block[] {
  const blocks: Block[] = [];
  if (!html) return blocks;

  let bold = 0;
  let italic = 0;
  let href: string | undefined;
  let skip: string | null = null;
  // (The cast keeps TypeScript from deciding it is always null: it is set in the helpers below.)
  let current = null as Block | null;
  const lists: { ordered: boolean; count: number }[] = [];

  const close = () => {
    if (!current) return;
    // Tidy the edges and drop paragraphs that turned out empty.
    const spans = current.spans;
    if (spans.length) {
      spans[0].text = spans[0].text.replace(/^\s+/, '');
      spans[spans.length - 1].text = spans[spans.length - 1].text.replace(/\s+$/, '');
    }
    current.spans = spans.filter((s) => s.text !== '');
    if (current.spans.length) blocks.push(current);
    current = null;
  };
  const open = (kind: Block['kind'], marker?: string) => {
    close();
    current = { kind, spans: [], marker };
  };
  const write = (raw: string) => {
    let text = decodeEntities(raw).replace(/[ \t\r\n\f]+/g, ' ');
    if (!current) {
      if (!text.trim()) return;
      current = { kind: 'paragraph', spans: [] };
    }
    const spans = current.spans;
    const last = spans[spans.length - 1];
    if ((!last || /\s$/.test(last.text)) && text.startsWith(' ')) text = text.slice(1);
    if (!text) return;
    const same = last && !!last.bold === bold > 0 && !!last.italic === italic > 0 && last.href === href;
    if (same) last.text += text;
    else spans.push({ text, bold: bold > 0 || undefined, italic: italic > 0 || undefined, href });
  };

  const tokens = html.split(/(<!--[\s\S]*?-->|<[^>]+>)/);
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith('<!--')) continue;
    if (token[0] !== '<') {
      if (!skip) write(token);
      continue;
    }
    const match = /^<\s*(\/)?\s*([a-zA-Z0-9]+)([^>]*)>$/.exec(token);
    if (!match) continue;
    const closing = !!match[1];
    const tag = match[2].toLowerCase();
    const attributes = match[3] ?? '';

    if (skip) {
      if (closing && tag === skip) skip = null;
      continue;
    }
    if (SKIPPED.has(tag)) {
      if (!closing && !/\/\s*$/.test(attributes)) skip = tag;
      continue;
    }

    if (tag === 'br') {
      if (current) current.spans.push({ text: '\n' });
    } else if (BLOCK_TAGS.has(tag)) {
      // Inside a list item a paragraph is part of the item.
      if (current?.kind === 'item' && tag !== 'table' && tag !== 'tr') {
        if (closing) write(' ');
      } else if (closing) close();
      else open('paragraph');
    } else if (HEADING_TAGS.has(tag)) {
      if (closing) close();
      else open('heading');
    } else if (tag === 'ul' || tag === 'ol') {
      close();
      if (closing) lists.pop();
      else lists.push({ ordered: tag === 'ol', count: 0 });
    } else if (tag === 'li') {
      if (closing) close();
      else {
        const list = lists[lists.length - 1];
        if (list) list.count += 1;
        open('item', list?.ordered ? `${list.count}.` : '•');
      }
    } else if (tag === 'td' || tag === 'th') {
      if (closing) write(' ');
    } else if (tag === 'strong' || tag === 'b') {
      bold = Math.max(0, bold + (closing ? -1 : 1));
    } else if (tag === 'em' || tag === 'i') {
      italic = Math.max(0, italic + (closing ? -1 : 1));
    } else if (tag === 'a') {
      if (closing) href = undefined;
      else {
        const link = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
        const url = decodeEntities(link?.[2] ?? link?.[3] ?? link?.[4] ?? '').trim();
        href = /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : undefined;
      }
    }
  }
  close();
  return blocks;
}

/** Plain text, for a card's overview or a share message. */
export function plainText(html: string | null | undefined): string {
  return parseHtml(html)
    .map((b) => b.spans.map((s) => s.text).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
