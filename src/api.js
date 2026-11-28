import {
  cacheGet,
  cacheSet,
  computeSummary,
  migrateLegacyScopeData,
  nextTempId,
  pendingCount,
  queueGet,
  queueSet,
} from './offline';
import { getScope } from './scope';

const round2 = (value) => Math.round(Number(value) * 100) / 100;

// General and Personal are separate books. Each cache key and API request is
// namespaced so switching between them never mixes the two sets of weeks.
const scopeKey = (key) => `${getScope()}:${key}`;
const scopeQuery = () => `scope=${encodeURIComponent(getScope())}`;

migrateLegacyScopeData();

// Local dev uses the Vite proxy (/api). Published builds use a hosted API only
// when VITE_API_BASE_URL is set; otherwise they run entirely on-device.
const configuredApi = import.meta.env.VITE_API_BASE_URL;
const API_BASE = (configuredApi || '/api').replace(/\/$/, '');
export const isLocalOnly = !import.meta.env.DEV && !configuredApi;

function isOfflineError(error) {
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    /Cannot reach the server|Failed to fetch|NetworkError|Load failed/i.test(error?.message || '')
  );
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Your changes will sync when you are back online.');
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (!response.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data;
}

function enqueue(operation) {
  if (!isLocalOnly) queueSet([...queueGet(), { ...operation, scope: getScope() }]);
}

// Returns null when there is no backend to talk to, or when we are offline.
async function tryRemote(path, options) {
  if (isLocalOnly) return null;
  try {
    return await request(path, options);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    return null;
  }
}

