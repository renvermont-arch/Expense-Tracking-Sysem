import { useBudgets } from '../budget';
import { getScope } from '../scope';
import { formatDate, formatMoney, hasWeekEnded } from '../utils';
import Icon from './Icon';

export default function WeekWrapUp({ week, spent }) {
  const budgets = useBudgets();

  if (!week || !hasWeekEnded(week)) return null;

  const budget = Number(budgets[`${getScope()}:${week.id}`]) || 0;
  const saved = Math.round((budget - Number(spent || 0)) * 100) / 100;
  const wentOver = budget > 0 && saved < 0;

  return (
    <section className={`week-wrapup ${wentOver ? 'is-over' : ''}`} aria-label="Week wrap-up">
      <div className="wrapup-head">
        <span className="wrapup-icon"><Icon name={wentOver ? 'target' : 'coin'} size={20} /></span>
        <div>
          <h2>{wentOver ? 'Week wrap-up' : 'Nice work — week complete'}</h2>
          <p>
            {week.name} · ended{' '}
            {formatDate(week.week_end, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {budget > 0 ? (
        <>
          <div className="wrapup-amount-block">
            <span>{wentOver ? 'Over budget by' : 'Money saved'}</span>
            <strong>{formatMoney(Math.abs(saved))}</strong>
          </div>
          <p className="wrapup-note">
            {wentOver
              ? `You spent ${formatMoney(spent)} of your ${formatMoney(budget)} budget.`
              : `You kept ${formatMoney(saved)} of your ${formatMoney(budget)} budget.`}
          </p>
        </>
      ) : (
        <p className="wrapup-empty">No budget was set for this week — add one to see what you saved.</p>
      )}
    </section>
  );
}
