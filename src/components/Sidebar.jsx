import { formatDate, formatMoney } from '../utils';
import Icon from './Icon';

export default function Sidebar({ sessions, selectedId, onSelect, onNewSession, onDeleteSession }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">🐷</span>
        <span className="brand-name">penny<span className="brand-dot">.</span></span>
      </div>
      <p className="brand-tagline">little expenses, nicely kept</p>

      <div className="sidebar-label">
        <Icon name="calendar" size={15} />
        Your weeks
        <span className="count-pill">{sessions.length}</span>
      </div>

      <nav className="week-list" aria-label="Weeks">
        {sessions.length === 0 && <p className="sidebar-empty">No weeks yet — make your first one!</p>}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`week-item ${session.id === selectedId ? 'active' : ''}`}
          >
            <button className="week-main" onClick={() => onSelect(session.id)}>
              <span className="week-name">{session.name}</span>
              <span className="week-dates">
                {formatDate(session.week_start)} –{' '}
                {formatDate(session.week_end, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="week-meta">
                <span>{session.expense_count} items</span>
                <strong>{formatMoney(session.total)}</strong>
              </span>
            </button>
            <button
              type="button"
              className="week-delete"
              title="Delete this week"
              aria-label={`Delete ${session.name}`}
              onClick={() => onDeleteSession(session)}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
      </nav>

      <button type="button" className="new-week-button" onClick={onNewSession}>
        <Icon name="plus" size={17} />
        New week
      </button>

      <div className="sidebar-tip">
        <span className="tip-emoji">🌱</span>
        <div>
          <strong>Tip</strong>
          <p>Log your purchases as you go. Your future self will thank you.</p>
        </div>
      </div>

      <div className="sidebar-footer">made with 🧸 for tidy spending</div>
    </aside>
  );
}
