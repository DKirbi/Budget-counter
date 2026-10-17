/**
 * Putting a bill into one of the app's categories.
 *
 * Precedence, strongest first: **a rule the user taught us** for this merchant → **merchant keywords**
 * (`hotel`, `spar`, `taxi`…) → **the category most line items point to** → `other`. Everything is
 * deterministic and offline; the user can always change the result, and "remember for this shop"
 * turns the correction into a rule.
 * @module receipts/categorize
 */
import type { Minor } from '../money';
import type { SpendTag, SplitPart } from '../types';
import { fold, wordRe } from './locale';
import { itemsSum } from './parse';
import type { ReceiptData, ReceiptItem } from './types';

/** `merchantKey → tag` rules the user taught the app. */
export type MerchantRules = Readonly<Record<string, SpendTag>>;

/** Where a category suggestion came from. */
export type TagSource = 'user-rule' | 'merchant' | 'items' | 'default';

/** Result of {@link categorize}. */
export interface Categorisation {
  tag: SpendTag;
  source: TagSource;
  /** 0–1 — how sure we are. */
  confidence: number;
  /** Per-item suggestion, aligned with `data.items` (`undefined` = no opinion). */
  itemTags: Array<SpendTag | undefined>;
  /** Offered when the bill clearly mixes categories and the lines add up to the total. */
  suggestedSplit?: SplitPart[];
}

interface Vocabulary {
  tag: SpendTag;
  /** Words in a merchant name. */
  merchant: string[];
  /** Words in an item description. */
  item: string[];
}

