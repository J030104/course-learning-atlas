import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.min.mjs';

const assets = new URL('./vendor/pdfjs/', import.meta.url);
GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', assets).href;

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const status = $('status');
const pageInput = $('page-number');
const scroller = $('scroll');
const pages = $('pages');
const controls = ['previous', 'next', 'smaller', 'fit', 'larger'];
const slots = [];
const pagePadding = parseFloat(getComputedStyle(pages).paddingLeft);
let pdf, firstSize, pageNumber = 1, zoom = 1, scheduled = false, requestedPage;

if (window.parent !== window) $('atlas').hidden = true;

function fitScale(size) {
  const width = scroller.clientWidth - pagePadding * 2;
  return Math.min(1.8, Math.max(1, width) / size.width) * zoom;
}

function sizeSlot(slot) {
  const size = slot.size || firstSize;
  const scale = fitScale(size);
  slot.element.style.width = size.width * scale + 'px';
  slot.element.style.height = size.height * scale + 'px';
}

function removeRendering(slot) {
  slot.job?.task?.cancel();
  slot.job = null;
  slot.element.replaceChildren();
}

async function render(slot) {
  const job = {};
  slot.job = job;
  try {
    const page = await pdf.getPage(slot.number);
    if (slot.job !== job) return;
    slot.size = page.getViewport({ scale: 1 });
    sizeSlot(slot);
    const viewport = page.getViewport({ scale: fitScale(slot.size) });
    const density = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width * density));
    canvas.height = Math.max(1, Math.floor(viewport.height * density));
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '第 ' + slot.number + ' 頁');
    job.task = page.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] });
    await job.task.promise;
    if (slot.job !== job) return;
    slot.element.replaceChildren(canvas);
  } catch (error) {
    if (slot.job !== job || error.name === 'RenderingCancelledException') return;
    const notice = document.createElement('p');
    notice.textContent = '第 ' + slot.number + ' 頁無法顯示。可開啟原始檔案。';
    slot.element.replaceChildren(notice);
  }
}

function setPage(number) {
  const changed = number !== pageNumber;
  pageNumber = number;
  if (document.activeElement !== pageInput || requestedPage) pageInput.value = number;
  $('previous').disabled = number === 1;
  $('next').disabled = number === pdf.numPages;
  if (changed) document.dispatchEvent(new CustomEvent('atlas-page-change', { detail: number }));
}

function refresh() {
  scheduled = false;
  if (!slots.length) return;
  const top = scroller.scrollTop;
  const height = scroller.clientHeight;
  const bottom = top + height;
  const focus = top + Math.min(120, height / 4);
  const offset = slots.map(slot => slot.element.offsetTop);
  const ends = slots.map((slot, i) => offset[i] + slot.element.offsetHeight);
  const first = ends.findIndex(end => end > focus);
  setPage(requestedPage || (top > 0 && bottom >= scroller.scrollHeight - 1 ? pdf.numPages : Math.max(0, first) + 1));

  // Paint nearby pages only. Keep fixed-height slots so scrolling and page jumps stay available.
  slots.forEach((slot, i) => {
    const nearby = ends[i] >= top - height / 2 && offset[i] <= bottom + height / 2;
    if (nearby && !slot.job) render(slot);
    if (!nearby && slot.job) removeRendering(slot);
  });
}

function scheduleRefresh() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(refresh);
  }
}

function jump(number) {
  if (!slots.length) return;
  requestedPage = Math.max(1, Math.min(slots.length, Math.trunc(number) || 1));
  const slot = slots[requestedPage - 1].element;
  scroller.scrollTop = slot.offsetTop - pagePadding;
  refresh();
}

function resize(nextZoom = zoom) {
  if (!slots.length) return;
  const slot = slots[pageNumber - 1].element;
  const ratio = (scroller.scrollTop - slot.offsetTop) / slot.offsetHeight;
  zoom = nextZoom;
  pages.style.width = Math.max(scroller.clientWidth, scroller.clientWidth * zoom) + 'px';
  slots.forEach(slot => {
    removeRendering(slot);
    sizeSlot(slot);
  });
  scroller.scrollTop = slot.offsetTop + Math.round(ratio * slot.offsetHeight);
  refresh();
}

try {
  const file = new URL(params.get('file') || '.', location.href);
  const resources = new URL('./resources/', location.href);
  if (file.origin !== resources.origin || !file.pathname.startsWith(resources.pathname) ||
      !file.pathname.toLowerCase().endsWith('.pdf')) throw new Error('Invalid PDF path');
  const original = new URL(params.get('original') || file.href, location.href);
  const isPowerPoint = original.origin === resources.origin && original.pathname.startsWith(resources.pathname) &&
    original.pathname.toLowerCase().endsWith('.pptx');
  $('original').href = isPowerPoint ? original.href : file.href;
  $('original').textContent = isPowerPoint ? '原始 PPTX ↗' : '原始 PDF ↗';
  $('original').hidden = false;
  document.title = decodeURIComponent((isPowerPoint ? original : file).pathname.split('/').pop()) + ' · 課程學習圖鑑';
  pdf = await getDocument({
    url: file.href,
    cMapUrl: new URL('cmaps/', assets).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    wasmUrl: new URL('wasm/', assets).href,
    iccUrl: new URL('iccs/', assets).href,
    isEvalSupported: false,
    disableRange: true,
  }).promise;
  firstSize = (await pdf.getPage(1)).getViewport({ scale: 1 });
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= pdf.numPages; number++) {
    const element = document.createElement('div');
    element.className = 'pdf-page';
    const slot = { element, number };
    sizeSlot(slot);
    slots.push(slot);
    fragment.append(element);
  }
  pages.append(fragment);
  $('total').textContent = pdf.numPages;
  pageInput.max = pdf.numPages;
  pageInput.disabled = false;
  controls.forEach(id => { $(id).disabled = false; });
  status.hidden = true;
  jump(Number(params.get('page')));
} catch {
  status.textContent = '無法載入預覽。請返回學習圖譜，或使用原始檔案連結。';
}

$('page-form').onsubmit = event => { event.preventDefault(); jump(Number(pageInput.value)); };
pageInput.onchange = () => jump(Number(pageInput.value));
$('previous').onclick = () => jump(pageNumber - 1);
$('next').onclick = () => jump(pageNumber + 1);
$('smaller').onclick = () => resize(Math.max(0.6, zoom / 1.25));
$('larger').onclick = () => resize(Math.min(3, zoom * 1.25));
$('fit').onclick = () => resize(1);
scroller.addEventListener('scroll', scheduleRefresh, { passive: true });
for (const eventName of ['wheel', 'pointerdown', 'touchstart']) {
  scroller.addEventListener(eventName, () => { requestedPage = undefined; }, { passive: true });
}
document.addEventListener('keydown', event => {
  if (event.target.closest('input, button, a') || !slots.length) return;
  const step = Math.max(40, scroller.clientHeight - 48);
  const distances = { ArrowUp: -40, ArrowDown: 40, PageUp: -step, PageDown: step,
    Home: -scroller.scrollHeight, End: scroller.scrollHeight, ' ': event.shiftKey ? -step : step };
  if (!Object.hasOwn(distances,event.key)) return;
  event.preventDefault();
  requestedPage = undefined;
  scroller.scrollBy(0, distances[event.key]);
});
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resize(), 120);
});

window.addEventListener('atlas-before-reload', () => {
  const url = new URL(location.href);
  url.searchParams.set('page', pageNumber);
  history.replaceState(null, '', url);
});
