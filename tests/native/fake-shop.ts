// A small stand-in for Shopify's Storefront API: two products, a menu and a
// cart that behaves like the real one (lines, totals, attributes, and a
// warning when stock runs short). Answers by operation name.

const usd = (amount: number) => ({ amount: String(amount), currencyCode: 'USD' });
const image = (name: string) => ({ url: `https://cdn.shopify.com/s/files/1/1/files/${name}.png?v=1`, altText: null, width: 800, height: 800 });

interface FakeVariant {
  id: string;
  title: string;
  price: number;
  stock: number;
}
interface FakeProduct {
  id: string;
  handle: string;
  title: string;
  productType: string;
  tags: string[];
  variants: FakeVariant[];
}

export const honey: FakeProduct = {
  id: 'gid://shopify/Product/1',
  handle: 'truffle-honey',
  title: 'Truffle Honey',
  productType: 'Honey',
  tags: ['Honey'],
  variants: [
    { id: 'gid://shopify/ProductVariant/11', title: '50g', price: 16, stock: 15 },
    { id: 'gid://shopify/ProductVariant/12', title: '170g', price: 30, stock: 15 },
  ],
};
export const milk: FakeProduct = {
  id: 'gid://shopify/Product/2',
  handle: 'guernsey-raw-milk',
  title: 'Guernsey Raw Milk',
  productType: 'Dairy',
  // Fresh: our drivers bring it, it can't be shipped.
  tags: ['Dairy & Eggs', 'local-delivery-only'],
  variants: [{ id: 'gid://shopify/ProductVariant/21', title: 'Default Title', price: 19.75, stock: 3 }],
};
const products = [honey, milk];

const variantOut = (v: FakeVariant) => ({
  id: v.id,
  title: v.title,
  availableForSale: v.stock > 0,
  price: usd(v.price),
  compareAtPrice: null,
  unitPrice: null,
  unitPriceMeasurement: null,
});
const summary = (p: FakeProduct) => ({
  id: p.id,
  handle: p.handle,
  title: p.title,
  vendor: 'Blis Farms',
  productType: p.productType,
  availableForSale: p.variants.some((v) => v.stock > 0),
  tags: p.tags,
  featuredImage: image(p.handle),
  priceRange: { minVariantPrice: usd(Math.min(...p.variants.map((v) => v.price))), maxVariantPrice: usd(Math.max(...p.variants.map((v) => v.price))) },
  compareAtPriceRange: { maxVariantPrice: usd(0) },
  variants: { nodes: p.variants.slice(0, 2).map(variantOut) },
});
const full = (p: FakeProduct) => ({
  ...summary(p),
  description: `${p.title}, from the farm.`,
  descriptionHtml: `<p>${p.title}, <strong>from the farm</strong>.</p>`,
  onlineStoreUrl: `https://blisfarms.com/products/${p.handle}`,
  images: { nodes: [image(p.handle), image(`${p.handle}-2`)] },
  options: p.variants.length > 1 ? [{ id: 'o1', name: 'Size', optionValues: p.variants.map((v, i) => ({ id: `ov${i}`, name: v.title })) }] : [{ id: 'o1', name: 'Title', optionValues: [{ id: 'ov0', name: 'Default Title' }] }],
  variants: {
    nodes: p.variants.map((v) => ({ ...variantOut(v), sku: null, selectedOptions: [{ name: p.variants.length > 1 ? 'Size' : 'Title', value: v.title }], image: null })),
  },
});

export class FakeShop {
  cart: { id: string; lines: { id: string; variantId: string; quantity: number }[]; attributes: { key: string; value: string }[]; discountCodes: { code: string; applicable: boolean }[] } | null = null;
  /** Every operation asked for, in order. */
  calls: { name: string; variables: Record<string, unknown> }[] = [];
  private nextLine = 1;

