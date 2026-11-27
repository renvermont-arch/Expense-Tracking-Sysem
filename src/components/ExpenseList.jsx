import { useMemo } from 'react';
import { CATEGORY_EMOJI } from '../config';
import { formatDate, formatMoney, formatNumber } from '../utils';
import Icon from './Icon';

export default function ExpenseList({ expenses, onEdit, onDelete }) {
  const groups = useMemo(() => {
    const byDate = new Map();
    expenses.forEach((expense) => {
      if (!byDate.has(expense.purchased_at)) byDate.set(expense.purchased_at, []);
      byDate.get(expense.purchased_at).push(expense);
    });
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  return (
    <section className="panel expense-panel">
      <div className="panel-head">
        <div>
          <h2>Purchases</h2>
          <p>Everything you logged this week</p>
        </div>
        <span className="panel-badge">{expenses.length} total</span>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">🧺</div>
          <h3>Nothing logged yet</h3>
          <p>Add your first purchase and it will show up right here.</p>
        </div>
      ) : (
        <div className="expense-groups">
          {groups.map(([date, items]) => (
            <div className="expense-group" key={date}>
              <div className="date-divider">
                <span>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>

              {items.map((expense) => (
                <div className="expense-row" key={expense.id}>
                  <div className="expense-emoji">
                    {CATEGORY_EMOJI[expense.category] || '✨'}
                  </div>

                  <div className="expense-details">
                    <div className="expense-title-line">
                      <strong>{expense.item_name}</strong>
                      <span className="category-chip">{expense.category}</span>
                    </div>
                    <span className="expense-sub">
                      {formatNumber(expense.quantity)} {expense.unit} × {formatMoney(expense.unit_price)}
                      {expense.note ? ` · ${expense.note}` : ''}
                    </span>
                  </div>

                  <div className="expense-amount">{formatMoney(expense.amount)}</div>

                  <div className="row-actions">
                    <button type="button" className="icon-button" title="Edit" onClick={() => onEdit(expense)}>
                      <Icon name="pencil" size={16} />
                    </button>
                    <button type="button" className="icon-button danger" title="Delete" onClick={() => onDelete(expense)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
