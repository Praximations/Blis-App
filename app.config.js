// What app.json can't say on its own. Shopify sends a customer back from
// sign-in to shop.<shop id>.app://callback, so the app must answer to that
// address: it is built here from the same shop id the code uses
// (EXPO_PUBLIC_SHOPIFY_SHOP_ID), so the two can't drift apart.

const DEFAULT_SHOP_ID = '95581405551';

module.exports = ({ config }) => {
  const shopId = (process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID || DEFAULT_SHOP_ID).trim();
  return {
    ...config,
    scheme: ['blisfarms', `shop.${shopId}.app`],
  };
};