function saveExpenses(sessionId, expenses) {
  cacheSet(scopeKey(`expenses:${sessionId}`), expenses);
  const sessions = cacheGet(scopeKey('sessions'), []).map((session) =>
    session.id === sessionId
      ? {
          ...session,
          total: round2(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
          expense_count: expenses.length,
        }
      : session,
  );
  cacheSet(scopeKey('sessions'), sessions);
  cacheSet(scopeKey(`summary:${sessionId}`), computeSummary(expenses));
}

function expensesOf(sessionId) {
  return cacheGet(scopeKey(`expenses:${sessionId}`), []);
}

function sessionOfExpense(expenseId) {
  for (const session of cacheGet(scopeKey('sessions'), [])) {
    if (expensesOf(session.id).some((expense) => expense.id === expenseId)) return session.id;
  }
  return null;
}

function expenseAmount(payload) {
  return round2(Number(payload.quantity) * Number(payload.unit_price));
}

/* --------------------------------- reads -------------------------------- */

function emptyValueFor(cacheKey) {
  if (cacheKey === 'sessions' || cacheKey.startsWith('expenses:')) return [];
  if (cacheKey.startsWith('summary:')) return computeSummary([]);
  return null;
}

async function cachedRead(path, cacheKey) {
  const key = scopeKey(cacheKey);
  if (isLocalOnly) {
    const cached = cacheGet(key);
    if (cached !== null) return cached;
    const empty = emptyValueFor(cacheKey);
    if (empty !== null) cacheSet(key, empty);
    return empty;
  }

  try {
    const data = await request(path);
    cacheSet(key, data);
    return data;
  } catch (error) {
    const cached = cacheGet(key);
    if (cached !== null) return cached;
    throw error;
  }
}

/* ------------------------------- sessions ------------------------------- */

async function createSession(input) {
  const payload = { ...input, scope: getScope() };
  const created = await tryRemote('/sessions', { method: 'POST', body: JSON.stringify(payload) });
  if (created) {
    cacheSet(scopeKey('sessions'), [created, ...cacheGet(scopeKey('sessions'), [])]);
    cacheSet(scopeKey(`expenses:${created.id}`), []);
    cacheSet(scopeKey(`summary:${created.id}`), computeSummary([]));
    return created;
  }

  const local = {
    id: nextTempId(),
    ...payload,
    expense_count: 0,
    total: 0,
    created_at: new Date().toISOString(),
    _offline: true,
  };
  cacheSet(scopeKey('sessions'), [local, ...cacheGet(scopeKey('sessions'), [])]);
  cacheSet(scopeKey(`expenses:${local.id}`), []);
  cacheSet(scopeKey(`summary:${local.id}`), computeSummary([]));
  enqueue({ id: local.id, kind: 'session', action: 'create', payload });
  return local;
}

async function updateSession(id, payload) {
  const name = String(payload?.name ?? '').trim().slice(0, 120);
  const note = String(payload?.note ?? '').trim().slice(0, 255);
  if (!name) throw new Error('Please give this week a name.');

  const changes = { name, note };
  const updated = await tryRemote(`/sessions/${id}?${scopeQuery()}`, {
    method: 'PUT',
    body: JSON.stringify({ ...changes, scope: getScope() }),
  });

  cacheSet(
    scopeKey('sessions'),
    cacheGet(scopeKey('sessions'), []).map((session) =>
      session.id === id ? { ...session, ...changes, ...(updated || {}) } : session,
    ),
  );

  if (!updated && !isLocalOnly) {
    enqueue({ id, kind: 'session', action: 'update', payload: changes });
  }
  return { id, ...changes };
}

async function deleteSession(id) {
  const removed = await tryRemote(`/sessions/${id}?${scopeQuery()}`, { method: 'DELETE' });
  if (!removed && !isLocalOnly) {
    cacheSet(
      scopeKey('sessions'),
      cacheGet(scopeKey('sessions'), []).filter((session) => session.id !== id),
    );
    cacheSet(scopeKey(`expenses:${id}`), []);
    cacheSet(scopeKey(`summary:${id}`), computeSummary([]));
    queueSet(
      queueGet().filter(
        (operation) =>
          !(
            (operation.scope || 'general') === getScope() &&
            operation.kind === 'session' &&
            operation.id === id
          ) &&
          !(
            (operation.scope || 'general') === getScope() &&
            operation.kind === 'expense' &&
            operation.payload?.session_id === id
          ),
      ),
    );
    if (id > 0) enqueue({ id, kind: 'session', action: 'delete' });
  } else if (isLocalOnly) {
    cacheSet(
      scopeKey('sessions'),
      cacheGet(scopeKey('sessions'), []).filter((session) => session.id !== id),
    );
    cacheSet(scopeKey(`expenses:${id}`), []);
    cacheSet(scopeKey(`summary:${id}`), computeSummary([]));
  }
  return { ok: true };
}

/* ------------------------------- expenses ------------------------------- */

async function createExpense(input) {
  const payload = { ...input, scope: getScope() };
  const created = await tryRemote('/expenses', { method: 'POST', body: JSON.stringify(payload) });
  if (created) {
    saveExpenses(payload.session_id, [...expensesOf(payload.session_id), created]);
    return created;
  }

  const local = {
    id: nextTempId(),
    ...payload,
    quantity: Number(payload.quantity),
    unit_price: Number(payload.unit_price),
    amount: expenseAmount(payload),
    created_at: new Date().toISOString(),
    _offline: true,
  };
  saveExpenses(payload.session_id, [...expensesOf(payload.session_id), local]);
  enqueue({ id: local.id, kind: 'expense', action: 'create', payload });
  return local;
}

async function updateExpense(id, payload) {
  const sessionId = sessionOfExpense(id);
  const updated = await tryRemote(`/expenses/${id}?${scopeQuery()}`, {
    method: 'PUT',
    body: JSON.stringify({ ...payload, scope: getScope() }),
  });

  if (updated) {
    if (sessionId !== null) {
      saveExpenses(
        sessionId,
        expensesOf(sessionId).map((expense) => (expense.id === id ? updated : expense)),
      );
    }
    return updated;
  }

  if (sessionId !== null) {
    saveExpenses(
      sessionId,
      expensesOf(sessionId).map((expense) =>
        expense.id === id
          ? { ...expense, ...payload, amount: expenseAmount(payload), _offline: true }
          : expense,
      ),
    );
  }
  enqueue({ id, kind: 'expense', action: 'update', payload });
  return { id, ...payload, amount: expenseAmount(payload), _offline: true };
}

async function deleteExpense(id) {
  const removed = await tryRemote(`/expenses/${id}?${scopeQuery()}`, { method: 'DELETE' });
  if (!removed) {
    const sessionId = sessionOfExpense(id);
    if (sessionId !== null) {
      saveExpenses(
        sessionId,
        expensesOf(sessionId).filter((expense) => expense.id !== id),
      );
    }
    if (!isLocalOnly) {
      queueSet(
        queueGet().filter(
          (operation) =>
            !(
              (operation.scope || 'general') === getScope() &&
              operation.kind === 'expense' &&
              operation.action === 'create' &&
              operation.id === id
            ),
        ),
      );
      if (id > 0) enqueue({ id, kind: 'expense', action: 'delete' });
    }
  }
  return { ok: true };
}

/* -------------------------------- syncing ------------------------------- */

let flushing = null;

export function flushQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    if (isLocalOnly) {
      queueSet([]);
      return { synced: 0, pending: 0 };
    }

    const operations = queueGet();
    if (!operations.length) return { synced: 0, pending: 0 };

    const idMap = {};
    const pending = [];
    let synced = 0;

    for (const operation of operations) {
      try {
        const scope = operation.scope || 'general';
        const key = (value) => `${scope}:${value}`;
        const id = idMap[key(operation.id)] ?? operation.id;
        let payload = operation.payload ? { ...operation.payload, scope } : undefined;
        if (payload && payload.session_id != null) {
          payload.session_id = idMap[key(payload.session_id)] ?? payload.session_id;
        }

        const resource = operation.kind === 'session' ? 'sessions' : 'expenses';
        const base = operation.action === 'create' ? `/${resource}` : `/${resource}/${id}`;
        const path = `${base}?scope=${encodeURIComponent(scope)}`;
        const method =
          operation.action === 'create' ? 'POST' : operation.action === 'update' ? 'PUT' : 'DELETE';

        const result = await request(path, {
          method,
          body: payload ? JSON.stringify(payload) : undefined,
        });
        if (operation.action === 'create' && result?.id) idMap[key(operation.id)] = result.id;
        synced += 1;
      } catch (error) {
        if (!isOfflineError(error)) console.warn('Could not sync a saved change:', error.message);
        pending.push(operation);
      }
    }

    queueSet(pending);
    return { synced, pending: pending.length };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export const api = {
  getSessions: () => cachedRead(`/sessions?${scopeQuery()}`, 'sessions'),
  createSession,
  updateSession,
  deleteSession,
  getExpenses: (sessionId) =>
    cachedRead(`/sessions/${sessionId}/expenses?${scopeQuery()}`, `expenses:${sessionId}`),
  getSummary: (sessionId) =>
    cachedRead(`/sessions/${sessionId}/summary?${scopeQuery()}`, `summary:${sessionId}`),
  createExpense,
  updateExpense,
  deleteExpense,
  flushQueue,
  pendingCount,
};