/** Checked in this order: the first vocabulary that matches wins. */
const VOCABULARY: readonly Vocabulary[] = [
  {
    tag: 'stay',
    merchant: [
      'hotel*',
      'hostel*',
      'motel*',
      'apartma*',
      'apartman*',
      'apartment*',
      'appartamento',
      'airbnb',
      'booking',
      'guesthouse',
      'guest house',
      'pension',
      'pensione',
      'resort',
      'camping',
      'kamp',
      'b&b',
      'bed and breakfast',
      'lodge',
      'inn',
      'zimmer',
      'soba',
      'sobe',
      'penzion',
      'prenocisca',
    ],
    item: [
      'nacht',
      'naechte',
      'nachte',
      'night*',
      'noc',
      'noci',
      'notte',
      'notti',
      'noche*',
      'nocitev',
      'nocenje',
      'room',
      'doppelzimmer',
      'einzelzimmer',
      'city tax',
      'tourist tax',
      'kurtaxe',
      'turisticka taksa',
      'turisticka pristojbina',
      'overnight',
      'accommodation',
    ],
  },
  {
    tag: 'transport',
    merchant: [
      'taxi*',
      'uber',
      'bolt',
      'cabify',
      'lyft',
      'freenow',
      'bus',
      'autobus*',
      'avtobus*',
      'train',
      'zeleznice',
      'bahn',
      'db',
      'sncf',
      'trenitalia',
      'italo',
      'renfe',
      'oebb',
      'sbb',
      'flixbus',
      'eurolines',
      'tram',
      'parking*',
      'parkiranje',
      'parkhaus',
      'garaza',
      'garage',
      'petrol',
      'shell',
      'omv',
      'bp',
      'mol',
      'agip',
      'eni',
      'esso',
      'tankstelle',
      'gas station',
      'fuel',
      'dars',
      'maut',
      'vignette',
      'autocesta',
      'hac',
      'hertz',
      'avis',
      'sixt',
      'europcar',
      'rent a car',
      'ferry',
      'jadrolinija',
      'ryanair',
      'easyjet',
      'wizz',
      'airlines',
      'airways',
      'lufthansa',
      'transavia',
      'bike rental',
      'scooter',
    ],
    item: [
      'taxi',
      'fahrt',
      'voznja',
      'vozovnica',
      'karta za',
      'fare',
      'toll',
      'maut',
      'vignette',
      'parking',
      'parkiranje',
      'benzin',
      'diesel',
      'gorivo',
      'fuel',
      'unleaded',
      'bus ticket',
      'train ticket',
      'single ticket',
      'day pass',
      'tageskarte',
      'transfer',
    ],
  },
  {
    tag: 'activities',
    merchant: [
      'muzej*',
      'museum*',
      'museo',
      'musee',
      'galerija',
      'gallery',
      'theatre',
      'theater',
      'teatr*',
      'gledalisce',
      'kino',
      'cinema',
      'cine',
      'concert',
      'koncert*',
      'festival*',
      'tour*',
      'ekskurzija',
      'excursion',
      'aquarium',
      'akvarij',
      'zoo',
      'zoo vrt',
      'castle',
      'schloss',
      'burg',
      'terme',
      'therme',
      'thermal',
      'wellness',
      'spa',
      'skipass',
      'ski lift',
      'vzpenjaca',
      'rafting',
      'kayak',
      'cruise',
      'escape room',
      'bowling',
      'adventure',
      'national park',
      'narodni park',
    ],
    item: [
      'vstopnica',
      'ulaznica',
      'eintritt',
      'entrada',
      'entrance',
      'admission',
      'ticket adult',
      'adult ticket',
      'child ticket',
      'tickets',
      'skipass',
      'guided tour',
      'audio guide',
      'excursion',
    ],
  },
  {
    tag: 'groceries',
    merchant: [
      'spar',
      'interspar',
      'lidl',
      'aldi',
      'hofer',
      'mercator',
      'tus',
      'billa',
      'penny',
      'rewe',
      'edeka',
      'kaufland',
      'carrefour',
      'intermarche',
      'auchan',
      'leclerc',
      'monoprix',
      'mercadona',
      'dia',
      'eroski',
      'tesco',
      'sainsbury*',
      'asda',
      'morrisons',
      'waitrose',
      'coop',
      'migros',
      'denner',
      'konzum',
      'studenac',
      'plodine',
      'eurospin',
      'conad',
      'esselunga',
      'albert',
      'biedronka',
      'zabka',
      'lewiatan',
      'supermarket*',
      'supermarkt',
      'supermercado',
      'supermercato',
      'hypermarket*',
      'grocery',
      'groceries',
      'trgovina',
      'samoposluga',
      'minimarket',
      'ica',
      'netto',
      'fakta',
      'rimi',
      'maxima',
      'jumbo',
      'delhaize',
      'colruyt',
      'lekkerland',
    ],
    item: [],
  },
  {
    tag: 'food',
    merchant: [
      'restaurant*',
      'restavracija',
      'restoran*',
      'ristorante',
      'trattoria',
      'osteria',
      'pizzeria',
      'pizza',
      'kebab',
      'burger*',
      'mcdonald*',
      'kfc',
      'subway',
      'starbucks',
      'cafe',
      'kavarna',
      'kafic',
      'caffe',
      'coffee',
      'bar',
      'pub',
      'bistro',
      'gasthaus',
      'gasthof',
      'gaststatte',
      'brasserie',
      'tavern',
      'taverna',
      'bodega',
      'tapas',
      'cerveceria',
      'sushi',
      'ramen',
      'grill',
      'bakery',
      'backerei',
      'pekarna',
      'pekara',
      'panaderia',
      'patisserie',
      'pasticceria',
      'gelateria',
      'gelato',
      'ice cream',
      'sladoled*',
      'brewery',
      'pivnica',
      'konoba',
      'kneipe',
      'imbiss',
      'snack',
      'diner',
      'eatery',
      'canteen',
      'menza',
      'gostilna',
      'okrepcevalnica',
      'buffet',
      'food',
    ],
    item: [
      'pizza',
      'burger',
      'beer',
      'pivo',
      'bier',
      'wine',
      'vino',
      'wein',
      'coffee',
      'kava',
      'kaffee',
      'cappuccino',
      'espresso',
      'latte',
      'schnitzel',
      'pasta',
      'spaghetti',
      'salad',
      'solata',
      'soup',
      'juha',
      'steak',
      'fish',
      'riba',
      'lunch',
      'kosilo',
      'dinner',
      'vecerja',
      'breakfast',
      'fruhstuck',
      'zajtrk',
      'dessert',
      'cocktail',
      'cola',
      'fanta',
      'sprite',
      'water',
      'voda',
      'wasser',
      'tea',
      'cornetto',
      'croissant',
      'sandwich',
      'fries',
      'chips',
      'kebab',
      'tapas',
      'pint',
      'lager',
      'hefeweizen',
      'spremuta',
      'menu',
      'meni',
    ],
  },
  {
    tag: 'shopping',
    merchant: [
      'zara',
      'h&m',
      'hm',
      'mango',
      'primark',
      'uniqlo',
      'ikea',
      'decathlon',
      'mediamarkt',
      'saturn',
      'apple store',
      'zalando',
      'shop',
      'boutique',
      'souvenir*',
      'suvenir*',
      'gift',
      'mall',
      'outlet',
      'nike',
      'adidas',
      'intersport',
      'sportina',
      'c&a',
      'tk maxx',
      'dm',
      'rossmann',
      'muller',
      'douglas',
      'sephora',
      'tedi',
      'pepco',
      'kik',
      'action',
      'bershka',
      'pull&bear',
      'stradivarius',
      'reserved',
    ],
    item: [
      'souvenir',
      'suvenir',
      'postcard',
      'razglednica',
      'tshirt',
      't-shirt',
      'magnet',
      'magnet',
    ],
  },
];

const MATCHERS = VOCABULARY.map((v) => ({
  tag: v.tag,
  merchant: wordRe(v.merchant),
  item: v.item.length > 0 ? wordRe(v.item) : null,
}));

