// The parts of the Storefront API the app reads, as it reads them.

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface Image {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface UnitPriceMeasurement {
  measuredType: string | null;
  quantityUnit: string | null;
  quantityValue: number;
  referenceUnit: string | null;
  referenceValue: number;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface VariantSummary {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  unitPrice: Money | null;
  unitPriceMeasurement: UnitPriceMeasurement | null;
}

export interface Variant extends VariantSummary {
  sku: string | null;
  selectedOptions: SelectedOption[];
  image: Image | null;
}

/** What a product card needs. */
export interface ProductSummary {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  availableForSale: boolean;
  tags: string[];
  /** custom.local_delivery_only ("true"); only read with a Storefront token. */
  localDeliveryOnly?: { value: string | null } | null;
  featuredImage: Image | null;
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { maxVariantPrice: Money };
  /** The first two variants: enough to know whether there is a choice to make. */
  variants: { nodes: VariantSummary[] };
}

export interface ProductOption {
  id: string;
  name: string;
  optionValues: { id: string; name: string }[];
}

export interface Product extends Omit<ProductSummary, 'variants'> {
  description: string;
  descriptionHtml: string;
  onlineStoreUrl: string | null;
  images: { nodes: Image[] };
  options: ProductOption[];
  variants: { nodes: Variant[] };
  /** custom.accent_color: the tint behind the product's photos. */
  accentColor?: { value: string | null } | null;
  moodImage1?: MoodImage | null;
  moodImage2?: MoodImage | null;
  moodImage3?: MoodImage | null;
  /** custom.nutrition_label: the store's Nutrition label entry (see nutrition.ts). */
  nutritionLabel?: { reference: { fields?: { key: string; value: string | null }[] } | null } | null;
}

/** A photo of the product in use (custom.mood_image_1…3). */
export interface MoodImage {
  reference: { image?: Image | null } | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface CollectionSummary {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: Image | null;
  /** The first product, to know whether there is anything to buy. */
  products?: { nodes: { id: string }[] };
}

export interface FilterValue {
  id: string;
  label: string;
  count: number;
  /** JSON for the `filters` argument, as Shopify hands it out. */
  input: string;
}

export interface Filter {
  id: string;
  label: string;
  type: 'LIST' | 'PRICE_RANGE' | 'BOOLEAN';
  values: FilterValue[];
}

export interface CollectionPage extends CollectionSummary {
  products: { filters: Filter[]; nodes: ProductSummary[]; pageInfo: PageInfo };
}

export interface Attribute {
  key: string;
  value: string | null;
}

export interface CartLine {
  id: string;
  quantity: number;
  attributes: Attribute[];
  cost: {
    totalAmount: Money;
    subtotalAmount: Money;
    amountPerQuantity: Money;
    compareAtAmountPerQuantity: Money | null;
  };
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    image: Image | null;
    selectedOptions: SelectedOption[];
    product: {
      id: string;
      handle: string;
      title: string;
      productType: string;
      tags: string[];
      localDeliveryOnly?: { value: string | null } | null;
      featuredImage: Image | null;
    };
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  note: string | null;
  attributes: Attribute[];
  discountCodes: { code: string; applicable: boolean }[];
  cost: { subtotalAmount: Money; totalAmount: Money };
  lines: { nodes: CartLine[] };
}

export interface UserError {
  field: string[] | null;
  message: string;
  code?: string | null;
}

export interface MenuItem {
  id: string;
  title: string;
  url: string | null;
  type: string;
  items?: MenuItem[];
}

export interface ShopInfo {
  name: string;
  description: string | null;
  privacyPolicy: Policy | null;
  refundPolicy: Policy | null;
  shippingPolicy: Policy | null;
  termsOfService: Policy | null;
}

export interface Policy {
  title: string;
  handle: string;
  url: string;
}

export interface ContentPage {
  id: string;
  handle: string;
  title: string;
  body: string;
  onlineStoreUrl: string | null;
}
