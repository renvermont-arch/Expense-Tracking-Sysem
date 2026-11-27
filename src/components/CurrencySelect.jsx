import { CURRENCIES, setCurrency, useCurrency } from '../currency';
import Icon from './Icon';

export default function CurrencySelect() {
  const code = useCurrency();
  const active = CURRENCIES.find((currency) => currency.code === code) || CURRENCIES[0];

  return (
    <label className="currency-select-wrap" title={`Currency: ${active.label}`}>
      <Icon name="wallet" size={16} />
      <select
        aria-label="Choose a currency"
        value={code}
        onChange={(event) => setCurrency(event.target.value)}
      >
        {CURRENCIES.map((currency) => (
          <option key={currency.code} value={currency.code} title={currency.label}>
            {currency.symbol} {currency.code}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={15} />
    </label>
  );
}
