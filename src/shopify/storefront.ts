// One function to talk to the Shopify Storefront API.

import { config, storefrontEndpoint } from '@/config';

export class StorefrontError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status = 0, code: string | null = null) {
    super(message);
    this.name = 'StorefrontError';
    this.status = status;
    this.code = code;
  }
}

interface GraphQLError {
  message: string;
  extensions?: { code?: string };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Shopify refused the token (mistyped, or deleted in the admin). The shop
 * can still be read without one, so the app carries on without it rather
 * than going dark; what only the token can read (metafields) is then missing.
 */
let tokenRefused = false;

/**
 * Runs a query or mutation. Throws StorefrontError when the request fails
 * or Shopify answers with errors and no data; a throttled request is tried
 * again (twice, a little later each time).
 */
export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  for (let attempt = 0; ; attempt++) {
    if (config.storefrontToken && !tokenRefused) headers['X-Shopify-Storefront-Access-Token'] = config.storefrontToken;
    else delete headers['X-Shopify-Storefront-Access-Token'];

    let response: Response;
    try {
      response = await fetch(storefrontEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: options.signal,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      throw new StorefrontError("Can't reach the shop. Check your connection and try again.");
    }

    if ((response.status === 401 || response.status === 403) && config.storefrontToken && !tokenRefused) {
      tokenRefused = true;
      console.warn('The Storefront token was refused; carrying on without it. Run "npm run doctor".');
      continue;
    }

    const throttled = response.status === 429 || response.status === 430;
    if ((throttled || response.status >= 500) && attempt < 2) {
      await wait(600 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      throw new StorefrontError(`The shop didn't answer (${response.status}).`, response.status);
    }

    const body = (await response.json().catch(() => null)) as { data?: T; errors?: GraphQLError[] } | null;
    if (!body) throw new StorefrontError("The shop's answer couldn't be read.", response.status);

    const errors = body.errors ?? [];
    if (errors.some((e) => e.extensions?.code === 'THROTTLED') && attempt < 2) {
      await wait(1000 * (attempt + 1));
      continue;
    }
    // A field the token may not read comes back null with ACCESS_DENIED next
    // to the rest of the data: keep the data, the callers handle the null.
    const denied = errors.length > 0 && errors.every((e) => e.extensions?.code === 'ACCESS_DENIED');
    if (errors.length && !(denied && body.data)) {
      throw new StorefrontError(errors[0].message, response.status, errors[0].extensions?.code ?? null);
    }
    if (body.data == null) throw new StorefrontError('The shop sent an empty answer.', response.status);
    return body.data;
  }
}

/** A Shopify CDN image at the width the screen needs (the CDN resizes). */
export function imageUrl(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (!/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) return url;
  const size = Math.min(2048, Math.max(64, Math.round(width)));
  const [base, hash = ''] = url.split('#');
  const cleaned = base.replace(/([?&])width=\d+&?/, '$1').replace(/[?&]$/, '');
  return `${cleaned}${cleaned.includes('?') ? '&' : '?'}width=${size}${hash ? `#${hash}` : ''}`;
}

/** "gid://shopify/Product/123" → "123". */
export const numericId = (gid: string) => gid.split('?')[0].split('/').pop() ?? '';
