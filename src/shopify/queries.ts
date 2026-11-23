// Storefront API documents. Kept small on purpose: without a token Shopify
// allows a query cost of 1,000, and a phone doesn't need more than it shows.

const MONEY = `amount currencyCode`;
const IMAGE = `url altText width height`;

// Metafields can only be read with a Storefront token; without one the
// fields are left out (Shopify would refuse them).
const HAS_TOKEN = !!(process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? '').trim();
/** "Local delivery only": fresh and chilled products that can't be shipped. */
const LOCAL_ONLY = HAS_TOKEN ? `localDeliveryOnly: metafield(namespace: "custom", key: "local_delivery_only") { value }` : '';
const MOOD_IMAGE = `reference { ... on MediaImage { image { ${IMAGE} } } }`;
const PRODUCT_EXTRAS = HAS_TOKEN
  ? `
      accentColor: metafield(namespace: "custom", key: "accent_color") { value }
      moodImage1: metafield(namespace: "custom", key: "mood_image_1") { ${MOOD_IMAGE} }
      moodImage2: metafield(namespace: "custom", key: "mood_image_2") { ${MOOD_IMAGE} }
      moodImage3: metafield(namespace: "custom", key: "mood_image_3") { ${MOOD_IMAGE} }
      nutritionLabel: metafield(namespace: "custom", key: "nutrition_label") {
        reference { ... on Metaobject { fields { key value } } }
      }`
  : '';

const VARIANT_SUMMARY = /* GraphQL */ `
  id
  title
  availableForSale
  price { ${MONEY} }
  compareAtPrice { ${MONEY} }
  unitPrice { ${MONEY} }
  unitPriceMeasurement { measuredType quantityUnit quantityValue referenceUnit referenceValue }
`;

export const PRODUCT_CARD = /* GraphQL */ `
  fragment ProductCard on Product {
    id
    handle
    title
    vendor
    productType
    availableForSale
    tags
    ${LOCAL_ONLY}
    featuredImage { ${IMAGE} }
    priceRange {
      minVariantPrice { ${MONEY} }
      maxVariantPrice { ${MONEY} }
    }
    compareAtPriceRange { maxVariantPrice { ${MONEY} } }
    variants(first: 2) { nodes { ${VARIANT_SUMMARY} } }
  }
`;

export const COLLECTIONS = /* GraphQL */ `
  query Collections($first: Int!) {
    collections(first: $first, sortKey: TITLE) {
      nodes {
        id
        handle
        title
        description
        image { ${IMAGE} }
        products(first: 1) { nodes { id } }
      }
    }
  }
`;

export const COLLECTION = /* GraphQL */ `
  ${PRODUCT_CARD}
  query Collection(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $filters: [ProductFilter!]
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { ${IMAGE} }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        filters {
          id
          label
          type
          values { id label count input }
        }
        nodes { ...ProductCard }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const ALL_PRODUCTS = /* GraphQL */ `
  ${PRODUCT_CARD}
  query AllProducts($first: Int!, $after: String, $sortKey: ProductSortKeys, $reverse: Boolean, $query: String) {
    products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, query: $query) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PRODUCT = /* GraphQL */ `
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      handle
      title
      vendor
      productType
      availableForSale
      tags
      ${LOCAL_ONLY}${PRODUCT_EXTRAS}
      description
      descriptionHtml
      onlineStoreUrl
      featuredImage { ${IMAGE} }
      images(first: 12) { nodes { ${IMAGE} } }
      priceRange {
        minVariantPrice { ${MONEY} }
        maxVariantPrice { ${MONEY} }
      }
      compareAtPriceRange { maxVariantPrice { ${MONEY} } }
      options {
        id
        name
        optionValues { id name }
      }
      variants(first: 100) {
        nodes {
          ${VARIANT_SUMMARY}
          sku
          selectedOptions { name value }
          image { ${IMAGE} }
        }
      }
    }
  }
`;

