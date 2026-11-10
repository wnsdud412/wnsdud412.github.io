import { GitHubLibrary } from './library.js';
import { fileKind, parseFrontMatter } from './core.js';
import { markdownFragment } from './markdown.js';
const library = new GitHubLibrary();
const form = document.querySelector('#connect-form');
const input = document.querySelector('#access-token');
const connectButton = document.querySelector('#connect-button');
const disconnectButton = document.querySelector('#disconnect');
const status = document.querySelector('#connection-status');
const connectPanel = document.querySelector('#connect-panel');
const libraryPanel = document.querySelector('#library-panel');
const viewer = document.querySelector('#viewer');
const fileList = document.querySelector('#file-list');
const search = document.querySelector('#file-search');
let files = []; let selected = ''; let viewVersion = 0; let connectionVersion = 0;
const objectUrls = new Set();
function message(text, error = false) { status.textContent = text; status.classList.toggle('error-text', error); }
function placeholder() {
  viewer.replaceChildren();
  const wrapper = document.createElement('div'); wrapper.className = 'viewer-placeholder';
  const symbol = document.createElement('span'); symbol.className = 'empty-mark'; symbol.textContent = '♪'; symbol.setAttribute('aria-hidden', 'true');
  const title = document.createElement('h2'); title.textContent = files.length ? '악보를 선택해 주세요.' : '첫 악보를 기다리고 있어요.';
  const copy = document.createElement('p'); copy.textContent = files.length ? '목록에서 악보나 연습 메모를 열어보세요.' : '보관함에 악보를 추가한 뒤 다시 연결해 주세요.';
  wrapper.append(symbol, title, copy); viewer.append(wrapper);
}
function reset({ notice = '' } = {}) {
  connectionVersion++; viewVersion++; library.clear();
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear(); files = []; selected = ''; input.value = ''; search.value = ''; fileList.replaceChildren(); viewer.replaceChildren();
  connectPanel.hidden = false; libraryPanel.hidden = true; disconnectButton.hidden = true;
  document.querySelector('#connection-label').textContent = '연결되지 않음'; document.querySelector('#connection-dot').classList.remove('connected');
  connectButton.disabled = false; connectButton.textContent = '연결하기 →'; input.disabled = false;
  message(notice);
}
function renderFiles() {
  const query = search.value.trim().toLocaleLowerCase('ko');
  const visible = files.filter(file => file.path.toLocaleLowerCase('ko').includes(query));
  fileList.replaceChildren();
  for (const file of visible) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'file-button'; button.classList.toggle('active', selected === file.path); button.setAttribute('aria-pressed', String(selected === file.path)); button.dataset.path = file.path;
    const type = document.createElement('span'); type.className = 'file-type'; type.textContent = file.kind === 'IMAGE' ? 'IMAGE' : file.kind;
    const label = document.createElement('span'); label.textContent = file.path.split('/').at(-1).replace(/\.md$/i, '');
    const folder = document.createElement('span'); folder.className = 'file-folder'; folder.textContent = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    button.append(type, label, folder); fileList.append(button);
  }
  document.querySelector('#file-count').textContent = `${visible.length}개의 파일`;
  const empty = document.querySelector('#library-empty'); empty.hidden = visible.length > 0; empty.textContent = files.length ? '검색 결과가 없습니다.' : '보관된 악보가 없습니다.';
}
const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
function asUrl(buffer, path) {
  const mime = mimeTypes[path.split('.').at(-1).toLowerCase()];
  if (!mime) throw new Error('지원하지 않는 파일 형식입니다.');
  if (mime === 'application/pdf' && new TextDecoder().decode(buffer.slice(0, 5)) !== '%PDF-') throw new Error('올바른 PDF 파일이 아닙니다.');
  const url = URL.createObjectURL(new Blob([buffer], { type: mime })); objectUrls.add(url); return url;
}
async function openFile(path) {
  if (!fileKind(path)) return;
  const version = ++viewVersion; const connection = connectionVersion;
  selected = path; renderFiles(); message('자료를 불러오고 있습니다.');
  viewer.replaceChildren();
  try {
    const buffer = await library.readFile(path);
    if (version !== viewVersion || connection !== connectionVersion) return;
    const heading = document.createElement('div'); heading.className = 'viewer-title';
    const title = document.createElement('h2'); title.textContent = path.split('/').at(-1).replace(/\.md$/i, ''); heading.append(title); viewer.append(heading);
    if (fileKind(path) === 'MD') {
      if (buffer.byteLength > 2_000_000) throw new Error('메모는 2MB 이하의 Markdown 파일로 나눠 주세요.');
      const text = new TextDecoder().decode(buffer); const parsed = parseFrontMatter(text);
      if (typeof parsed.metadata.title === 'string') title.textContent = parsed.metadata.title;
      const body = document.createElement('div'); body.className = 'prose'; body.append(markdownFragment(text, { privatePath: path })); viewer.append(body);
      await Promise.allSettled([...body.querySelectorAll('img[data-private-image]')].map(async image => {
        try { const target = image.dataset.privateImage; const content = await library.readFile(target); if (version === viewVersion && connection === connectionVersion) image.src = asUrl(content, target); }
        catch { if (version === viewVersion && connection === connectionVersion) { const note = document.createElement('span'); note.className = 'blocked-image-note'; note.textContent = `이미지를 불러오지 못했습니다: ${image.alt || image.dataset.privateImage}`; image.replaceWith(note); } }
      }));
    } else {
      const url = asUrl(buffer, path);
      const open = document.createElement('a'); open.href = url; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = '새 탭에서 보기 ↗'; heading.append(open);
      if (fileKind(path) === 'PDF') { const frame = document.createElement('iframe'); frame.className = 'pdf-frame'; frame.title = '개인 악보 PDF'; frame.referrerPolicy = 'no-referrer'; frame.src = url; const hint = document.createElement('p'); hint.className = 'field-note'; hint.textContent = 'PDF가 보이지 않으면 위의 ‘새 탭에서 보기’를 이용해 주세요.'; viewer.append(frame, hint); }
      else { const image = document.createElement('img'); image.className = 'score-image'; image.alt = path.split('/').at(-1); image.src = url; viewer.append(image); }
    }
    if (version === viewVersion && connection === connectionVersion) message('');
  } catch (error) {
    if (version !== viewVersion || connection !== connectionVersion || error.name === 'AbortError') return;
    viewer.replaceChildren(); message(error.message || '자료를 불러오지 못했습니다.', true);
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const token = input.value.trim(); input.value = ''; input.disabled = true; connectButton.disabled = true;
  const version = ++connectionVersion;
  message('비공개 보관함에 연결하고 있습니다.');
  try {
    files = await library.connect(token);
    if (version !== connectionVersion) return;
    connectPanel.hidden = true; libraryPanel.hidden = false; disconnectButton.hidden = false;
    document.querySelector('#connection-label').textContent = '연결됨 · 읽기 전용'; document.querySelector('#connection-dot').classList.add('connected');
    renderFiles(); placeholder(); message('');
  } catch (error) {
    if (version !== connectionVersion) return;
    reset(); message(error.name === 'AbortError' ? '연결이 취소되었습니다.' : error.message, true); input.focus();
  }
});
disconnectButton.addEventListener('click', () => { reset({ notice: '연결을 해제했습니다. 불러온 자료와 토큰을 지웠습니다.' }); input.focus(); });
search.addEventListener('input', renderFiles);
fileList.addEventListener('click', event => { const button = event.target.closest('button[data-path]'); if (button) void openFile(button.dataset.path); });
viewer.addEventListener('click', event => { const link = event.target.closest('a[data-private-file]'); if (link) { event.preventDefault(); void openFile(link.dataset.privateFile); } });
window.addEventListener('pagehide', () => reset());
window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
