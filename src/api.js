import {
  cacheGet,
  cacheSet,
  computeSummary,
  nextTempId,
  pendingCount,
  queueGet,
  queueSet,
} from './offline';

const round2 = (value) => Math.round(Number(value) * 100) / 100;

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
  if (!isLocalOnly) queueSet([...queueGet(), operation]);
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
  cacheSet(`expenses:${sessionId}`, expenses);
  const sessions = cacheGet('sessions', []).map((session) =>
    session.id === sessionId
      ? {
          ...session,
          total: round2(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
          expense_count: expenses.length,
        }
      : session,
  );
  cacheSet('sessions', sessions);
  cacheSet(`summary:${sessionId}`, computeSummary(expenses));
}

function expensesOf(sessionId) {
  return cacheGet(`expenses:${sessionId}`, []);
}

function sessionOfExpense(expenseId) {
  for (const session of cacheGet('sessions', [])) {
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
  if (isLocalOnly) {
    const cached = cacheGet(cacheKey);
    if (cached !== null) return cached;
    const empty = emptyValueFor(cacheKey);
    if (empty !== null) cacheSet(cacheKey, empty);
    return empty;
  }

  try {
    const data = await request(path);
    cacheSet(cacheKey, data);
    return data;
  } catch (error) {
    const cached = cacheGet(cacheKey);
    if (cached !== null) return cached;
    throw error;
  }
}

/* ------------------------------- sessions ------------------------------- */

async function createSession(payload) {
  const created = await tryRemote('/sessions', { method: 'POST', body: JSON.stringify(payload) });
  if (created) {
    cacheSet('sessions', [created, ...cacheGet('sessions', [])]);
    cacheSet(`expenses:${created.id}`, []);
    cacheSet(`summary:${created.id}`, computeSummary([]));
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
  cacheSet('sessions', [local, ...cacheGet('sessions', [])]);
  cacheSet(`expenses:${local.id}`, []);
  cacheSet(`summary:${local.id}`, computeSummary([]));
  enqueue({ id: local.id, kind: 'session', action: 'create', payload });
  return local;
}

async function deleteSession(id) {
  const removed = await tryRemote(`/sessions/${id}`, { method: 'DELETE' });
  if (!removed && !isLocalOnly) {
    cacheSet(
      'sessions',
      cacheGet('sessions', []).filter((session) => session.id !== id),
    );
    cacheSet(`expenses:${id}`, []);
    cacheSet(`summary:${id}`, computeSummary([]));
    queueSet(
      queueGet().filter(
        (operation) =>
          !(operation.kind === 'session' && operation.id === id) &&
          !(operation.kind === 'expense' && operation.payload?.session_id === id),
      ),
    );
    if (id > 0) enqueue({ id, kind: 'session', action: 'delete' });
  } else if (isLocalOnly) {
    cacheSet(
      'sessions',
      cacheGet('sessions', []).filter((session) => session.id !== id),
    );
    cacheSet(`expenses:${id}`, []);
    cacheSet(`summary:${id}`, computeSummary([]));
  }
  return { ok: true };
}

/* ------------------------------- expenses ------------------------------- */

async function createExpense(payload) {
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
  const updated = await tryRemote(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
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
  const removed = await tryRemote(`/expenses/${id}`, { method: 'DELETE' });
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
            !(operation.kind === 'expense' && operation.action === 'create' && operation.id === id),
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
        const id = idMap[operation.id] ?? operation.id;
        let payload = operation.payload ? { ...operation.payload } : undefined;
        if (payload && payload.session_id != null) {
          payload.session_id = idMap[payload.session_id] ?? payload.session_id;
        }

        const resource = operation.kind === 'session' ? 'sessions' : 'expenses';
        const path = operation.action === 'create' ? `/${resource}` : `/${resource}/${id}`;
        const method =
          operation.action === 'create' ? 'POST' : operation.action === 'update' ? 'PUT' : 'DELETE';

        const result = await request(path, {
          method,
          body: payload ? JSON.stringify(payload) : undefined,
        });
        if (operation.action === 'create' && result?.id) idMap[operation.id] = result.id;
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
  getSessions: () => cachedRead('/sessions', 'sessions'),
  createSession,
  deleteSession,
  getExpenses: (sessionId) => cachedRead(`/sessions/${sessionId}/expenses`, `expenses:${sessionId}`),
  getSummary: (sessionId) => cachedRead(`/sessions/${sessionId}/summary`, `summary:${sessionId}`),
  createExpense,
  updateExpense,
  deleteExpense,
  flushQueue,
  pendingCount,
};
