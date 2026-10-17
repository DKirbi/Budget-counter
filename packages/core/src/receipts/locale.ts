/**
 * Multilingual vocabulary for reading bills: keywords, month names and currency markers.
 *
 * Everything is matched on **folded** text (lower-case, accents stripped) so `Račun`, `RACUN` and
 * `racun` are one word. Lists are deliberately European-heavy — the first users travel there — and
 * extending one is a one-line change.
 * @module receipts/locale
 */
import type { CurrencyCode } from '../money';

/**
 * Lower-case and strip accents so keyword matching is case- and diacritic-insensitive.
 * Length is preserved for precomposed characters, so match offsets still index the original string.
 * @param s - Text as printed.
 */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 's')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'a')
    .replace(/ı/g, 'i');
}

/** Escape a literal for use inside a RegExp. */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a whole-word, case-insensitive regex from folded keywords. Keywords ending in `*` are prefixes.
 * @param words - Folded keywords / phrases.
 */
export function wordRe(words: readonly string[]): RegExp {
  const alts = words.map((w) => {
    const f = fold(w);
    return f.endsWith('*') ? `${escapeRe(f.slice(0, -1))}\\w*` : escapeRe(f);
  });
  return new RegExp(`(?:^|[^a-z0-9])(?:${alts.join('|')})(?![a-z0-9])`, 'i');
}

/** Words that introduce the amount to pay. */
export const TOTAL_WORDS = [
  'total',
  'totale',
  'totaal',
  'totalt',
  'summe',
  'gesamt*',
  'zu zahlen',
  'amount due',
  'balance due',
  'grand total',
  'to pay',
  'skupaj',
  'za placilo',
  'za plaćilo',
  'ukupno',
  'za platiti',
  'iznos',
  'da pagare',
  'importe',
  'a pagar',
  'te betalen',
  'a payer',
  'montant',
  'celkem',
  'k uhrade',
  'razem',
  'do zaplaty',
  'osszesen',
  'fizetendo',
  'att betala',
  'i alt',
  'at betale',
  'sum',
];

/** Words that introduce a sub-total. */
export const SUBTOTAL_WORDS = [
  'subtotal',
  'sub total',
  'zwischensumme',
  'delna vsota',
  'medjuzbroj',
  'subtotale',
  'sous total',
  'subtotaal',
  'delsumma',
  'mellemsum',
  'netto',
  'net',
];

/** Words on tax rows. */
export const TAX_WORDS = [
  'tax',
  'vat',
  'mwst',
  'ust',
  'mwst.',
  'ddv',
  'pdv',
  'iva',
  'tva',
  'btw',
  'dph',
  'mva',
  'moms',
  'davek',
  'porez',
  'imposta',
  'gst',
];

/** Rows that look like totals but are not what was paid. */
export const NOT_A_TOTAL_WORDS = [
  'savings',
  'saved',
  'usteda',
  'popust*',
  'discount',
  'rabatt',
  'ersparnis',
  'sconto',
  'descuento',
  'remise',
  'korting',
  'points',
  'bodovi',
  'tocke',
  'punkte',
  'bonus',
  'tendered',
  'received',
  'prejeto',
  'primljeno',
  'gegeben',
  'cash',
  'bar',
  'gotovina',
  'efectivo',
  'contanti',
  'especes',
  'contant',
  'gotowka',
  'kontant',
  'change',
  'rueckgeld',
  'ruckgeld',
  'wechselgeld',
  'resto',
  'kusur',
  'vracilo',
  'povrat',
  'cambio',
  'monnaie',
  'rendu',
  'wisselgeld',
  'reszta',
  'visszajaro',
  'vaxel',
  'tilbage',
];

/** Cash tendered / change rows — never items, never totals. */
export const CASH_FLOW_WORDS = [
  'change',
  'rueckgeld',
  'ruckgeld',
  'wechselgeld',
  'resto',
  'kusur',
  'vracilo',
  'povrat',
  'cambio',
  'monnaie',
  'rendu',
  'wisselgeld',
  'reszta',
  'visszajaro',
  'vaxel',
  'tilbage',
  'tendered',
  'gegeben',
  'given',
  'prejeto',
  'primljeno',
  'received',
  'paid',
  'placano',
  'zahlung',
];

