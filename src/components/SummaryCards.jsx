import { CATEGORY_EMOJI } from '../config';
import { formatDate, formatMoney } from '../utils';
import BudgetCard from './BudgetCard';
import Icon from './Icon';

function SparkBars({ daily }) {
  if (!daily.length) {
    return <div className="spark-empty">c ˘ c ˘ c</div>;
  }
  const max = Math.max(...daily.map((day) => Number(day.total)));
  return (
    <div className="spark-bars" aria-hidden="true">
      {daily.map((day) => (
        <div
          key={day.date}
          className="spark-bar"
          style={{ height: `${18 + (Number(day.total) / max) * 62}%` }}
          title={`${formatDate(day.date)} · ${formatMoney(day.total)}`}
        />
      ))}
    </div>
  );
}

export default function SummaryCards({ summary, week }) {
  const total = summary?.total || 0;
  const categories = summary?.categories || [];

  return (
    <>
      <section className="hero-card">
        <span className="hero-deco" aria-hidden="true">💸</span>
        <div className="hero-copy">
          <div className="hero-label">
            <Icon name="wallet" size={16} /> Total spent this week
          </div>
          <h1>{formatMoney(total)}</h1>
          <p>
            {week.name} · {formatDate(week.week_start)} –{' '}
            {formatDate(week.week_end, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {week.note && <p className="week-note">📝 {week.note}</p>}
        </div>
        <div className="hero-chart">
          <SparkBars daily={summary?.daily || []} />
          <span className="spark-caption">{summary?.daily?.length || 0} spending days</span>
        </div>
      </section>

      <BudgetCard week={week} spent={total} />

      <section className="stat-grid">
        <div className="stat-card stat-pink">
          <div className="stat-icon"><Icon name="receipt" size={19} /></div>
          <span className="stat-label">Items logged</span>
          <strong className="stat-value">{summary?.item_count || 0}</strong>
          <span className="stat-hint">little things add up</span>
        </div>
        <div className="stat-card stat-mint">
          <div className="stat-icon"><Icon name="tag" size={19} /></div>
          <span className="stat-label">Average per item</span>
          <strong className="stat-value">{formatMoney(summary?.average)}</strong>
          <span className="stat-hint">across this week</span>
        </div>
        <div className="stat-card stat-lilac">
          <div className="stat-icon"><Icon name="coin" size={19} /></div>
          <span className="stat-label">Biggest purchase</span>
          <strong className="stat-value stat-value-text">
            {summary?.top_item?.item_name || '—'}
          </strong>
          <span className="stat-hint">
            {summary?.top_item ? formatMoney(summary.top_item.amount) : 'nothing logged yet'}
          </span>
        </div>
      </section>

      <section className="panel category-panel">
        <div className="panel-head">
          <div>
            <h2>Where it went</h2>
            <p>A breakdown by category</p>
          </div>
          <span className="panel-badge"><Icon name="sparkles" size={15} /> {categories.length}</span>
        </div>
        {categories.length === 0 ? (
          <div className="panel-empty">Add an expense to see your categories here 🧾</div>
        ) : (
          <div className="category-list">
            {categories.map((category) => (
              <div className="category-row" key={category.category}>
                <span className="category-emoji">{CATEGORY_EMOJI[category.category] || '✨'}</span>
                <div className="category-info">
                  <div className="category-top">
                    <span>{category.category}</span>
                    <span className="category-amount">{formatMoney(category.total)}</span>
                  </div>
                  <div className="category-track">
                    <div
                      className="category-fill"
                      style={{ width: `${Math.max(4, (Number(category.total) / (total || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="category-count">{category.count} item{category.count === 1 ? '' : 's'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
