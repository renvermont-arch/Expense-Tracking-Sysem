import { useSyncExternalStore } from 'react';
import { prefGet, prefSet } from './offline';

// General and Personal are two separate books. Each keeps its own weeks,
// expenses and budgets, while currency remains a shared display preference.
export const SCOPES = [
  { id: 'general', label: 'General', emoji: '🧾' },
  { id: 'personal', label: 'Personal', emoji: '💗' },
];

const listeners = new Set();

function resolve(id) {
  return SCOPES.find((scope) => scope.id === id)?.id || 'general';
}

let current = resolve(prefGet('scope', 'general'));

export function getScope() {
  return current;
}

export function setScope(id) {
  const next = resolve(id);
  if (next === current) return;
  current = next;
  prefSet('scope', next);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return current;
}

export function useScope() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
