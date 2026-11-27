import { useState } from 'react';
import { clearBudget, setBudget, useBudgets } from '../budget';
import { getScope } from '../scope';
import { formatMoney } from '../utils';
import Icon from './Icon';
import Modal from './Modal';

export default function BudgetCard({ week, spent }) {
  const budgets = useBudgets();
  const budget = Number(budgets[`${getScope()}:${week.id}`]) || 0;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const remaining = Math.round((budget - spent) * 100) / 100;
  const over = budget > 0 && remaining < 0;
  const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const fill = Math.min(100, Math.max(0, percent));

  const openEditor = () => {
    setValue(budget > 0 ? String(budget) : '');
    setEditing(true);
  };

  const save = (event) => {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    setBudget(week.id, amount);
    setEditing(false);
  };

  return (
    <section className={`budget-card ${over ? 'is-over' : ''}`}>
      <div className="budget-head">
        <div className="budget-title"><Icon name="target" size={16} /> Weekly budget</div>
        <button type="button" className="budget-edit" onClick={openEditor}>
          {budget > 0 ? 'Edit' : 'Set budget'}
        </button>
      </div>

      {budget > 0 ? (
        <>
          <div className="budget-amounts">
            <div>
              <span>{over ? 'Over budget by' : 'Left to spend'}</span>
              <strong>{formatMoney(Math.abs(remaining))}</strong>
            </div>
            <span className="budget-of">of {formatMoney(budget)}</span>
          </div>
          <div
            className="budget-track"
            role="progressbar"
            aria-label="Weekly budget used"
            aria-valuemin={0}
            aria-valuemax={budget}
            aria-valuenow={Math.min(spent, budget)}
          >
            <div
              className={`budget-fill ${over ? 'is-over' : percent >= 80 ? 'is-warn' : ''}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="budget-foot">
            <span>{formatMoney(spent)} spent</span>
            <span>{percent}% used</span>
          </div>
        </>
      ) : (
        <p className="budget-empty">
          Set a limit for this week and we’ll keep track as you log expenses. ✨
        </p>
      )}

      {editing && (
        <Modal
          title="Set weekly budget"
          subtitle={`For ${week.name}`}
          onClose={() => setEditing(false)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="field field-full">
                <span>Budget amount</span>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                  placeholder="e.g. 500"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
            </div>
            <p className="form-hint">
              Saved on this device. Your remaining budget updates whenever you add an expense.
            </p>
            <div className="modal-actions">
              {budget > 0 && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    clearBudget(week.id);
                    setEditing(false);
                  }}
                >
                  Remove
                </button>
              )}
              <button type="button" className="button button-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary">
                Save budget
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
