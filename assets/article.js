import { validatePosts, friendlyDate } from './core.js';
import { markdownFragment } from './markdown.js';
const title = document.querySelector('#article-title');
const body = document.querySelector('#article-body');
try {
  const slug = new URL(location.href).searchParams.get('post');
  const response = await fetch('posts.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error();
  const post = validatePosts(await response.json()).find(item => item.slug === slug);
  if (!post) { title.textContent = '글을 찾을 수 없습니다.'; body.textContent = '목록으로 돌아가 다른 글을 선택해 주세요.'; }
  else {
    const content = await fetch(post.path, { cache: 'no-cache' });
    if (!content.ok) throw new Error();
    title.textContent = post.title;
    document.title = `${post.title} — 기록`;
    document.querySelector('#article-meta').textContent = `${friendlyDate(post.date)}  /  ${post.category}`;
    document.querySelector('#article-summary').textContent = post.summary;
    body.replaceChildren(markdownFragment(await content.text(), { publicBase: new URL(post.path, location.href) }));
  }
} catch { title.textContent = '글을 불러오지 못했습니다.'; body.textContent = '잠시 후 다시 시도해 주세요.'; }
