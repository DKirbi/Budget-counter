/**
 * Synthetic bills for tests, Storybook and the offline "demo scan". Every shop, address and tax
 * number below is invented; the layouts imitate how real printers lay out a receipt.
 * @module receipts/fixtures
 */
import type { CurrencyCode, Minor } from '../money';
import type { ISODate } from '../dates';
import type { SpendTag } from '../types';
import { ocrFromText } from './ocr';
import type { OcrResult } from './types';

/** A synthetic bill plus what a correct parse must find. */
export interface ReceiptFixture {
  id: string;
  /** Short description for test names. */
  title: string;
  /** What the OCR would return (tabs mark column gaps). */
  text: string;
  expect: {
    merchant: string;
    date: ISODate;
    /** `true` when the printed date can be read two ways without outside help. */
    dateAmbiguous?: boolean;
    time?: string;
    currency: CurrencyCode;
    total: Minor;
    items: number;
    itemsAddUp: boolean;
    tag: SpendTag;
    payment?: 'card' | 'cash';
  };
}

/** Plain OCR result for a fixture. */
export function fixtureOcr(f: ReceiptFixture): OcrResult {
  return ocrFromText(f.text);
}

/** Ten synthetic bills covering different countries, currencies, date styles and layouts. */
export const RECEIPT_FIXTURES: readonly ReceiptFixture[] = [
  {
    id: 'si-supermarket',
    title: 'Slovenian supermarket, dd.mm.yyyy, discount line, two VAT rates',
    text: [
      'SPAR SLOVENIJA d.o.o.',
      'Šmartinska cesta 152',
      '1000 Ljubljana',
      'ID za DDV: SI12345678',
      'Račun št. 000123',
      'Datum: 05.10.2026 18:42',
      'MLEKO 1L\t1,29 A',
      'KRUH ČRNI\t2,10 A',
      '2 x JOGURT 0,5L\t0,89\t1,78 A',
      'PIVO LAŠKO 0,5L\t1,19 B',
      'Popust\t-0,30',
      'SKUPAJ\t6,06 EUR',
      'DDV 9,5%\t0,45',
      'DDV 22%\t0,12',
      'Plačilo: VISA **** 1234',
    ].join('\n'),
    expect: {
      merchant: 'SPAR SLOVENIJA d.o.o.',
      date: '2026-10-05',
      time: '18:42',
      currency: 'EUR',
      total: 606,
      items: 5,
      itemsAddUp: true,
      tag: 'groceries',
      payment: 'card',
    },
  },
  {
    id: 'de-restaurant',
    title: 'German restaurant, quantity × unit price, tip, cash with change',
    text: [
      'Gasthaus Zum Löwen',
      'Hauptstraße 12, 80331 München',
      'Tel. 089 123456',
      'Beleg-Nr. 4711',
      'Tisch 7\tKellner: Anna',
      '12.09.2026\t20:15',
      '2 x Hefeweizen 0,5l\t4,20\t8,40',
      '1 Schnitzel Wiener Art\t16,50',
      '1 Spaghetti Bolognese\t11,90',
      'Zwischensumme\t36,80',
      'MwSt 19%\t5,88',
      'Trinkgeld\t3,20',
      'Summe EUR\t40,00',
      'Bar\t40,00',
      'Rückgeld\t0,00',
    ].join('\n'),
    expect: {
      merchant: 'Gasthaus Zum Löwen',
      date: '2026-09-12',
      time: '20:15',
      currency: 'EUR',
      total: 4000,
      items: 3,
      itemsAddUp: true,
      tag: 'food',
      payment: 'cash',
    },
  },
  {
    id: 'it-cafe',
    title: 'Italian café, slash date (ambiguous), cash with change',
    text: [
      'BAR PASTICCERIA CENTRALE',
      'Via Roma 25 - 50123 Firenze',
      'P.IVA 01234567890',
      'SCONTRINO',
      '12/10/2026 08:31',
      'CAPPUCCINO\t1,50',
      'CORNETTO\t1,20',
      'SPREMUTA ARANCIA\t3,50',
      'TOTALE EURO\t6,20',
      'CONTANTI\t10,00',
      'RESTO\t3,80',
    ].join('\n'),
    expect: {
      merchant: 'Bar Pasticceria Centrale',
      date: '2026-10-12',
      dateAmbiguous: true,
      time: '08:31',
      currency: 'EUR',
      total: 620,
      items: 3,
      itemsAddUp: true,
      tag: 'food',
      payment: 'cash',
    },
  },
  {
    id: 'uk-pub',
    title: 'UK pub, £, month name, service charge, contactless',
    text: [
      'THE ROYAL OAK',
      '12 High Street',
      'Bath BA1 1AA',
      'VAT Reg GB 123 4567 89',
      'Date 05 Oct 2026 19:05',
      '1 x Fish & Chips\t£14.50',
      '2 x Pint of Lager\t£4.80\t£9.60',
      'Sticky Toffee Pudding\t£6.50',
      'Subtotal\t£30.60',
      'Service charge 12.5%\t£3.83',
      'TOTAL\t£34.43',
      'VISA CONTACTLESS',
    ].join('\n'),
    expect: {
      merchant: 'The Royal Oak',
      date: '2026-10-05',
      time: '19:05',
      currency: 'GBP',
      total: 3443,
      items: 3,
      itemsAddUp: true,
      tag: 'food',
      payment: 'card',
    },
  },
  {
    id: 'us-diner',
    title: 'US diner, $, month-first slash date, AM time, sales tax',
    text: [
      "JOE'S DINER",
      '123 Main St',
      'Springfield, IL 62701',
      'Check #2231\tTable 4',
      'Guests: 2',
      '10/05/2026 07:58 AM',
      'Eggs Benedict\t12.95',
      'Pancakes\t9.50',
      'Coffee\t3.00',
      'Subtotal\t25.45',
      'Sales Tax 8.25%\t2.10',
      'Total\t$27.55',
      'Visa ending 4242',
    ].join('\n'),
    expect: {
      merchant: "Joe's Diner",
      date: '2026-10-05',
      dateAmbiguous: true,
      time: '07:58',
      currency: 'USD',
      total: 2755,
      items: 3,
      itemsAddUp: true,
      tag: 'food',
      payment: 'card',
    },
  },
  {
    id: 'es-tapas',
    title: 'Spanish tapas bar, bare quantity, IVA included',
    text: [
      'BAR LA BODEGUITA S.L.',
      'C/ Mayor 5, 28013 Madrid',
      'CIF B12345678',
      'FACTURA SIMPLIFICADA Nº 0045/2026',
      'Fecha: 05/10/2026 21:12',
      'Mesa 3',
      '2 CAÑAS\t1,80\t3,60',
      'PAN CON TOMATE\t3,50',
      'TORTILLA ESPAÑOLA\t8,90',
      'CROQUETAS JAMON\t7,50',
      'TOTAL\t23,50',
      'IVA 10% incluido\t2,14',
      'TARJETA\t23,50',
    ].join('\n'),
    expect: {
      merchant: 'Bar La Bodeguita S.L.',
      date: '2026-10-05',
      dateAmbiguous: true,
      time: '21:12',
      currency: 'EUR',
      total: 2350,
      items: 4,
      itemsAddUp: true,
      tag: 'food',
      payment: 'card',
    },
  },
  {
    id: 'hr-kiosk',
    title: 'Croatian kiosk, cash with "Povrat"',
    text: [
      'STUDENAC d.o.o.',
      'Ulica kneza Branimira 5, Split',
      'OIB: 12345678901',
      'Račun br.: 123-45-6',
      'Datum: 14.10.2026 09:12',
      'KRUH BIJELI\t1,10',
      'VODA 1,5L\t0,89',
      'KAVA\t1,40',
      'UKUPNO:\t3,39 EUR',
      'Gotovina\t5,00',
      'Povrat\t1,61',
    ].join('\n'),
    expect: {
      merchant: 'STUDENAC d.o.o.',
      date: '2026-10-14',
      time: '09:12',
      currency: 'EUR',
      total: 339,
      items: 3,
      itemsAddUp: true,
      tag: 'groceries',
      payment: 'cash',
    },
  },
  {
    id: 'cz-grocery',
    title: 'Czech grocery, Kč, card payment',
    text: [
      'Albert Hypermarket',
      'Praha 5',
      'DIČ: CZ12345678',
      'Datum: 5.10.2026 17:30',
      'CHLEBA\t29,90',
      'MLÉKO 1L\t24,90',
      'Celkem\t54,80 Kč',
      'Platba kartou\t54,80',
    ].join('\n'),
    expect: {
      merchant: 'Albert Hypermarket',
      date: '2026-10-05',
      time: '17:30',
      currency: 'CZK',
      total: 5480,
      items: 2,
      itemsAddUp: true,
      tag: 'groceries',
      payment: 'card',
    },
  },
  {
    id: 'transport-taxi',
    title: 'Taxi ride, no items, fare only',
    text: [
      'TAXI LJUBLJANA',
      'Datum: 06.10.2026 23:10',
      'Vožnja: Letališče - Center',
      'ZA PLAČILO\t38,00 EUR',
      'Gotovina',
    ].join('\n'),
    expect: {
      merchant: 'Taxi Ljubljana',
      date: '2026-10-06',
      time: '23:10',
      currency: 'EUR',
      total: 3800,
      items: 0,
      itemsAddUp: false,
      tag: 'transport',
      payment: 'cash',
    },
  },
  {
    id: 'hotel-stay',
    title: 'Hotel invoice, month-name date with dots',
    text: [
      'Hotel Bellevue Zürich',
      'Rechnung 20261004-17',
      'Datum 4. Okt. 2026',
      '2 Nächte Doppelzimmer\t240,00',
      'Frühstück\t36,00',
      'Gesamtbetrag CHF\t276,00',
      'Zahlung per Karte',
    ].join('\n'),
    expect: {
      merchant: 'Hotel Bellevue Zürich',
      date: '2026-10-04',
      currency: 'CHF',
      total: 27600,
      items: 2,
      itemsAddUp: true,
      tag: 'stay',
      payment: 'card',
    },
  },
];

/**
 * A bill that is printed on a different day than the one it is scanned, for odd-date tests.
 * @param date - Day to print on the bill.
 * @param total - Total, minor units (EUR).
 */
export function simpleBillText(date: ISODate, total: Minor = 1250, shop = 'CAFE CENTRAL'): string {
  const [y, m, d] = date.split('-');
  const amount = (total / 100).toFixed(2).replace('.', ',');
  return [
    shop,
    'Trg republike 1',
    `Datum: ${d}.${m}.${y} 12:30`,
    `Kosilo\t${amount}`,
    `SKUPAJ\t${amount} EUR`,
  ].join('\n');
}
