const PREFIX = 'penny:pwa:';

const round2 = (value) => Math.round(Number(value) * 100) / 100;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the app still works online.
  }
}

export const cacheGet = (key, fallback = null) => read(`cache:${key}`, fallback);
export const cacheSet = (key, value) => write(`cache:${key}`, value);

export const prefGet = (key, fallback = null) => read(`pref:${key}`, fallback);
export const prefSet = (key, value) => write(`pref:${key}`, value);

export const queueGet = () => read('queue', []);
export const queueSet = (operations) => write('queue', operations);
export const pendingCount = () => queueGet().length;

export function nextTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

// Older builds stored one un-namespaced book. Move it into General so nobody
// loses their weeks when the separate Personal tracker is introduced.
export function migrateLegacyScopeData() {
  if (cacheGet('general:sessions', undefined) !== undefined) return;
  const sessions = cacheGet('sessions', undefined);
  if (sessions === undefined) return;

  cacheSet('general:sessions', sessions);
  for (const session of sessions) {
    const expenses = cacheGet(`expenses:${session.id}`, undefined);
    if (expenses !== undefined) cacheSet(`general:expenses:${session.id}`, expenses);
    const summary = cacheGet(`summary:${session.id}`, undefined);
    if (summary !== undefined) cacheSet(`general:summary:${session.id}`, summary);
  }
}

export function computeSummary(expenses = []) {
  const amounts = expenses.map((expense) => Number(expense.amount) || 0);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);

  const categories = new Map();
  const daily = new Map();
  expenses.forEach((expense, index) => {
    const amount = amounts[index];
    const category = categories.get(expense.category) || { category: expense.category, total: 0, count: 0 };
    category.total += amount;
    category.count += 1;
    categories.set(expense.category, category);

    const day = daily.get(expense.purchased_at) || { date: expense.purchased_at, total: 0, count: 0 };
    day.total += amount;
    day.count += 1;
    daily.set(expense.purchased_at, day);
  });

  let top = null;
  expenses.forEach((expense, index) => {
    if (!top || amounts[index] > Number(top.amount)) {
      top = { item_name: expense.item_name, amount: amounts[index] };
    }
  });

  return {
    total: round2(total),
    item_count: expenses.length,
    average: expenses.length ? round2(total / expenses.length) : 0,
    largest: expenses.length ? round2(Math.max(...amounts)) : 0,
    categories: [...categories.values()]
      .map((entry) => ({ ...entry, total: round2(entry.total) }))
      .sort((a, b) => b.total - a.total),
    daily: [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({ ...entry, total: round2(entry.total) })),
    top_item: top ? { ...top, amount: round2(top.amount) } : null,
  };
}
