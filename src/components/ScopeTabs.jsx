import { SCOPES, setScope, useScope } from '../scope';

export default function ScopeTabs() {
  const active = useScope();

  return (
    <div className="scope-tabs" role="tablist" aria-label="Choose which tracker to view">
      {SCOPES.map((scope) => (
        <button
          key={scope.id}
          type="button"
          role="tab"
          aria-selected={active === scope.id}
          className={`scope-tab ${active === scope.id ? 'active' : ''}`}
          onClick={() => setScope(scope.id)}
        >
          <span aria-hidden="true">{scope.emoji}</span> {scope.label}
        </button>
      ))}
    </div>
  );
}
