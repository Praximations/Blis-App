// The website's own photos of each part of the shop (Blis repo, assets/),
// shipped in the app so the Shop tab looks like the website without waiting
// for the network.

const bakery = require('@/assets/images/categories/category-bakery.webp');
const oliveOil = require('@/assets/images/categories/category-olive-oil.webp');
const meats = require('@/assets/images/categories/category-meats.webp');
const seafood = require('@/assets/images/categories/category-seafood.webp');
const dairy = require('@/assets/images/categories/category-dairy.jpg');
const eggs = require('@/assets/images/categories/category-eggs.webp');
const honey = require('@/assets/images/categories/category-honey.webp');
const coffeeTea = require('@/assets/images/categories/category-coffee-tea.webp');
const blackGarlic = require('@/assets/images/categories/category-black-garlic.webp');
const preparedFoods = require('@/assets/images/categories/category-prepared-foods.webp');
const catering = require('@/assets/images/categories/category-catering.webp');

const PHOTOS: Record<string, number> = {
  bakery,
  'breads-bakery': bakery,
  'olive-oil-vinegar': oliveOil,
  'olive-oil': oliveOil,
  'meats-seafood': meats,
  meats,
  seafood,
  'dairy-eggs': dairy,
  'milk-butter': dairy,
  eggs,
  pantry: honey,
  honey,
  'coffee-tea': coffeeTea,
  'black-garlic': blackGarlic,
  'prepared-foods': preparedFoods,
  catering,
};

/** The bundled photo of a section, if there is one. */
export const sectionPhoto = (handle: string): number | null => PHOTOS[handle] ?? null;

export const logoHorizontal = require('@/assets/images/logo-horizontal.png') as number;
export const logoStacked = require('@/assets/images/logo-stacked.png') as number;
