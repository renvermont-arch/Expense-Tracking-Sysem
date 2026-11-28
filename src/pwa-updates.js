import { registerSW } from 'virtual:pwa-register';

// In autoUpdate mode the generated service worker calls skipWaiting() as soon
// as it installs (see vite.config.js). When it activates, reload the open app
// so everyone sees the new build without manually refreshing.
let reloadTimer = null;

function reloadWhenSafe() {
  if (reloadTimer) return;

  const active = document.activeElement;
  const typing =
    active && (active.matches('input, textarea, select') || active.isContentEditable);

  if (!typing) {
    window.location.reload();
    return;
  }

  // Don't yank the page away while someone is filling in a form.
  const reload = () => {
    window.clearTimeout(reloadTimer);
    reloadTimer = null;
    window.location.reload();
  };
  document.addEventListener('focusout', reload, { once: true });
  reloadTimer = window.setTimeout(reload, 20000);
}

registerSW({ immediate: true, onNeedReload: reloadWhenSafe });

// A phone may not navigate for days, so actively ask the browser to check for
// a new service worker whenever connectivity or focus comes back.
export function checkForAppUpdate() {
  if (!('serviceWorker' in navigator) || navigator.onLine === false) return Promise.resolve();
  return navigator.serviceWorker
    .getRegistration()
    .then((registration) => (registration ? registration.update() : undefined))
    .catch(() => undefined);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', checkForAppUpdate);
  window.addEventListener('focus', checkForAppUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForAppUpdate();
  });
  window.setInterval(checkForAppUpdate, 15 * 60 * 1000);
}
