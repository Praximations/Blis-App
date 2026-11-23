import { parseRules } from '@/delivery/rules';
import { orderDate } from '@/lib/dates';
import { decodeEntities, parseHtml, plainText } from '@/lib/html';
import { appRoute, shopUrl } from '@/lib/links';
import { formatMoney, isMore, unitLabel } from '@/lib/money';
import { imageUrl, numericId } from '@/shopify/storefront';

describe('money', () => {
  const usd = (amount: string) => ({ amount, currencyCode: 'USD' });

  it('writes prices like the website: no trailing zeros', () => {
    expect(formatMoney(usd('16.0'))).toBe('$16');
    expect(formatMoney(usd('12.5'))).toBe('$12.50');
    expect(formatMoney(usd('1234.5'))).toBe('$1,234.50');
    expect(formatMoney(usd('30.0'), { trailingZeros: true })).toBe('$30.00');
    expect(formatMoney(null)).toBe('');
  });

  it('compares amounts', () => {
    expect(isMore(usd('20.0'), usd('16.0'))).toBe(true);
    expect(isMore(usd('0.0'), usd('16.0'))).toBe(false);
    expect(isMore(null, usd('16.0'))).toBe(false);
  });

  it('names a unit price', () => {
    expect(unitLabel({ referenceUnit: 'LB', referenceValue: 1 })).toBe('per lb');
    expect(unitLabel({ referenceUnit: 'G', referenceValue: 100 })).toBe('per 100 g');
    expect(unitLabel({ referenceUnit: null, referenceValue: 0 })).toBe('');
  });
});

describe('html', () => {
  it('turns a description into paragraphs, with bold, italic and links', () => {
    const blocks = parseHtml(
      '<p>Acacia honey with <strong>white truffle</strong> &amp; <em>love</em>.</p><p>See <a href="/collections/honey">all honey</a>.</p>',
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].spans).toEqual([
      { text: 'Acacia honey with ' },
      { text: 'white truffle', bold: true },
      { text: ' & ' },
      { text: 'love', italic: true },
      { text: '.' },
    ]);
    expect(blocks[1].spans[1]).toEqual({ text: 'all honey', href: '/collections/honey' });
  });

  it('reads lists and headings', () => {
    const blocks = parseHtml('<h3>Pairs with</h3><ul><li>Cheese</li><li><p>Bread</p></li></ul><ol><li>Open</li><li>Enjoy</li></ol>');
    expect(blocks.map((b) => [b.kind, b.marker, b.spans.map((s) => s.text).join('')])).toEqual([
      ['heading', undefined, 'Pairs with'],
      ['item', '•', 'Cheese'],
      ['item', '•', 'Bread'],
      ['item', '1.', 'Open'],
      ['item', '2.', 'Enjoy'],
    ]);
  });

  it('leaves out scripts, styles and empty paragraphs, and takes text without tags', () => {
    expect(parseHtml('<style>p{}</style><script>alert(1)</script><p> </p><div>Hello<br>there</div>')).toEqual([
      { kind: 'paragraph', marker: undefined, spans: [{ text: 'Hello' }, { text: '\nthere' }] },
    ]);
    expect(plainText('Just   text')).toBe('Just text');
    expect(parseHtml(null)).toEqual([]);
  });

  it('does not follow links that are not web addresses', () => {
    expect(parseHtml('<a href="javascript:alert(1)">x</a>')[0].spans[0].href).toBeUndefined();
  });

  it('decodes entities', () => {
    expect(decodeEntities('caf&eacute; &#8211; 5&nbsp;oz &#x263A; &unknown;')).toBe('café – 5 oz ☺ &unknown;');
  });
});

