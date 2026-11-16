// The delivery rules shipped inside the app: the website theme's own defaults
// (Blis repo, config/settings_schema.json > Local delivery), used until the
// rules the Blis Delivery app publishes can be read (see rules.ts). When the
// days, cut-offs or ZIP codes change, change them here too.

import type { Rules } from './types';

export const BUNDLED_RULES: Rules = {
  source: 'bundled',
  timezone: 'America/New_York',
  slots: [
    {
      day: 'wednesday',
      type: 'delivery',
      location: '',
      details: '',
      cutoffDay: 'sunday',
      cutoffHour: 12,
      ownCutoffDay: 'sunday',
      ownCutoffHour: 12,
      areas: [
        'Boca Raton',
        'Delray Beach',
        'Boynton Beach',
        'Lake Worth / Lantana / Greenacres',
        'West Palm Beach'
      ],
      times: [
        '9am – 12pm',
        '12pm – 3pm',
        '3pm – 6pm'
      ]
    },
    {
      day: 'friday',
      type: 'delivery',
      location: '',
      details: '',
      cutoffDay: 'tuesday',
      cutoffHour: 12,
      ownCutoffDay: 'wednesday',
      ownCutoffHour: 12,
      areas: [
        'Boca Raton',
        'Delray Beach',
        'Boynton Beach',
        'Lake Worth / Lantana / Greenacres',
        'West Palm Beach',
        'Wellington'
      ],
      times: [
        '9am – 12pm',
        '12pm – 3pm',
        '3pm – 6pm'
      ]
    },
    {
      day: 'sunday',
      type: 'delivery',
      location: '',
      details: '',
      cutoffDay: 'thursday',
      cutoffHour: 12,
      ownCutoffDay: 'friday',
      ownCutoffHour: 12,
      areas: [
        'Boca Raton',
        'Delray Beach',
        'Boynton Beach',
        'Lake Worth / Lantana / Greenacres',
        'West Palm Beach',
        'Wellington',
        'Royal Palm Beach / Loxahatchee / Westlake / The Acreage'
      ],
      times: [
        '9am – 12pm',
        '12pm – 3pm',
        '3pm – 6pm'
      ]
    },
    {
      day: 'saturday',
      type: 'pickup',
      location: 'Swank Farmers Market',
      details: '10 am – 1 pm · 14311 North Road, Loxahatchee Groves',
      cutoffDay: 'thursday',
      cutoffHour: 12,
      areas: [],
      times: []
    }
  ],
  zips: {
    '33401': 'West Palm Beach',
    '33405': 'West Palm Beach',
    '33407': 'West Palm Beach',
    '33409': 'West Palm Beach',
    '33411': 'Royal Palm Beach / Loxahatchee / Westlake / The Acreage',
    '33414': 'Wellington',
    '33417': 'West Palm Beach',
    '33426': 'Boynton Beach',
    '33428': 'Boca Raton',
    '33431': 'Boca Raton',
    '33432': 'Boca Raton',
    '33433': 'Boca Raton',
    '33434': 'Boca Raton',
    '33435': 'Boynton Beach',
    '33436': 'Boynton Beach',
    '33437': 'Boynton Beach',
    '33444': 'Delray Beach',
    '33445': 'Delray Beach',
    '33446': 'Delray Beach',
    '33449': 'Wellington',
    '33460': 'Lake Worth / Lantana / Greenacres',
    '33461': 'Lake Worth / Lantana / Greenacres',
    '33462': 'Lake Worth / Lantana / Greenacres',
    '33463': 'Lake Worth / Lantana / Greenacres',
    '33467': 'Lake Worth / Lantana / Greenacres',
    '33470': 'Royal Palm Beach / Loxahatchee / Westlake / The Acreage',
    '33472': 'Boynton Beach',
    '33473': 'Boynton Beach',
    '33480': 'West Palm Beach',
    '33483': 'Delray Beach',
    '33484': 'Delray Beach',
    '33486': 'Boca Raton',
    '33487': 'Boca Raton',
    '33496': 'Boca Raton',
    '33498': 'Boca Raton'
  },
  blackouts: [],
  dayTagPrefix: 'delivery-day:',
  ownCutoffMatch: 'Beef'
};
