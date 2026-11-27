import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isLocalOnly } from './api';
import { useCurrency } from './currency';
import CurrencySelect from './components/CurrencySelect';
import ExpenseFormModal from './components/ExpenseFormModal';
import ExpenseList from './components/ExpenseList';
import Icon from './components/Icon';
import SessionModal from './components/SessionModal';
import Sidebar from './components/Sidebar';
import SummaryCards from './components/SummaryCards';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncMessage, setSyncMessage] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currencyCode = useCurrency();
  const selectedIdRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadSessions = useCallback(async () => {
    const data = await api.getSessions();
    setSessions(data);
    setSelectedId((current) =>
      current && data.some((session) => session.id === current) ? current : data[0]?.id ?? null,
    );
    return data;
  }, []);

  const loadWeek = useCallback(async (id) => {
    if (!id) {
      setExpenses([]);
      setSummary(null);
      return;
    }
    const [list, stats] = await Promise.all([api.getExpenses(id), api.getSummary(id)]);
    setExpenses(list);
    setSummary(stats);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (navigator.onLine !== false) await api.flushQueue();
        await loadSessions();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadSessions]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    (async () => {
      try {
        setWeekLoading(true);
        await loadWeek(selectedId);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setWeekLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, loadWeek]);

  useEffect(() => {
    const goOffline = () => {
      setOnline(false);
      setSyncMessage('Offline — your changes are saved here and will sync later.');
    };
    const goOnline = async () => {
      setOnline(true);
      setSyncMessage('Syncing your changes…');
      try {
        const result = await api.flushQueue();
        await loadSessions();
        if (selectedIdRef.current != null) await loadWeek(selectedIdRef.current);
        setSyncMessage(
          result.synced
            ? `Synced ${result.synced} change${result.synced === 1 ? '' : 's'}.`
            : 'Back online.',
        );
      } catch (err) {
        setSyncMessage(err.message);
      }
      window.setTimeout(() => setSyncMessage(''), 4000);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [loadSessions, loadWeek]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sidebarOpen]);

  useEffect(() => {
    const handleInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handleInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleInstall);
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitExpense = (form) =>
    run(async () => {
      if (modal.type === 'edit') {
        await api.updateExpense(modal.expense.id, form);
      } else {
        await api.createExpense({ ...form, session_id: selectedId });
      }
      await loadSessions();
      await loadWeek(selectedId);
      setModal(null);
    });

  const handleCreateSession = (form) =>
    run(async () => {
      const created = await api.createSession(form);
      await loadSessions();
      setSelectedId(created.id);
      setModal(null);
    });

  const handleDeleteSession = (session) => {
    if (!window.confirm(`Delete "${session.name}" and all of its expenses?`)) return;
    run(async () => {
      await api.deleteSession(session.id);
      await loadSessions();
    });
  };

  const handleDeleteExpense = (expense) => {
    if (!window.confirm(`Delete "${expense.item_name}" from this week?`)) return;
    run(async () => {
      await api.deleteExpense(expense.id);
      await loadSessions();
      await loadWeek(selectedId);
    });
  };

  const selected = sessions.find((session) => session.id === selectedId);

  return (
    <div className="app-shell" data-currency={currencyCode}>
      <Sidebar
        sessions={sessions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewSession={() => setModal({ type: 'session' })}
        onDeleteSession={handleDeleteSession}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close weeks panel"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              type="button"
              className="icon-button menu-button"
              aria-label="Open weeks panel"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" size={20} />
            </button>
            <div>
              <div className="eyebrow">Dashboard</div>
              <h2>Hey there, let’s check your spending <span aria-hidden="true">👋</span></h2>
            </div>
          </div>
          <div className="topbar-actions">
            <CurrencySelect />
            {sessions.length > 0 && (
              <div className="week-select-wrap">
                <Icon name="calendar" size={16} />
                <select
                  aria-label="Choose a week"
                  value={selectedId ?? ''}
                  onChange={(event) => setSelectedId(Number(event.target.value))}
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.name}</option>
                  ))}
                </select>
                <Icon name="chevron" size={15} />
              </div>
            )}
            {installPrompt && (
              <button type="button" className="button button-ghost" onClick={installApp}>
                <Icon name="download" size={17} />
                Install app
              </button>
            )}
            <button
              type="button"
              className="button button-primary"
              disabled={!selectedId}
              onClick={() => setModal({ type: 'expense' })}
            >
              <Icon name="plus" size={17} />
              Add expense
            </button>
          </div>
        </header>

        {isLocalOnly && (
          <div className="status-banner status-local" role="status">
            💾 <strong>Local mode</strong> — saved on this device. Add a hosted API later to sync across devices.
          </div>
        )}

        {!online && (
          <div className="status-banner status-offline" role="status">
            <span>📴 <strong>Offline mode</strong> — you can keep logging. Everything syncs when you reconnect.</span>
          </div>
        )}

        {syncMessage && online && (
          <div className="status-banner status-sync" role="status">
            <span>🔄 {syncMessage}</span>
          </div>
        )}

        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state"><span className="coin-spin">🪙</span> Counting coins…</div>
        ) : sessions.length === 0 ? (
          <div className="empty-state big-empty">
            <div className="empty-illustration">🐷</div>
            <h3>Your piggy bank is empty</h3>
            <p>Create a week to start tracking your expenses.</p>
            <button type="button" className="button button-primary" onClick={() => setModal({ type: 'session' })}>
              <Icon name="plus" size={17} /> Create your first week
            </button>
          </div>
        ) : (
          <div className={`dashboard ${weekLoading ? 'is-loading' : ''}`}>
            {selected && <SummaryCards summary={summary} week={selected} />}
            <ExpenseList
              expenses={expenses}
              onEdit={(expense) => setModal({ type: 'edit', expense })}
              onDelete={handleDeleteExpense}
            />
          </div>
        )}
      </main>

      {modal?.type === 'expense' && (
        <ExpenseFormModal
          week={selected}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={handleSubmitExpense}
        />
      )}
      {modal?.type === 'edit' && (
        <ExpenseFormModal
          expense={modal.expense}
          week={selected}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={handleSubmitExpense}
        />
      )}
      {modal?.type === 'session' && (
        <SessionModal busy={busy} onClose={() => setModal(null)} onSubmit={handleCreateSession} />
      )}
    </div>
  );
}
