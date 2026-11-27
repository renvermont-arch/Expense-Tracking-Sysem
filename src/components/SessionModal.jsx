import { useState } from 'react';
import { addDays, isoDate, mondayOf, weekLabel } from '../utils';
import Icon from './Icon';
import Modal from './Modal';

export default function SessionModal({ onClose, onSubmit, busy }) {
  const thisMonday = mondayOf(new Date());
  const lastMonday = addDays(thisMonday, -7);

  const [form, setForm] = useState({
    name: weekLabel(thisMonday),
    week_start: isoDate(thisMonday),
    week_end: isoDate(addDays(thisMonday, 6)),
    note: '',
  });

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const chooseWeek = (start) => {
    setForm((current) => ({
      ...current,
      name: current.name.startsWith('Week of') ? weekLabel(start) : current.name,
      week_start: isoDate(start),
      week_end: isoDate(addDays(start, 6)),
    }));
  };

  return (
    <Modal title="New week" subtitle="A fresh little page for your expenses" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <div className="quick-range">
          <button type="button" onClick={() => chooseWeek(thisMonday)} className="chip-button active">
            <Icon name="calendar" size={15} /> This week
          </button>
          <button type="button" onClick={() => chooseWeek(lastMonday)} className="chip-button">
            <Icon name="calendar" size={15} /> Last week
          </button>
        </div>

        <div className="form-grid">
          <label className="field field-full">
            <span>Week name <em>*</em></span>
            <input autoFocus required maxLength={120} placeholder="e.g. Week of Nov 24" value={form.name} onChange={update('name')} />
          </label>
          <label className="field">
            <span>Start date <em>*</em></span>
            <input
              type="date"
              required
              value={form.week_start}
              onChange={(event) => {
                const start = new Date(`${event.target.value}T00:00:00`);
                setForm((current) => ({
                  ...current,
                  week_start: event.target.value,
                  week_end: Number.isNaN(start.getTime()) ? current.week_end : isoDate(addDays(start, 6)),
                }));
              }}
            />
          </label>
          <label className="field">
            <span>End date <em>*</em></span>
            <input type="date" required min={form.week_start} value={form.week_end} onChange={update('week_end')} />
          </label>
          <label className="field field-full">
            <span>Note <small>(optional)</small></span>
            <input maxLength={255} placeholder="Anything about this week" value={form.note} onChange={update('note')} />
          </label>
        </div>

        <p className="form-hint">Each week keeps its own purchases and total. ✨</p>

        <div className="modal-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create week'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
