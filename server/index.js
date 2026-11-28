import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { getPool, initDb } from './db.js';

const app = express();

// For a hosted API, set ALLOWED_ORIGINS to your GitHub Pages URL(s).
// Local development keeps the permissive default for the Vite proxy.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json());

const isDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value));

const isPositiveNumber = (value) => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0;
const isNonNegativeNumber = (value) => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0;
const clean = (value, max = 255) => String(value ?? '').trim().slice(0, max);
const round2 = (value) => Math.round(value * 100) / 100;

const normalizeScope = (value) => (value === 'personal' ? 'personal' : 'general');

async function sessionExists(id, scope) {
  const params = [id];
  let sql = 'SELECT id FROM sessions WHERE id = ?';
  if (scope) {
    sql += ' AND scope = ?';
    params.push(normalizeScope(scope));
  }
  const [rows] = await getPool().query(sql, params);
  return rows.length > 0;
}

async function expenseInScope(id, scope) {
  const [rows] = await getPool().query(
    `SELECT e.id FROM expenses e
      JOIN sessions s ON s.id = e.session_id
      WHERE e.id = ? AND s.scope = ?`,
    [id, normalizeScope(scope)],
  );
  return rows.length > 0;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ------------------------------- sessions ------------------------------- */

app.get('/api/sessions', async (req, res) => {
  const scope = normalizeScope(req.query.scope);
  const [rows] = await getPool().query(
    `SELECT s.id, s.name, s.scope, s.week_start, s.week_end, s.note, s.created_at,
            COUNT(e.id) AS expense_count,
            COALESCE(SUM(e.amount), 0) AS total
     FROM sessions s
     LEFT JOIN expenses e ON e.session_id = s.id
     WHERE s.scope = ?
     GROUP BY s.id
     ORDER BY s.week_start DESC, s.id DESC`,
    [scope],
  );
  res.json(rows);
});

app.post('/api/sessions', async (req, res) => {
  const name = clean(req.body.name, 120);
  const { week_start, week_end } = req.body;
  const note = clean(req.body.note, 255);
  const scope = normalizeScope(req.body.scope);

  if (!name) return res.status(400).json({ error: 'Please give this week a name.' });
  if (!isDate(week_start) || !isDate(week_end)) {
    return res.status(400).json({ error: 'Please choose valid start and end dates.' });
  }
  if (week_end < week_start) {
    return res.status(400).json({ error: 'The end date must be on or after the start date.' });
  }

  const [result] = await getPool().query(
    'INSERT INTO sessions (name, scope, week_start, week_end, note) VALUES (?, ?, ?, ?, ?)',
    [name, scope, week_start, week_end, note],
  );
  res.status(201).json({ id: result.insertId, name, scope, week_start, week_end, note });
});

app.put('/api/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid week.' });
  if (!(await sessionExists(id, req.query.scope))) {
    return res.status(404).json({ error: 'Week not found.' });
  }

  const fields = [];
  const values = [];
  if (req.body.name !== undefined) {
    const name = clean(req.body.name, 120);
    if (!name) return res.status(400).json({ error: 'Please give this week a name.' });
    fields.push('name = ?');
    values.push(name);
  }
  if (req.body.note !== undefined) {
    fields.push('note = ?');
    values.push(clean(req.body.note, 255));
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(id);
  const [result] = await getPool().query(
    `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Week not found.' });

  const [rows] = await getPool().query(
    'SELECT id, name, scope, week_start, week_end, note FROM sessions WHERE id = ?',
    [id],
  );
  res.json(rows[0]);
});

app.delete('/api/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid week.' });
  if (!(await sessionExists(id, req.query.scope))) {
    return res.status(404).json({ error: 'Week not found.' });
  }
  const [result] = await getPool().query('DELETE FROM sessions WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Week not found.' });
  res.json({ ok: true });
});

/* ------------------------------- expenses ------------------------------- */

app.get('/api/sessions/:id/expenses', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid week.' });
  if (!(await sessionExists(id, req.query.scope))) {
    return res.status(404).json({ error: 'Week not found.' });
  }
  const [rows] = await getPool().query(
    'SELECT * FROM expenses WHERE session_id = ? ORDER BY purchased_at DESC, id DESC',
    [id],
  );
  res.json(rows);
});

app.get('/api/sessions/:id/summary', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid week.' });
  if (!(await sessionExists(id, req.query.scope))) {
    return res.status(404).json({ error: 'Week not found.' });
  }

  const [totals] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total,
            COUNT(*) AS item_count,
            COALESCE(AVG(amount), 0) AS average,
            COALESCE(MAX(amount), 0) AS largest
     FROM expenses WHERE session_id = ?`,
    [id],
  );
  const [categories] = await getPool().query(
    `SELECT category, SUM(amount) AS total, COUNT(*) AS count
     FROM expenses WHERE session_id = ? GROUP BY category ORDER BY total DESC`,
    [id],
  );
  const [daily] = await getPool().query(
    `SELECT purchased_at AS date, SUM(amount) AS total, COUNT(*) AS count
     FROM expenses WHERE session_id = ? GROUP BY purchased_at ORDER BY purchased_at ASC`,
    [id],
  );
  const [top] = await getPool().query(
    'SELECT item_name, amount FROM expenses WHERE session_id = ? ORDER BY amount DESC LIMIT 1',
    [id],
  );

  res.json({
    ...totals[0],
    categories,
    daily,
    top_item: top[0] || null,
  });
});