export const RECOMMENDATIONS = /* GraphQL */ `
  ${PRODUCT_CARD}
  query Recommendations($handle: String!) {
    productRecommendations(productHandle: $handle, intent: RELATED) { ...ProductCard }
  }
`;

export const PRODUCTS_BY_ID = /* GraphQL */ `
  ${PRODUCT_CARD}
  query ProductsById($ids: [ID!]!) {
    nodes(ids: $ids) { ...ProductCard }
  }
`;

export const SEARCH = /* GraphQL */ `
  ${PRODUCT_CARD}
  query Search($query: String!, $first: Int!, $after: String) {
    search(query: $query, first: $first, after: $after, types: [PRODUCT], unavailableProducts: LAST) {
      totalCount
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PREDICTIVE_SEARCH = /* GraphQL */ `
  query PredictiveSearch($query: String!) {
    predictiveSearch(query: $query, limit: 6, types: [PRODUCT, COLLECTION, QUERY]) {
      queries { text }
      collections { id handle title }
      products {
        id
        handle
        title
        featuredImage { ${IMAGE} }
        priceRange { minVariantPrice { ${MONEY} } }
      }
    }
  }
`;

export const SHOP = /* GraphQL */ `
  query Shop {
    shop {
      name
      description
      privacyPolicy { title handle url }
      refundPolicy { title handle url }
      shippingPolicy { title handle url }
      termsOfService { title handle url }
    }
  }
`;

export const MENU = /* GraphQL */ `
  query Menu($handle: String!) {
    menu(handle: $handle) {
      items {
        id
        title
        url
        type
        items { id title url type }
      }
    }
  }
`;

export const PAGE = /* GraphQL */ `
  query Page($handle: String!) {
    page(handle: $handle) {
      id
      handle
      title
      body
      onlineStoreUrl
    }
  }
`;

/** The rules the delivery app publishes for the website (needs a token). */
export const DELIVERY_RULES = /* GraphQL */ `
  query DeliveryRules {
    shop {
      metafield(namespace: "blis_delivery", key: "rules") { value }
    }
  }
`;

// ─── Cart ───────────────────────────────────────────────────────────────────

export const CART = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    note
    attributes { key value }
    discountCodes { code applicable }
    cost {
      subtotalAmount { ${MONEY} }
      totalAmount { ${MONEY} }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        attributes { key value }
        cost {
          totalAmount { ${MONEY} }
          subtotalAmount { ${MONEY} }
          amountPerQuantity { ${MONEY} }
          compareAtAmountPerQuantity { ${MONEY} }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            image { ${IMAGE} }
            selectedOptions { name value }
            product {
              id
              handle
              title
              productType
              tags
              ${LOCAL_ONLY}
              featuredImage { ${IMAGE} }
            }
          }
        }
      }
    }
  }
`;

// Errors stop a change; warnings come with one that went through differently
// (sold out, or fewer in stock than asked for).
const USER_ERRORS = `userErrors { field message code } warnings { code message target }`;

export const CART_QUERY = /* GraphQL */ `
  ${CART}
  query Cart($id: ID!) {
    cart(id: $id) { ...CartFields }
  }
`;

export const CART_CREATE = /* GraphQL */ `
  ${CART}
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_LINES_ADD = /* GraphQL */ `
  ${CART}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_LINES_UPDATE = /* GraphQL */ `
  ${CART}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_LINES_REMOVE = /* GraphQL */ `
  ${CART}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_ATTRIBUTES_UPDATE = /* GraphQL */ `
  ${CART}
  mutation CartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
    cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_NOTE_UPDATE = /* GraphQL */ `
  ${CART}
  mutation CartNoteUpdate($cartId: ID!, $note: String!) {
    cartNoteUpdate(cartId: $cartId, note: $note) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_DISCOUNT_CODES_UPDATE = /* GraphQL */ `
  ${CART}
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;

export const CART_BUYER_IDENTITY_UPDATE = /* GraphQL */ `
  ${CART}
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart { ...CartFields }
      ${USER_ERRORS}
    }
  }
`;
