// Prices as the website writes them: "$12", "$12.50" (two decimals, with a
// trailing ".00" left out).

import type { Money } from '@/shopify/types';

export function formatMoney(money: Money | null | undefined, options: { trailingZeros?: boolean } = {}): string {
  if (!money) return '';
  const amount = Number(money.amount);
  if (!Number.isFinite(amount)) return '';
  let text: string;
  try {
    text = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currencyCode || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    text = `$${amount.toFixed(2)}`;
  }
  return options.trailingZeros ? text : text.replace(/\.00$/, '');
}

export const isMore = (a: Money | null | undefined, b: Money | null | undefined) =>
  !!a && !!b && Number(a.amount) > Number(b.amount);

export const sameAmount = (a: Money, b: Money) => Number(a.amount) === Number(b.amount);

/** "per lb", "per 100 g": the reference of a unit price, when the product has one. */
export function unitLabel(
  measurement: { referenceUnit: string | null; referenceValue: number } | null | undefined,
): string {
  if (!measurement?.referenceUnit) return '';
  const unit = measurement.referenceUnit.toLowerCase();
  return measurement.referenceValue && measurement.referenceValue !== 1
    ? `per ${measurement.referenceValue} ${unit}`
    : `per ${unit}`;
}
