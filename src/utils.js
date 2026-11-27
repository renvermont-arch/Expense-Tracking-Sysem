import { LOCALE } from './config';
import { getCurrency } from './currency';

export function formatMoney(value) {
  const currency = getCurrency();
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
  }).format(Number(value) || 0);
}

export function currencySymbol() {
  const currency = getCurrency();
  return (
    new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value || currency.symbol
  );
}

export function formatNumber(value) {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(Number(value) || 0);
}

export function formatDate(iso, options = { month: 'short', day: 'numeric' }) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(LOCALE, options);
}

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function mondayOf(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  return monday;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekLabel(date) {
  return `Week of ${formatDate(isoDate(date))}`;
}
