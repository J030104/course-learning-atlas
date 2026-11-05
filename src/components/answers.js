// The answer anchors also work when a reader follows the local contents.
function revealAnswer() {
  const id = location.hash.slice(1);
  const answer = document.getElementById(id);
  if (answer?.tagName === 'DETAILS') {
    answer.open = true;
    answer.scrollIntoView({ block: 'start' });
  }
}
window.addEventListener('hashchange', revealAnswer);
revealAnswer();

const preview = document.createElement('dialog');
preview.className = 'source-preview';
preview.setAttribute('aria-labelledby', 'source-preview-title');
preview.innerHTML = '<header><strong id="source-preview-title">講義預覽</strong><button type="button" aria-label="關閉講義預覽">關閉 ✕</button></header>';
const closeButton = preview.querySelector('button');
closeButton.onclick = () => preview.close();
preview.addEventListener('close', () => preview.querySelector('iframe')?.remove());
document.body.append(preview);

document.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !url.pathname.endsWith('/pdf.html')) return;
  event.preventDefault();
  preview.querySelector('strong').textContent = link.textContent.trim();
  const frame = document.createElement('iframe');
  frame.title = '講義 PDF 預覽';
  frame.src = url.href;
  frame.onload = () => {
    frame.contentDocument?.addEventListener('keydown', key => {
      if (key.key === 'Escape') {
        key.preventDefault();
        preview.close();
      }
    });
  };
  preview.append(frame);
  preview.showModal();
});
