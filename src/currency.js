import { useSyncExternalStore } from 'react';
import { DEFAULT_CURRENCY } from './config';
import { prefGet, prefSet } from './offline';

// `locale` controls the symbol and grouping style; the currency's own default
// fraction digits are used (0 for dong/won/yen/rupiah, 2 for most others).
export const CURRENCIES = [
  { code: 'USD', label: 'US dollar', locale: 'en-US', symbol: '$' },
  { code: 'PHP', label: 'Philippine peso', locale: 'en-PH', symbol: '₱' },
  { code: 'VND', label: 'Vietnamese dong', locale: 'vi-VN', symbol: '₫' },
  { code: 'KRW', label: 'South Korean won', locale: 'ko-KR', symbol: '₩' },
  { code: 'JPY', label: 'Japanese yen', locale: 'ja-JP', symbol: '¥' },
  { code: 'MYR', label: 'Malaysian ringgit', locale: 'ms-MY', symbol: 'RM' },
  { code: 'IDR', label: 'Indonesian rupiah', locale: 'id-ID', symbol: 'Rp' },
  { code: 'SGD', label: 'Singapore dollar', locale: 'en-SG', symbol: 'S$' },
  { code: 'THB', label: 'Thai baht', locale: 'th-TH', symbol: '฿' },
  { code: 'INR', label: 'Indian rupee', locale: 'en-IN', symbol: '₹' },
  { code: 'CNY', label: 'Chinese yuan', locale: 'zh-CN', symbol: '¥' },
  { code: 'EUR', label: 'Euro', locale: 'de-DE', symbol: '€' },
  { code: 'GBP', label: 'British pound', locale: 'en-GB', symbol: '£' },
  { code: 'AUD', label: 'Australian dollar', locale: 'en-AU', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian dollar', locale: 'en-CA', symbol: 'C$' },
  { code: 'BRL', label: 'Brazilian real', locale: 'pt-BR', symbol: 'R$' },
  { code: 'HKD', label: 'Hong Kong dollar', locale: 'zh-HK', symbol: 'HK$' },
  { code: 'TWD', label: 'New Taiwan dollar', locale: 'zh-TW', symbol: 'NT$' },
  { code: 'MXN', label: 'Mexican peso', locale: 'es-MX', symbol: 'MX$' },
  { code: 'NZD', label: 'New Zealand dollar', locale: 'en-NZ', symbol: 'NZ$' },
];

const listeners = new Set();

function resolve(code) {
  return CURRENCIES.find((currency) => currency.code === code) || CURRENCIES[0];
}

let current = resolve(prefGet('currency', DEFAULT_CURRENCY));

export function getCurrency() {
  return current;
}

export function setCurrency(code) {
  const next = resolve(code);
  if (next.code === current.code) return;
  current = next;
  prefSet('currency', next.code);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return current.code;
}

export function useCurrency() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