describe('links and ids', () => {
  it('knows which shop links open inside the app', () => {
    expect(appRoute('https://blisfarms.com/products/truffle-honey?variant=1')).toEqual({
      pathname: '/products/[handle]',
      params: { handle: 'truffle-honey' },
    });
    expect(appRoute('/collections/honey/products/truffle-honey')?.params.handle).toBe('truffle-honey');
    expect(appRoute('/collections/honey')).toEqual({ pathname: '/collections/[handle]', params: { handle: 'honey' } });
    expect(appRoute('/pages/about')).toBeNull();
  });

  it('builds shop addresses', () => {
    expect(shopUrl('/pages/about')).toBe('https://blisfarms.com/pages/about');
    expect(shopUrl('pages/about')).toBe('https://blisfarms.com/pages/about');
    expect(shopUrl('https://example.com/x')).toBe('https://example.com/x');
  });

  it('asks the CDN for the size the screen needs', () => {
    expect(imageUrl('https://cdn.shopify.com/s/files/1/1/files/a.png?v=1', 320.4)).toBe(
      'https://cdn.shopify.com/s/files/1/1/files/a.png?v=1&width=320',
    );
    expect(imageUrl('https://blisfarms.com/cdn/shop/files/a.webp', 5000)).toBe('https://blisfarms.com/cdn/shop/files/a.webp?width=2048');
    expect(imageUrl('https://cdn.shopify.com/a.png?width=100&v=2', 300)).toBe('https://cdn.shopify.com/a.png?v=2&width=300');
    expect(imageUrl('https://example.com/a.png', 300)).toBe('https://example.com/a.png');
    expect(imageUrl(null, 300)).toBeUndefined();
  });

  it('reads the number out of a Shopify id', () => {
    expect(numericId('gid://shopify/ProductVariant/53106365137263')).toBe('53106365137263');
    expect(numericId('gid://shopify/Cart/abc?key=1')).toBe('abc');
  });

  it('writes an order date', () => {
    expect(orderDate('2026-11-16T15:00:00Z')).toMatch(/^Nov 1[56], 2026$/);
    expect(orderDate('nonsense')).toBe('');
  });
});

describe('parseRules', () => {
  const published = {
    version: 1,
    source: 'blis-delivery',
    timezone: 'America/New_York',
    slots: [
      {
        day: 'Wednesday',
        type: 'delivery',
        location: '',
        locationId: '',
        details: '',
        cutoffDay: 'sunday',
        cutoffHour: 12,
        cutoffMinute: 0,
        cutoffDaysBefore: 3,
        areas: ['Boca Raton'],
        times: ['9 am – 12 pm'],
        windows: ['09:00-12:00'],
      },
      { day: 'saturday', type: 'pickup', location: 'Swank Farmers Market', locationId: 'loc-swank', cutoffDay: 'thursday', cutoffHour: '12' },
      { day: 'someday', type: 'delivery', cutoffDay: 'sunday' },
    ],
    zips: { '33432': 'Boca Raton', abc: 'Nowhere', '33444': 7 },
    blackouts: [{ start: '2026-12-25', end: '2026-12-25', method: null }, { start: 'xmas', end: '2026-12-26' }],
    dayTagPrefix: 'delivery-day:',
  };

  it('keeps what is well formed', () => {
    const rules = parseRules(published);
    expect(rules?.source).toBe('blis-delivery');
    expect(rules?.slots.map((s) => [s.day, s.type, s.cutoffDaysBefore])).toEqual([
      ['wednesday', 'delivery', 3],
      ['saturday', 'pickup', null],
    ]);
    expect(rules?.slots[1].cutoffHour).toBe(12);
    expect(rules?.zips).toEqual({ '33432': 'Boca Raton' });
    expect(rules?.blackouts).toEqual([{ start: '2026-12-25', end: '2026-12-25', method: null }]);
  });

  it('refuses what is not rules', () => {
    expect(parseRules(null)).toBeNull();
    expect(parseRules({ slots: 'none' })).toBeNull();
    expect(parseRules({ slots: [{ day: 'someday' }] })).toBeNull();
  });
});

describe('pickup address', () => {
  // Imported here to keep the file's other imports as they were.
  const { pickupAddress } = jest.requireActual('@/lib/links') as typeof import('@/lib/links');

  it('finds the street in a pickup place\'s details', () => {
    expect(pickupAddress('Swank Farmers Market', '10 am – 1 pm · 14311 North Road, Loxahatchee Groves')).toBe(
      'Swank Farmers Market, 14311 North Road, Loxahatchee Groves',
    );
    expect(pickupAddress('Swank Farmers Market', '10 am – 1 pm · 14311 North Road, Loxahatchee Groves, 33470')).toBe(
      'Swank Farmers Market, 14311 North Road, Loxahatchee Groves, 33470',
    );
  });

  it('gives nothing when the details hold only hours, or nothing', () => {
    expect(pickupAddress('Market', '10 am – 1 pm')).toBe('');
    expect(pickupAddress('Market', '')).toBe('');
  });
});