  private cartOut() {
    const c = this.cart;
    if (!c) return null;
    const lines = c.lines.map((l) => {
      const product = products.find((p) => p.variants.some((v) => v.id === l.variantId))!;
      const variant = product.variants.find((v) => v.id === l.variantId)!;
      return {
        id: l.id,
        quantity: l.quantity,
        attributes: [],
        cost: { totalAmount: usd(variant.price * l.quantity), subtotalAmount: usd(variant.price * l.quantity), amountPerQuantity: usd(variant.price), compareAtAmountPerQuantity: null },
        merchandise: {
          id: variant.id,
          title: variant.title,
          availableForSale: variant.stock > 0,
          image: null,
          selectedOptions: [],
          product: { id: product.id, handle: product.handle, title: product.title, productType: product.productType, tags: product.tags, featuredImage: image(product.handle) },
        },
      };
    });
    const total = lines.reduce((sum, l) => sum + Number(l.cost.totalAmount.amount), 0);
    return {
      id: c.id,
      checkoutUrl: 'https://blisfarms.com/cart/c/test',
      totalQuantity: c.lines.reduce((sum, l) => sum + l.quantity, 0),
      note: null,
      attributes: c.attributes,
      discountCodes: c.discountCodes,
      cost: { subtotalAmount: usd(total), totalAmount: usd(total) },
      lines: { nodes: lines },
    };
  }

  /** Puts lines in the cart the way Shopify does: capped at stock, with a warning. */
  private addLines(wanted: { merchandiseId: string; quantity: number }[]) {
    const warnings: { code: string; message: string; target: string }[] = [];
    for (const w of wanted) {
      const variant = products.flatMap((p) => p.variants).find((v) => v.id === w.merchandiseId);
      if (!variant) continue;
      let line = this.cart!.lines.find((l) => l.variantId === variant.id);
      if (!line) {
        line = { id: `gid://shopify/CartLine/${this.nextLine++}`, variantId: variant.id, quantity: 0 };
        this.cart!.lines.push(line);
      }
      const asked = line.quantity + w.quantity;
      line.quantity = Math.min(asked, variant.stock);
      if (variant.stock <= 0) warnings.push({ code: 'MERCHANDISE_OUT_OF_STOCK', message: 'Sold out.', target: line.id });
      else if (asked > variant.stock) warnings.push({ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: `Only ${variant.stock} items were added to your cart due to availability.`, target: line.id });
    }
    return warnings;
  }

