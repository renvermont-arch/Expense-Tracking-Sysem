import { useSyncExternalStore } from 'react';
import { prefGet, prefSet } from './offline';
import { getScope } from './scope';

// Each book keeps its own weekly budgets. Amounts are stored in whatever
// currency was selected when they were set; currency is display-only.
const listeners = new Set();

const stored = prefGet('budgets', {});
let current = {};
if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
  for (const [key, amount] of Object.entries(stored)) {
    const namespaced = /^-?\d+$/.test(key) ? `general:${key}` : key;
    const value = Number(amount);
    if (Number.isFinite(value) && value >= 0 && !(namespaced in current)) {
      current[namespaced] = value;
    }
  }
}

export function getBudgets() {
  return current;
}

export function setBudget(sessionId, amount) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value < 0) return;
  current = { ...current, [`${getScope()}:${sessionId}`]: value };
  prefSet('budgets', current);
  listeners.forEach((listener) => listener());
}

export function clearBudget(sessionId) {
  const key = `${getScope()}:${sessionId}`;
  if (!(key in current)) return;
  const next = { ...current };
  delete next[key];
  current = next;
  prefSet('budgets', current);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return current;
}

export function useBudgets() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