/** Card payments. */
export const CARD_WORDS = [
  'visa',
  'mastercard',
  'maestro',
  'amex',
  'card*',
  'kart*',
  'carte*',
  'carta',
  'tarjeta',
  'contactless',
  'debit',
  'credit',
  'apple pay',
  'google pay',
  'ec',
  'girocard',
  'bancontact',
  'revolut',
];

/** Card brands / schemes only — safe to use on item rows (a shop can sell "Kartoffeln"). */
export const CARD_BRAND_WORDS = [
  'visa',
  'mastercard',
  'maestro',
  'amex',
  'contactless',
  'debit',
  'girocard',
  'bancontact',
  'apple pay',
  'google pay',
];

/** Cash payments. */
export const CASH_WORDS = [
  'cash',
  'bar',
  'barzahlung',
  'gotovina',
  'gotovini',
  'efectivo',
  'contanti',
  'especes',
  'contant',
  'gotowka',
  'kontant',
  'készpénz',
];

/** Tips. */
export const TIP_WORDS = [
  'tip',
  'gratuity',
  'trinkgeld',
  'napitnina',
  'mancia',
  'propina',
  'pourboire',
  'fooi',
  'drickspengar',
  'drikkepenge',
];

/**
 * Header / footer boilerplate. Used only to skip rows when looking for the merchant name, never to
 * reject item rows (a tapas bar sells "Pan con tomate"). Deliberately avoids words that are also
 * restaurant names ("Bon Appétit", "Table 8").
 */
export const NOISE_WORDS = [
  'tel',
  'phone',
  'fax',
  'www',
  'http',
  'https',
  'email',
  'e-mail',
  'iban',
  'swift',
  'thank*',
  'hvala',
  'danke',
  'merci',
  'gracias',
  'grazie',
  'dankjewel',
  'dziekujemy',
  'dekujeme',
  'koszonjuk',
  'tack',
  'welcome',
  'dobrodosli',
  'willkommen',
  'receipt',
  'racun',
  'rechnung',
  'beleg',
  'kassenbon',
  'quittung',
  'scontrino',
  'fattura',
  'factura',
  'recibo',
  'uctenka',
  'paragon',
  'faktura',
  'kvitto',
  'kvittering',
  'invoice',
  'tax invoice',
  'vat id',
  'oib',
  'uid',
  'nip',
  'ico',
  'dic',
  'cashier',
  'kasir*',
  'blagajnik',
  'kassierer',
  'terminal',
  'auth*',
  'approval',
  'transaction',
  'copy',
  'kopija',
];

/** Words that say "a date on this row is the purchase date". */
export const DATE_HINT_WORDS = [
  'datum',
  'date',
  'data',
  'fecha',
  'dne',
  'dnia',
  'time',
  'zeit',
  'uhr',
  'ura',
  'cas',
  'hora',
  'heure',
  'ora',
  'tarih',
];

/** Words that say "a date on this row is NOT the purchase date". */
export const DATE_EXCLUDE_WORDS = [
  'valid',
  'until',
  'expires',
  'expiry',
  'exp',
  'gultig',
  'ablauf',
  'verfall*',
  'mhd',
  'best before',
  'use by',
  'rok',
  'veljavno',
  'vrijedi',
  'valable',
  'caducidad',
  'scadenza',
  'due',
  'fallig',
  'birth',
  'geboren',
];

/** Words that say "the next thing on the row is the receipt number". */
export const RECEIPT_NUMBER_WORDS = [
  'racun',
  'receipt',
  'rechnung',
  'beleg',
  'bon',
  'invoice',
  'fattura',
  'factura',
  'recibo',
  'uctenka',
  'paragon',
  'ticket',
  'scontrino',
  'check',
  'faktura',
];

/** Address-ish words; a row containing one is not a merchant name. */
export const ADDRESS_WORDS = [
  'ulica',
  'ul.',
  'cesta',
  'cesta.',
  'trg',
  'street',
  'st.',
  'road',
  'rd.',
  'avenue',
  'ave',
  'str.',
  'strasse',
  'platz',
  'weg',
  'gasse',
  'via',
  'viale',
  'piazza',
  'rue',
  'calle',
  'avenida',
  'plaza',
  'straat',
  'ulice',
  'namesti',
  'ulica.',
  'utca',
  'gata',
  'vej',
  'obala',
  'bulevar',
  'boulevard',
];

/**
 * Month names and abbreviations (folded) by month number: en, de, fr, es, it, pt, nl, sl, hr, cs, pl, hu.
 * `listopad(a|u)` is left out on purpose — it means October in Croatian but November in Czech and Polish.
 * Names only count when glued to a day number and a year, so short forms like `set` are safe.
 */