/** Words that end a merchant name; stripped from the key so "Spar d.o.o." and "SPAR" are one shop. */
const LEGAL_SEQUENCES: ReadonlyArray<readonly string[]> = [
  ['j', 'd', 'o', 'o'],
  ['sp', 'z', 'o', 'o'],
  ['d', 'o', 'o'],
  ['d', 'd'],
  ['d', 'n', 'o'],
  ['s', 'p'],
  ['s', 'r', 'l'],
  ['s', 'p', 'a'],
  ['s', 'r', 'o'],
  ['s', 'l'],
  ['s', 'a'],
  ['a', 's'],
  ['b', 'v'],
  ['n', 'v'],
  ['doo'],
  ['gmbh'],
  ['srl'],
  ['spa'],
  ['ltd'],
  ['limited'],
  ['llc'],
  ['inc'],
  ['plc'],
  ['ag'],
  ['kg'],
  ['sa'],
  ['sl'],
  ['kft'],
  ['zrt'],
  ['ab'],
  ['aps'],
  ['oy'],
  ['bv'],
  ['nv'],
  ['sro'],
];

/**
 * Stable identity of a shop, used to match rules and detect duplicates.
 * Lower-case, accents and punctuation removed, legal form (`d.o.o.`, `GmbH`) and branch numbers dropped.
 * @param name - Merchant name as printed.
 * @returns A key like `spar slovenija`, or `''` when there is no usable name.
 */
export function merchantKey(name: string | undefined): string {
  if (!name) return '';
  let tokens = fold(name)
    .split(/[^a-z0-9&]+/)
    .filter(Boolean);
  let stripped = true;
  while (stripped && tokens.length > 1) {
    stripped = false;
    for (const seq of LEGAL_SEQUENCES) {
      const tail = tokens.slice(-seq.length);
      if (tokens.length > seq.length && tail.every((t, i) => t === seq[i])) {
        tokens = tokens.slice(0, -seq.length);
        stripped = true;
        break;
      }
    }
  }
  return tokens.filter((t) => !/^\d+$/.test(t)).join(' ');
}

function tagOfMerchant(name: string | undefined): SpendTag | undefined {
  if (!name) return undefined;
  const f = fold(name);
  return MATCHERS.find((m) => m.merchant.test(f))?.tag;
}

function tagOfItem(item: ReceiptItem): SpendTag | undefined {
  const f = fold(item.description);
  return MATCHERS.find((m) => m.item?.test(f))?.tag;
}

/**
 * Suggest splitting a bill by line-item category.
 *
 * Only offered when the lines add up to the total exactly, at least two categories are involved, each
 * non-main category is at least 15 % of the bill, and the main part stays positive after discounts.
 * @param data - Parsed receipt.
 * @param main - The bill's overall category (receives untagged lines).
 * @param itemTags - Per-item suggestions.
 */
export function suggestSplit(
  data: Pick<ReceiptData, 'items' | 'total'>,
  main: SpendTag,
  itemTags: ReadonlyArray<SpendTag | undefined>,
): SplitPart[] | undefined {
  const { total } = data;
  if (total === undefined || data.items.length < 2 || itemsSum(data.items) !== total)
    return undefined;
  const byTag = new Map<SpendTag, Minor>();
  data.items.forEach((item, i) => {
    const tag = itemTags[i] ?? main;
    byTag.set(tag, (byTag.get(tag) ?? 0) + item.amount);
  });
  if (byTag.size < 2 || (byTag.get(main) ?? 0) <= 0) return undefined;
  for (const [tag, amount] of byTag) {
    if (tag !== main && (amount <= 0 || amount / total < 0.15)) return undefined;
  }
  return [...byTag.entries()]
    .sort(([a, x], [b, y]) => (a === main ? -1 : b === main ? 1 : y - x))
    .map(([tag, amount]) => ({ tag, amount }));
}

/**
 * Categorise a parsed bill.
 * @param data - Parsed receipt.
 * @param rules - Rules the user taught the app, by {@link merchantKey}.
 * @returns The category, why it was chosen, per-item hints and (when sensible) a split suggestion.
 * @example
 * categorize({ ...data, merchant: 'Hotel Bellevue' }).tag // 'stay'
 */
export function categorize(data: ReceiptData, rules: MerchantRules = {}): Categorisation {
  const itemTags = data.items.map(tagOfItem);

  const ruled = rules[merchantKey(data.merchant)];
  const fromMerchant = tagOfMerchant(data.merchant);

  let tag: SpendTag;
  let source: TagSource;
  let confidence: number;
  if (ruled) {
    [tag, source, confidence] = [ruled, 'user-rule', 0.95];
  } else if (fromMerchant) {
    [tag, source, confidence] = [fromMerchant, 'merchant', 0.8];
  } else {
    const weight = new Map<SpendTag, Minor>();
    data.items.forEach((item, i) => {
      const t = itemTags[i];
      if (t) weight.set(t, (weight.get(t) ?? 0) + Math.max(item.amount, 0));
    });
    const top = [...weight.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) [tag, source, confidence] = [top[0], 'items', 0.6];
    else [tag, source, confidence] = ['other', 'default', 0.2];
  }

  const suggestedSplit = suggestSplit(data, tag, itemTags);
  return { tag, source, confidence, itemTags, ...(suggestedSplit ? { suggestedSplit } : {}) };
}
