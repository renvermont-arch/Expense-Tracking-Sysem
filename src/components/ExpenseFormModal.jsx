import { useState } from 'react';
import { CATEGORIES, UNITS } from '../config';
import { currencySymbol, formatMoney, isoDate } from '../utils';
import Icon from './Icon';
import Modal from './Modal';

export default function ExpenseFormModal({ expense, week, onClose, onSubmit, busy }) {
  const isEdit = Boolean(expense);
  const today = isoDate(new Date());
  const defaultDate =
    week && today >= week.week_start && today <= week.week_end ? today : week?.week_start || today;

  const [form, setForm] = useState({
    item_name: expense?.item_name || '',
    category: expense?.category || 'Food',
    quantity: expense ? String(expense.quantity) : '1',
    unit: expense?.unit || 'pcs',
    unit_price: expense ? String(expense.unit_price) : '',
    purchased_at: expense?.purchased_at || defaultDate,
    note: expense?.note || '',
  });

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const preview = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  return (
    <Modal
      title={isEdit ? 'Edit expense' : 'Add an expense'}
      subtitle={isEdit ? 'Update the details below' : `Logging a purchase in ${week?.name || 'this week'}`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <div className="form-grid">
          <label className="field field-full">
            <span>What did you buy? <em>*</em></span>
            <input
              autoFocus
              required
              maxLength={150}
              placeholder="e.g. Morning coffee"
              value={form.item_name}
              onChange={update('item_name')}
            />
          </label>

          <label className="field">
            <span>Category</span>
            <input list="category-options" placeholder="Food" value={form.category} onChange={update('category')} />
          </label>

          <label className="field">
            <span>Date <em>*</em></span>
            <input
              type="date"
              required
              min={week?.week_start}
              max={week?.week_end}
              value={form.purchased_at}
              onChange={update('purchased_at')}
            />
          </label>

          <label className="field">
            <span>Quantity <em>*</em></span>
            <input
              type="number"
              required
              min="0.001"
              step="0.001"
              placeholder="1"
              value={form.quantity}
              onChange={update('quantity')}
            />
          </label>

          <label className="field">
            <span>Unit</span>
            <input list="unit-options" placeholder="pcs" value={form.unit} onChange={update('unit')} />
          </label>

          <label className="field field-full">
            <span>Unit price <em>*</em></span>
            <div className="input-with-prefix">
              <span className="prefix">{currencySymbol()}</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.unit_price}
                onChange={update('unit_price')}
              />
            </div>
          </label>

          <label className="field field-full">
            <span>Note <small>(optional)</small></span>
            <input
              maxLength={255}
              placeholder="Anything you want to remember"
              value={form.note}
              onChange={update('note')}
            />
          </label>
        </div>

        <datalist id="category-options">
          {CATEGORIES.map((category) => <option key={category} value={category} />)}
        </datalist>
        <datalist id="unit-options">
          {UNITS.map((unit) => <option key={unit} value={unit} />)}
        </datalist>

        <div className="total-preview">
          <span><Icon name="sparkles" size={16} /> Total for this item</span>
          <strong>{formatMoney(preview)}</strong>
        </div>

        <div className="modal-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