export const MONTHS: Readonly<Record<number, readonly string[]>> = {
  1: [
    'january',
    'jan',
    'januar',
    'janvier',
    'janv',
    'enero',
    'ene',
    'gennaio',
    'gen',
    'janeiro',
    'januari',
    'sijecnja',
    'ledna',
    'stycznia',
    'januar',
  ],
  2: [
    'february',
    'feb',
    'februar',
    'fevrier',
    'fevr',
    'fev',
    'febrero',
    'febbraio',
    'fevereiro',
    'februari',
    'veljace',
    'unora',
    'lutego',
  ],
  3: [
    'march',
    'mar',
    'marz',
    'maerz',
    'mars',
    'marzo',
    'marco',
    'maart',
    'marec',
    'ozujka',
    'brezna',
    'marca',
    'marcius',
  ],
  4: [
    'april',
    'apr',
    'avril',
    'avr',
    'abril',
    'abr',
    'aprile',
    'travnja',
    'dubna',
    'kwietnia',
    'aprilis',
  ],
  5: [
    'may',
    'mai',
    'mayo',
    'maggio',
    'mag',
    'maio',
    'mei',
    'maj',
    'svibnja',
    'kvetna',
    'maja',
    'majus',
  ],
  6: [
    'june',
    'jun',
    'juni',
    'junij',
    'juin',
    'junio',
    'giugno',
    'giu',
    'junho',
    'lipnja',
    'cervna',
    'czerwca',
    'junius',
  ],
  7: [
    'july',
    'jul',
    'juli',
    'julij',
    'juillet',
    'juil',
    'julio',
    'luglio',
    'lug',
    'julho',
    'srpnja',
    'cervence',
    'lipca',
    'julius',
  ],
  8: [
    'august',
    'aug',
    'avgust',
    'aout',
    'agosto',
    'ago',
    'augustus',
    'kolovoza',
    'srpna',
    'sierpnia',
    'augusztus',
  ],
  9: [
    'september',
    'sep',
    'sept',
    'septembre',
    'septiembre',
    'settembre',
    'set',
    'setembro',
    'rujna',
    'zari',
    'wrzesnia',
    'szeptember',
  ],
  10: [
    'october',
    'oct',
    'oktober',
    'okt',
    'octobre',
    'octubre',
    'ottobre',
    'ott',
    'outubro',
    'out',
    'rijna',
    'pazdziernika',
    'oktober',
  ],
  11: ['november', 'nov', 'novembre', 'noviembre', 'novembro', 'studenoga', 'studenog'],
  12: [
    'december',
    'dec',
    'dezember',
    'dez',
    'decembre',
    'diciembre',
    'dicembre',
    'dic',
    'dezembro',
    'des',
    'prosinca',
    'prosince',
    'grudnia',
  ],
};

/** Currency markers found on bills → ISO code. Symbols are matched as-is, words on folded text. */
export const CURRENCY_SYMBOLS: ReadonlyArray<readonly [RegExp, CurrencyCode]> = [
  [/€/g, 'EUR'],
  [/\beuros?\b/gi, 'EUR'],
  [/£/g, 'GBP'],
  [/\bCHF\b|\bSFr\.?/gi, 'CHF'],
  [/(?:^|[^A-Za-z])(?:Kč|Kc)(?![A-Za-z])/g, 'CZK'],
  [/(?:^|[^A-Za-z])(?:zł|zl)(?![A-Za-z])/gi, 'PLN'],
  [/(?:^|[^A-Za-z])Ft(?![A-Za-z])/g, 'HUF'],
  [/\bC\$|\bCA\$|\bCAD\b/g, 'CAD'],
  [/\bA\$|\bAU\$|\bAUD\b/g, 'AUD'],
  [/\$/g, 'USD'],
  [/¥|\bJPY\b|円/g, 'JPY'],
  [/\bEUR\b/gi, 'EUR'],
  [/\bUSD\b/gi, 'USD'],
  [/\bGBP\b/gi, 'GBP'],
  [/\bCZK\b/gi, 'CZK'],
  [/\bPLN\b/gi, 'PLN'],
  [/\bHUF\b/gi, 'HUF'],
  [/\bSEK\b/gi, 'SEK'],
  [/\bNOK\b/gi, 'NOK'],
  [/\bDKK\b/gi, 'DKK'],
];
