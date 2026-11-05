export function mountPreview(body, url, title, { sandboxed, close, onPage } = {}) {
  const frame = document.createElement('iframe');
  frame.src = url;
  frame.title = title;
  if (sandboxed) frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-downloads');
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !doc.querySelector('dialog[open]')) {
        event.preventDefault();
        close();
      }
    });
    if (onPage) doc.addEventListener('atlas-page-change', event => onPage(event.detail));
  });
  body.replaceChildren(frame);
}
