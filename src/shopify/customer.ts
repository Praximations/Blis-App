// Signing in and reading a customer's own orders: Shopify's Customer
// Account API. The shop uses new customer accounts (a one-time code by
// email, no password), so signing in is Shopify's own page in the phone's
// browser sheet, and the app gets a token back (OAuth with PKCE; the app is
// a "public" client and holds no secret).

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { config } from '@/config';

import type { Image, Money } from './types';

// Closes the sign-in pop-up when the web build is the redirect target.
WebBrowser.maybeCompleteAuthSession();

/** Can customers sign in inside the app? Needs the client id from the Shopify admin. */
export const signInAvailable = !!config.customerClientId;

/** Where Shopify sends the customer back to. Mobile clients must use shop.<id>.app. */
export const redirectUri =
  Platform.OS === 'web' ? AuthSession.makeRedirectUri({ path: 'account' }) : `shop.${config.shopId}.app://callback`;

const SCOPES = ['openid', 'email', 'customer-account-api:full'];

export class CustomerError extends Error {
  /** The session is no longer good: sign in again. */
  readonly expired: boolean;
  /** Shopify refused the query itself (a field it doesn't have). */
  readonly invalid: boolean;
  constructor(message: string, flags: { expired?: boolean; invalid?: boolean } = {}) {
    super(message);
    this.name = 'CustomerError';
    this.expired = !!flags.expired;
    this.invalid = !!flags.invalid;
  }
}

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  /** Milliseconds since 1970. */
  expiresAt: number;
}

interface Endpoints {
  authorization: string;
  token: string;
  logout: string | null;
  graphql: string;
}

let endpoints: Promise<Endpoints> | null = null;

/** Shopify publishes where to sign in and where the API lives; ask rather than hard-code. */
function discover(): Promise<Endpoints> {
  endpoints ??= (async () => {
    const [openid, api] = await Promise.all([
      fetch(`${config.storeUrl}/.well-known/openid-configuration`).then((r) => r.json()),
      fetch(`${config.storeUrl}/.well-known/customer-account-api`).then((r) => r.json()),
    ]);
    if (!openid?.authorization_endpoint || !openid?.token_endpoint || !api?.graphql_api) {
      throw new CustomerError("Sign-in isn't available right now. Please try again later.");
    }
    return {
      authorization: openid.authorization_endpoint as string,
      token: openid.token_endpoint as string,
      logout: (openid.end_session_endpoint as string | undefined) ?? null,
      graphql: api.graphql_api as string,
    };
  })().catch((error) => {
    endpoints = null;
    throw error instanceof CustomerError ? error : new CustomerError("Can't reach the shop. Check your connection and try again.");
  });
  return endpoints;
}

async function tokenRequest(body: Record<string, string>): Promise<Session> {
  const { token } = await discover();
  const response = await fetch(token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: config.customerClientId, ...body }).toString(),
  });
  const answer = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  } | null;
  if (!response.ok || !answer?.access_token) {
    throw new CustomerError("We couldn't sign you in. Please try again.", { expired: response.status === 400 });
  }
  return {
    accessToken: answer.access_token,
    refreshToken: answer.refresh_token ?? null,
    idToken: answer.id_token ?? null,
    expiresAt: Date.now() + (answer.expires_in ?? 3600) * 1000,
  };
}

/**
 * Opens Shopify's sign-in. Answers the session, or null when the customer
 * closed the sheet.
 */
export async function signIn(emailHint?: string): Promise<Session | null> {
  if (!signInAvailable) throw new CustomerError('Sign-in is not set up for this app yet.');
  const { authorization } = await discover();
  const request = new AuthSession.AuthRequest({
    clientId: config.customerClientId,
    redirectUri,
    scopes: SCOPES,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: emailHint ? { login_hint: emailHint } : {},
  });
  const result = await request.promptAsync({ authorizationEndpoint: authorization });
  if (result.type !== 'success') {
    if (result.type === 'error') throw new CustomerError("We couldn't sign you in. Please try again.");
    return null;
  }
  const code = result.params.code;
  if (!code || !request.codeVerifier) throw new CustomerError("We couldn't sign you in. Please try again.");
  return tokenRequest({
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
    code_verifier: request.codeVerifier,
  });
}

/** A fresh session from the refresh token; throws (expired) when Shopify wants a new sign-in. */
export async function refresh(session: Session): Promise<Session> {
  if (!session.refreshToken) throw new CustomerError('Please sign in again.', { expired: true });
  const next = await tokenRequest({ grant_type: 'refresh_token', refresh_token: session.refreshToken });
  return { ...next, refreshToken: next.refreshToken ?? session.refreshToken, idToken: next.idToken ?? session.idToken };
}

