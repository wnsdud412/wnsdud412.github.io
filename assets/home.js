import { validatePosts, friendlyDate } from './core.js';
const list = document.querySelector('#post-list');
const empty = document.querySelector('#empty-state');
const search = document.querySelector('#search');
const categories = document.querySelector('#categories');
const status = document.querySelector('#list-status');
let posts = [];
let category = 'all';
function render() {
  const query = search.value.trim().toLocaleLowerCase('ko');
  const selected = posts.filter(post => (category === 'all' || post.category === category) && `${post.title} ${post.summary} ${post.tags.join(' ')}`.toLocaleLowerCase('ko').includes(query));
  list.replaceChildren();
  for (const post of selected) {
    const row = document.createElement('a'); row.className = 'post-row'; row.href = post.url;
    const date = document.createElement('time'); date.dateTime = post.date; date.textContent = friendlyDate(post.date);
    const copy = document.createElement('div'); copy.className = 'post-copy';
    const title = document.createElement('h3'); title.textContent = post.title;
    const summary = document.createElement('p'); summary.textContent = post.summary;
    const badge = document.createElement('span'); badge.className = 'post-category'; badge.textContent = post.category;
    const arrow = document.createElement('span'); arrow.className = 'row-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    copy.append(title, summary, badge); row.append(date, copy, arrow); list.append(row);
  }
  document.querySelector('#post-count').textContent = String(selected.length);
  document.querySelector('#list-title').firstChild.textContent = category === 'all' ? '모든 글 ' : `${category} `;
  status.textContent = `${selected.length}개의 글`;
  empty.hidden = selected.length > 0;
  empty.querySelector('h3').textContent = posts.length ? '찾으시는 글이 없습니다.' : '아직 발행된 글이 없습니다.';
  empty.querySelector('p').textContent = posts.length ? '다른 검색어나 주제를 선택해 주세요.' : '새로운 기록이 이곳에 차곡차곡 모입니다.';
  for (const button of categories.querySelectorAll('button')) { const active = button.dataset.category === category; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
}
search.addEventListener('input', render);
categories.addEventListener('click', event => { const button = event.target.closest('button[data-category]'); if (button) { category = button.dataset.category; render(); } });
try {
  const response = await fetch('posts.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error();
  posts = validatePosts(await response.json());
  const counts = new Map([['all', posts.length]]);
  for (const post of posts) counts.set(post.category, (counts.get(post.category) || 0) + 1);
  categories.replaceChildren();
  for (const [value, count] of counts) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'category-button'; button.dataset.category = value;
    const label = document.createElement('span'); label.textContent = value === 'all' ? '전체 글' : value;
    const number = document.createElement('span'); number.className = 'category-count'; number.textContent = String(count);
    button.append(label, number); categories.append(button);
  }
  render();
} catch {
  empty.querySelector('h3').textContent = '글 목록을 불러오지 못했습니다.';
  empty.querySelector('p').textContent = '잠시 후 새로고침해 주세요.';
  status.textContent = '글 목록 불러오기 실패';
}