function validateExpense(body) {
  const item_name = clean(body.item_name, 150);
  const category = clean(body.category, 60) || 'Other';
  const unit = clean(body.unit, 30) || 'pcs';
  const note = clean(body.note, 255);
  const { quantity, unit_price, purchased_at } = body;

  const errors = [];
  if (!item_name) errors.push('Please enter what you bought.');
  if (!isPositiveNumber(quantity)) errors.push('Quantity must be greater than zero.');
  if (!isNonNegativeNumber(unit_price)) errors.push('Price cannot be negative.');
  if (!isDate(purchased_at)) errors.push('Please choose a valid purchase date.');

  return {
    errors,
    values: {
      item_name,
      category,
      unit,
      note,
      quantity: Number(quantity),
      unit_price: Number(unit_price),
      amount: round2(Number(quantity) * Number(unit_price)),
      purchased_at,
    },
  };
}

app.post('/api/expenses', async (req, res) => {
  const session_id = Number(req.body.session_id);
  if (!Number.isInteger(session_id) || !(await sessionExists(session_id, req.body.scope))) {
    return res.status(400).json({ error: 'Please choose a valid week first.' });
  }

  const { errors, values } = validateExpense(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0] });

  const [result] = await getPool().query(
    `INSERT INTO expenses
      (session_id, item_name, category, quantity, unit, unit_price, amount, purchased_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session_id, values.item_name, values.category, values.quantity, values.unit,
      values.unit_price, values.amount, values.purchased_at, values.note],
  );
  res.status(201).json({ id: result.insertId, session_id, ...values });
});

app.put('/api/expenses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid expense.' });
  if (req.query.scope && !(await expenseInScope(id, req.query.scope))) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  const { errors, values } = validateExpense(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0] });

  const [result] = await getPool().query(
    `UPDATE expenses SET item_name = ?, category = ?, quantity = ?, unit = ?,
       unit_price = ?, amount = ?, purchased_at = ?, note = ? WHERE id = ?`,
    [values.item_name, values.category, values.quantity, values.unit, values.unit_price,
      values.amount, values.purchased_at, values.note, id],
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Expense not found.' });
  res.json({ id, ...values });
});

app.delete('/api/expenses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid expense.' });
  if (req.query.scope && !(await expenseInScope(id, req.query.scope))) {
    return res.status(404).json({ error: 'Expense not found.' });
  }
  const [result] = await getPool().query('DELETE FROM expenses WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Expense not found.' });
  res.json({ ok: true });
});

/* Serve the built React app if it exists (npm run build && npm start). */
const dist = path.resolve(import.meta.dirname, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(dist, 'index.html'));
    }
    next();
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const port = Number(process.env.PORT || 3001);
initDb()
  .then(() => {
    app.listen(port, () => console.log(`API ready at http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Could not connect to XAMPP MySQL:', err.message);
    console.error('Make sure MySQL is started in XAMPP and check your .env settings.');
    process.exit(1);
  });
