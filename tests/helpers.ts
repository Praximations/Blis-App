// Small carts for tests.

import type { Cart, CartLine } from '@/shopify/types';

const money = { amount: '10.0', currencyCode: 'USD' };

export function line(options: {
  productId?: string;
  variantId?: string;
  quantity?: number;
  title?: string;
  productType?: string;
  tags?: string[];
  localOnly?: boolean;
}): CartLine {
  const { productId = '1', variantId = '2', quantity = 1, title = 'Product', productType = 'Pantry', tags = [], localOnly = false } = options;
  return {
    id: `gid://shopify/CartLine/${variantId}`,
    quantity,
    attributes: [],
    cost: { totalAmount: money, subtotalAmount: money, amountPerQuantity: money, compareAtAmountPerQuantity: null },
    merchandise: {
      id: `gid://shopify/ProductVariant/${variantId}`,
      title: 'Default Title',
      availableForSale: true,
      image: null,
      selectedOptions: [],
      product: {
        id: `gid://shopify/Product/${productId}`,
        handle: title.toLowerCase().replace(/\s+/g, '-'),
        title,
        productType,
        tags,
        localDeliveryOnly: localOnly ? { value: 'true' } : null,
        featuredImage: null,
      },
    },
  };
}

export function cartWith(lines: CartLine[], attributes: { key: string; value: string | null }[] = []): Cart {
  return {
    id: 'gid://shopify/Cart/test?key=1',
    checkoutUrl: 'https://example.test/checkout',
    totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    note: null,
    attributes,
    discountCodes: [],
    cost: { subtotalAmount: money, totalAmount: money },
    lines: { nodes: lines },
  };
}
