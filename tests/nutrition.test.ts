// Labels as the store has them (Content > Metaobjects > Nutrition label).

import { DEFAULT_FOOTNOTE, parseNutrition, type NutritionFields } from '@/shopify/nutrition';

const fields = (values: Record<string, string | null>): NutritionFields => Object.entries(values).map(([key, value]) => ({ key, value }));

// Marulo Organic Pasta: a complete panel.
const pasta = fields({
  name: 'Marulo Organic Pasta',
  serving_size: '2 oz (56g)',
  servings_per_container: '9',
  calories: '200',
  total_fat: '0g',
  total_fat_dv: '0',
  saturated_fat: '0.1g',
  saturated_fat_dv: '1',
  trans_fat: '0g',
  polyunsaturated_fat: null,
  monounsaturated_fat: null,
  cholesterol: '0mg',
  cholesterol_dv: '0',
  sodium: '0mg',
  sodium_dv: '0',
  total_carbohydrate: '42g',
  total_carbohydrate_dv: '15',
  dietary_fiber: '2g',
  dietary_fiber_dv: '7',
  total_sugars: '1g',
  added_sugars: '0g',
  added_sugars_dv: '0',
  protein: '7g',
  protein_dv: '14',
  vitamin_d: '0mcg',
  vitamin_d_dv: '0',
  calcium: '0mg',
  calcium_dv: '0',
  iron: '0mg',
  iron_dv: '0',
  potassium: '47mg',
  potassium_dv: '0',
  other_nutrients: null,
  ingredients: 'Organic durum wheat semolina, water. May contain traces of soy and mustard.',
  allergens: '["Wheat (gluten)"]',
  footnote: null,
});

describe('parseNutrition', () => {
  it('reads a complete label in the order of the pack', () => {
    const label = parseNutrition(pasta)!;
    expect(label.hasPanel).toBe(true);
    expect(label).toMatchObject({ servingSize: '2 oz (56g)', servingsPerContainer: '9', calories: '200', footnote: DEFAULT_FOOTNOTE });
    expect(label.rows.map((row) => [row.name, row.amount, row.dailyValue, row.indent])).toEqual([
      ['Total Fat', '0g', '0%', 0],
      ['Saturated Fat', '0.1g', '1%', 1],
      ['Trans Fat', '0g', '', 1],
      ['Cholesterol', '0mg', '0%', 0],
      ['Sodium', '0mg', '0%', 0],
      ['Total Carbohydrate', '42g', '15%', 0],
      ['Dietary Fiber', '2g', '7%', 1],
      ['Total Sugars', '1g', '', 1],
      ['Includes 0g Added Sugars', '', '0%', 2],
      ['Protein', '7g', '14%', 0],
    ]);
    expect(label.vitamins.map((row) => `${row.name} ${row.amount} ${row.dailyValue}`)).toEqual([
      'Vitamin D 0mcg 0%',
      'Calcium 0mg 0%',
      'Iron 0mg 0%',
      'Potassium 47mg 0%',
    ]);
    expect(label.ingredients).toMatch(/^Organic durum wheat semolina/);
    expect(label.allergens).toEqual(['Wheat (gluten)']);
  });

  it('leaves out the lines the label leaves empty', () => {
    // Heritage Blue Eggs: no fibre, sugars or vitamins on the label.
    const label = parseNutrition(
      fields({ serving_size: '1 egg (50g)', calories: '70', total_fat: '5g', total_fat_dv: '6', cholesterol: '185mg', cholesterol_dv: '62', protein: '6g', protein_dv: '12', dietary_fiber: null, vitamin_d: null }),
    )!;
    expect(label.rows.map((row) => row.name)).toEqual(['Total Fat', 'Cholesterol', 'Protein']);
    expect(label.vitamins).toEqual([]);
    expect(label.ingredients).toBe('');
    expect(label.allergens).toEqual([]);
  });

  it('shows a % Daily Value given without an amount, and extra vitamins one per line', () => {
    const label = parseNutrition(
      fields({ calories: '50', vitamin_d: null, vitamin_d_dv: '0', iron: null, iron_dv: '2', other_nutrients: 'Vitamin B12 0.5mcg 20%\nZinc 1mg\n\n' }),
    )!;
    expect(label.vitamins).toEqual([
      { name: 'Vitamin D', amount: '', dailyValue: '0%', indent: 0 },
      { name: 'Iron', amount: '', dailyValue: '2%', indent: 0 },
      { name: 'Vitamin B12 0.5mcg', amount: '', dailyValue: '20%', indent: 0 },
      { name: 'Zinc 1mg', amount: '', dailyValue: '', indent: 0 },
    ]);
  });

  it("keeps the label's own footnote", () => {
    const label = parseNutrition(fields({ calories: '45', added_sugars: '8g', added_sugars_dv: '14', footnote: 'Added sugars come only from grape must.' }))!;
    expect(label.footnote).toBe('Added sugars come only from grape must.');
    expect(label.rows).toEqual([{ name: 'Includes 8g Added Sugars', amount: '', dailyValue: '14%', indent: 2 }]);
  });

  it('gives ingredients and allergens without a panel when that is all there is', () => {
    // Raw Chocolate Milk.
    const label = parseNutrition(
      fields({ name: 'Raw Chocolate Milk', serving_size: null, calories: null, ingredients: 'Raw milk, chocolate syrup (cocoa), cocoa powder, water, maple syrup, vanilla, salt.', allergens: '["Milk"]' }),
    )!;
    expect(label.hasPanel).toBe(false);
    expect(label.rows).toEqual([]);
    expect(label.ingredients).toMatch(/^Raw milk/);
    expect(label.allergens).toEqual(['Milk']);
  });

  it('reads allergens written as one line', () => {
    expect(parseNutrition(fields({ allergens: 'Milk, Eggs , ' }))?.allergens).toEqual(['Milk', 'Eggs']);
  });

  it('is nothing when the entry says nothing', () => {
    expect(parseNutrition(fields({ name: 'Empty', calories: null, ingredients: '  ', allergens: '[]' }))).toBeNull();
    expect(parseNutrition([])).toBeNull();
    expect(parseNutrition(null)).toBeNull();
  });
});
