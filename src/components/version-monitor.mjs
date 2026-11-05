const VERSION_FIELDS = ['course', 'shared', 'directory'];

export function isNewVersion(current, latest) {
  return VERSION_FIELDS.every(key => typeof latest?.[key] === 'string' && latest[key].length > 0) &&
    VERSION_FIELDS.some(key => latest[key] !== current[key]);
}

// The baseline comes from the HTML the reader actually opened, not a second request.
export function watchVersion() {
  const meta = document.querySelector('meta[name="atlas-version"]');
  const notices = [...document.querySelectorAll('[data-update-notice]')];
  if (!meta || !notices.length || window.top !== window) return;
  const current = JSON.parse(meta.content);
  const endpoint = new URL('./version.json', location.href);
  let checking = false;
  let pending = false;

  async function check() {
    if (checking || pending || document.hidden) return;
    checking = true;
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (response.ok && isNewVersion(current, await response.json())) {
        pending = true;
        notices.forEach(notice => { notice.hidden = false; });
      }
    } catch {
      // The current copy stays readable during a transient outage.
    } finally {
      checking = false;
    }
  }

  notices.forEach(notice => {
    notice.querySelector('button').addEventListener('click', () => {
      window.dispatchEvent(new Event('atlas-before-reload'));
      location.reload();
    });
  });
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  window.setInterval(check, 60_000);
  check();
}

watchVersion();
