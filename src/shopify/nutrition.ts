// A product's Nutrition label: the store's "Nutrition label" entry
// (Content > Metaobjects, type blis_nutrition), linked from the product's
// custom.nutrition_label metafield. Read the way the website's product page
// reads it (Blis repo, snippets/product-quality.liquid): a line left empty
// is left out, and nothing is invented.

export interface NutritionRow {
  name: string;
  /** "8 g"; '' when only the % Daily Value is given. */
  amount: string;
  /** "10%"; '' when there is none. */
  dailyValue: string;
  /** 0 = a main line, 1 = part of the line above, 2 = part of that. */
  indent: 0 | 1 | 2;
}

export interface Nutrition {
  /** There is enough for a Nutrition Facts panel. */
  hasPanel: boolean;
  servingsPerContainer: string;
  servingSize: string;
  calories: string;
  rows: NutritionRow[];
  /** Vitamins and minerals, under the heavy rule. */
  vitamins: NutritionRow[];
  footnote: string;
  ingredients: string;
  allergens: string[];
}

export type NutritionFields = { key: string; value: string | null }[];

const MAIN_ROWS: [key: string, name: string, indent: 0 | 1 | 2][] = [
  ['total_fat', 'Total Fat', 0],
  ['saturated_fat', 'Saturated Fat', 1],
  ['trans_fat', 'Trans Fat', 1],
  ['polyunsaturated_fat', 'Polyunsaturated Fat', 1],
  ['monounsaturated_fat', 'Monounsaturated Fat', 1],
  ['cholesterol', 'Cholesterol', 0],
  ['sodium', 'Sodium', 0],
  ['total_carbohydrate', 'Total Carbohydrate', 0],
  ['dietary_fiber', 'Dietary Fiber', 1],
  ['total_sugars', 'Total Sugars', 1],
  ['added_sugars', 'Added Sugars', 2],
  ['protein', 'Protein', 0],
];

const VITAMIN_ROWS: [key: string, name: string][] = [
  ['vitamin_d', 'Vitamin D'],
  ['calcium', 'Calcium'],
  ['iron', 'Iron'],
  ['potassium', 'Potassium'],
];

export const DEFAULT_FOOTNOTE =
  'The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.';

/** Allergens are a list: JSON from Shopify, or an older comma-separated line. */
function list(value: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Not JSON: a plain line.
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** The label, or null when the entry says nothing worth showing. */
export function parseNutrition(fields: NutritionFields | null | undefined): Nutrition | null {
  if (!fields?.length) return null;
  const values = new Map(fields.map((field) => [field.key, (field.value ?? '').trim()]));
  const get = (key: string) => values.get(key) ?? '';

  const rows: NutritionRow[] = [];
  for (const [key, name, indent] of MAIN_ROWS) {
    const amount = get(key);
    const dv = get(`${key}_dv`);
    if (!amount && !dv) continue;
    rows.push(
      key === 'added_sugars'
        ? { name: `Includes ${amount} Added Sugars`.replace(/\s+/g, ' '), amount: '', dailyValue: dv ? `${dv}%` : '', indent }
        : { name, amount, dailyValue: dv ? `${dv}%` : '', indent },
    );
  }

  const vitamins: NutritionRow[] = [];
  for (const [key, name] of VITAMIN_ROWS) {
    const amount = get(key);
    const dv = get(`${key}_dv`);
    if (amount || dv) vitamins.push({ name, amount, dailyValue: dv ? `${dv}%` : '', indent: 0 });
  }
  // Other vitamins and minerals, one per line; a last word with "%" is its Daily Value.
  for (const raw of get('other_nutrients').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const words = line.split(/\s+/);
    const last = words[words.length - 1];
    if (words.length > 1 && last.includes('%')) {
      vitamins.push({ name: words.slice(0, -1).join(' '), amount: '', dailyValue: last, indent: 0 });
    } else {
      vitamins.push({ name: line, amount: '', dailyValue: '', indent: 0 });
    }
  }

  const hasPanel = ['serving_size', 'calories', 'total_fat', 'sodium', 'total_carbohydrate', 'protein'].some((key) => get(key) !== '');
  const ingredients = get('ingredients');
  const allergens = list(get('allergens'));
  if (!hasPanel && !ingredients && !allergens.length) return null;

  return {
    hasPanel,
    servingsPerContainer: get('servings_per_container'),
    servingSize: get('serving_size'),
    calories: get('calories'),
    rows,
    vitamins,
    footnote: get('footnote') || DEFAULT_FOOTNOTE,
    ingredients,
    allergens,
  };
}