  private answer(name: string, v: Record<string, any>): unknown {
    const payload = (warnings: unknown[] = []) => ({ cart: this.cartOut(), userErrors: [], warnings });
    switch (name) {
      case 'Collections':
        return { collections: { nodes: [
          { id: 'c1', handle: 'pantry', title: 'Pantry', description: 'Greek honeys and more.', image: null, products: { nodes: [{ id: honey.id }] } },
          { id: 'c2', handle: 'dairy-eggs', title: 'Dairy & Eggs', description: 'Raw milk and eggs.', image: null, products: { nodes: [{ id: milk.id }] } },
          { id: 'c3', handle: 'bakery', title: 'Bakery', description: '', image: null, products: { nodes: [] } },
        ] } };
      case 'Menu':
        return v.handle === 'shop-sections'
          ? { menu: { items: [
              { id: 'm0', title: 'Breads & Bakery', url: 'https://blisfarms.com/collections/bakery', type: 'COLLECTION', items: [] },
              { id: 'm1', title: 'Pantry', url: 'https://blisfarms.com/collections/pantry', type: 'COLLECTION', items: [{ id: 'm1a', title: 'Honey', url: 'https://blisfarms.com/collections/honey', type: 'COLLECTION' }] },
              { id: 'm2', title: 'Dairy & Eggs', url: 'https://blisfarms.com/collections/dairy-eggs', type: 'COLLECTION', items: [] },
            ] } }
          : { menu: null };
      case 'AllProducts':
        return { products: { nodes: products.map(summary), pageInfo: { hasNextPage: false, endCursor: null } } };
      case 'Collection': {
        const list = v.handle === 'dairy-eggs' ? [milk] : v.handle === 'pantry' ? [honey] : [];
        return { collection: v.handle === 'nowhere' ? null : { id: v.handle, handle: v.handle, title: v.handle, description: 'From our farms.', image: null, products: { filters: [], nodes: list.map(summary), pageInfo: { hasNextPage: false, endCursor: null } } } };
      }
      case 'Product': {
        const p = products.find((x) => x.handle === v.handle);
        return { product: p ? full(p) : null };
      }
      case 'Recommendations':
        return { productRecommendations: products.filter((p) => p.handle !== v.handle).map(summary) };
      case 'ProductsById':
        return { nodes: (v.ids as string[]).map((id) => products.find((p) => p.id === id)).map((p) => (p ? summary(p) : null)) };
      case 'Search':
        return { search: { totalCount: 1, nodes: [summary(honey)], pageInfo: { hasNextPage: false, endCursor: null } } };
      case 'PredictiveSearch':
        return { predictiveSearch: { queries: [{ text: 'honey' }], collections: [], products: [{ id: honey.id, handle: honey.handle, title: honey.title, featuredImage: image(honey.handle), priceRange: { minVariantPrice: usd(16) } }] } };
      case 'Shop':
        return { shop: { name: 'Blis Farms', description: null, privacyPolicy: null, refundPolicy: null, shippingPolicy: null, termsOfService: null } };
      case 'Cart':
        return { cart: this.cart && this.cart.id === v.id ? this.cartOut() : null };
      case 'CartCreate':
        this.cart = { id: 'gid://shopify/Cart/test?key=1', lines: [], attributes: v.input.attributes ?? [], discountCodes: [] };
        return { cartCreate: payload(this.addLines(v.input.lines ?? [])) };
      case 'CartLinesAdd':
        return { cartLinesAdd: payload(this.addLines(v.lines)) };
      case 'CartLinesUpdate': {
        const warnings: unknown[] = [];
        for (const change of v.lines as { id: string; quantity: number }[]) {
          const line = this.cart!.lines.find((l) => l.id === change.id);
          if (!line) continue;
          const stock = products.flatMap((p) => p.variants).find((x) => x.id === line.variantId)!.stock;
          line.quantity = Math.min(change.quantity, stock);
          if (change.quantity > stock) warnings.push({ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'Not enough.', target: line.id });
        }
        this.cart!.lines = this.cart!.lines.filter((l) => l.quantity > 0);
        return { cartLinesUpdate: payload(warnings) };
      }
      case 'CartLinesRemove':
        this.cart!.lines = this.cart!.lines.filter((l) => !(v.lineIds as string[]).includes(l.id));
        return { cartLinesRemove: payload() };
      case 'CartAttributesUpdate':
        this.cart!.attributes = v.attributes;
        return { cartAttributesUpdate: payload() };
      case 'CartDiscountCodesUpdate':
        this.cart!.discountCodes = (v.discountCodes as string[]).map((code) => ({ code, applicable: code.toUpperCase() === 'ENJOY15' }));
        return { cartDiscountCodesUpdate: payload() };
      case 'CartBuyerIdentityUpdate':
        return { cartBuyerIdentityUpdate: payload() };
      case 'CartNoteUpdate':
        return { cartNoteUpdate: payload() };
      default:
        return null;
    }
  }

  /** `fetch`, as the app calls it. */
  fetch = async (url: string, init?: { body?: string }) => {
    const respond = (status: number, body: unknown, type = 'application/json') => ({ ok: status < 400, status, headers: new Headers({ 'content-type': type }), json: async () => body, text: async () => '' });
    // The Blis Delivery app isn't installed: Shopify answers with its own "not found" page.
    if (!String(url).includes('/graphql.json')) return respond(404, null, 'text/html');
    const { query, variables = {} } = JSON.parse(init?.body ?? '{}') as { query: string; variables?: Record<string, unknown> };
    const name = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '';
    this.calls.push({ name, variables });
    const data = this.answer(name, variables);
    return data ? respond(200, { data }) : respond(200, { errors: [{ message: `The fake shop has no answer for ${name}` }] });
  };

  attribute(key: string) {
    return this.cart?.attributes.find((a) => a.key === key)?.value ?? '';
  }
}