/** Ends Shopify's own session too, so the next sign-in asks who it is. Best effort. */
export async function signOut(session: Session): Promise<void> {
  try {
    const { logout } = await discover();
    if (!logout || !session.idToken) return;
    const url = `${logout}?id_token_hint=${encodeURIComponent(session.idToken)}&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
    await WebBrowser.openAuthSessionAsync(url, redirectUri);
  } catch {
    // The app has forgotten the session either way.
  }
}

// ─── Reading ────────────────────────────────────────────────────────────────

async function customerQuery<T>(session: Session, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { graphql } = await discover();
  let response: Response;
  try {
    response = await fetch(graphql, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: session.accessToken },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new CustomerError("Can't reach the shop. Check your connection and try again.");
  }
  if (response.status === 401 || response.status === 403) throw new CustomerError('Please sign in again.', { expired: true });
  const body = (await response.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (!response.ok || !body) throw new CustomerError(`The shop didn't answer (${response.status}).`);
  if (body.errors?.length) throw new CustomerError(body.errors[0].message, { invalid: !body.data });
  if (!body.data) throw new CustomerError('The shop sent an empty answer.');
  return body.data;
}

export interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailAddress: { emailAddress: string | null } | null;
  phoneNumber: { phoneNumber: string | null } | null;
  defaultAddress: { formatted: string[]; city: string | null; zip: string | null } | null;
}

export interface OrderLine {
  id: string;
  title: string;
  /** The product's name; shown when the line has no title of its own. */
  name: string;
  quantity: number;
  variantId: string | null;
  variantTitle: string | null;
  image: Image | null;
  totalPrice: Money | null;
}

export interface Order {
  id: string;
  name: string;
  number: number;
  processedAt: string;
  cancelledAt?: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  statusPageUrl: string;
  totalPrice: Money;
  subtotal?: Money | null;
  totalShipping?: Money | null;
  totalTax?: Money | null;
  shippingAddress?: { formatted: string[] } | null;
  lineItems: { nodes: OrderLine[] };
  /** blis_delivery.tracking_url: "Follow your driver". */
  metafields?: ({ key: string; value: string } | null)[] | null;
}

const MONEY = `amount currencyCode`;

const CUSTOMER = /* GraphQL */ `
  query Customer {
    customer {
      id
      firstName
      lastName
      displayName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
      defaultAddress { formatted city zip }
    }
  }
`;

// Two versions: the full one, and one with only the fields every version
// of the API has had, used if Shopify refuses the first.
const ORDER_LINES = `lineItems(first: 50) { nodes { id title name quantity variantId variantTitle image { url altText width height } totalPrice { ${MONEY} } } }`;
const ORDER_FULL = `
  id name number processedAt cancelledAt financialStatus fulfillmentStatus statusPageUrl
  totalPrice { ${MONEY} } subtotal { ${MONEY} } totalShipping { ${MONEY} } totalTax { ${MONEY} }
  shippingAddress { formatted }
  metafields(identifiers: [{ namespace: "blis_delivery", key: "tracking_url" }]) { key value }
  ${ORDER_LINES}
`;
const ORDER_BASIC = `
  id name number processedAt financialStatus fulfillmentStatus statusPageUrl
  totalPrice { ${MONEY} }
  ${ORDER_LINES}
`;

const ordersQuery = (fields: string) => /* GraphQL */ `
  query Orders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        nodes { ${fields} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const orderQuery = (fields: string) => /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id) { ${fields} }
  }
`;

let basicOnly = false;

async function withFallback<T>(session: Session, build: (fields: string) => string, variables: Record<string, unknown>) {
  if (!basicOnly) {
    try {
      return await customerQuery<T>(session, build(ORDER_FULL), variables);
    } catch (error) {
      if (!(error instanceof CustomerError) || !error.invalid) throw error;
      basicOnly = true;
    }
  }
  return customerQuery<T>(session, build(ORDER_BASIC), variables);
}

export async function getCustomer(session: Session): Promise<Customer> {
  const data = await customerQuery<{ customer: Customer }>(session, CUSTOMER);
  return data.customer;
}

export interface OrdersPage {
  nodes: Order[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export async function getOrders(session: Session, after: string | null = null): Promise<OrdersPage> {
  const data = await withFallback<{ customer: { orders: OrdersPage } }>(session, ordersQuery, { first: 20, after });
  return data.customer.orders;
}

export async function getOrder(session: Session, id: string): Promise<Order | null> {
  const data = await withFallback<{ order: Order | null }>(session, orderQuery, { id });
  return data.order;
}

/** "Being prepared", "Fulfilled"…: an order's state in a word or two. */
export function orderStatus(order: Pick<Order, 'cancelledAt' | 'fulfillmentStatus' | 'financialStatus'>): string {
  if (order.cancelledAt) return 'Cancelled';
  switch (order.fulfillmentStatus) {
    case 'FULFILLED':
      return 'Fulfilled';
    case 'PARTIALLY_FULFILLED':
      return 'Partly fulfilled';
    case 'ON_HOLD':
      return 'On hold';
    case 'SCHEDULED':
      return 'Scheduled';
  }
  if (order.financialStatus === 'REFUNDED') return 'Refunded';
  return 'Being prepared';
}
