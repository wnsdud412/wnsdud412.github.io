import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from '../assets/vendor/marked.js';
import { parseFrontMatter, validatePosts, friendlyDate } from '../assets/core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const siteUrl = 'https://wnsdud412.github.io';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function linkUrl(value, base) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f\\]/.test(value)) return null;
  try { const url = new URL(value, base); if (!['https:', 'http:'].includes(url.protocol)) return null; return url.origin === siteUrl ? `${url.pathname}${url.search}${url.hash}` : url.href; } catch { return null; }
}
export function renderMarkdown(markdown, sourcePath) {
  const renderer = new Marked({ gfm: true });
  renderer.use({ renderer: {
    html({ text }) { return escapeHtml(text); },
    link({ href, title, tokens }) {
      const content = this.parser.parseInline(tokens);
      const url = linkUrl(href, `${siteUrl}/${sourcePath}`);
      if (!url) return content;
      return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''} rel="noopener noreferrer">${content}</a>`;
    },
    image({ href, text, title }) {
      const url = linkUrl(href, `${siteUrl}/${sourcePath}`);
      return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" referrerpolicy="no-referrer">` : escapeHtml(text);
    },
  } });
  return renderer.parse(markdown);
}
export function renderPost(post, body) {
  const title = escapeHtml(post.title); const summary = escapeHtml(post.summary); const url = `${siteUrl}/${post.url}`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — 기록</title><meta name="description" content="${summary}"><meta property="og:title" content="${title}"><meta property="og:description" content="${summary}"><meta property="og:type" content="article"><meta property="og:url" content="${escapeHtml(url)}"><meta property="article:published_time" content="${post.date}T00:00:00+09:00"><link rel="canonical" href="${escapeHtml(url)}"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; object-src 'none'; base-uri 'none'; form-action 'none'"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css"><script type="module" src="/assets/site.js"></script></head>
<body><a class="skip-link" href="#main">본문으로 바로가기</a><header class="site-header shell"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span>기록<span class="brand-owner">wnsdud412</span></a><nav aria-label="주 메뉴"><a href="/" aria-current="page">글</a><a href="/about.html">소개</a><a href="/private/" class="private-nav">개인 악보<span aria-hidden="true">↗</span></a><button class="theme-toggle" type="button" aria-label="어두운 화면으로 바꾸기" title="화면 테마 변경">◐</button></nav></header><main id="main" class="shell narrow page-content"><a class="text-link" href="/">← 모든 글</a><article><header class="article-header"><p class="eyebrow">${friendlyDate(post.date)} / ${escapeHtml(post.category)}</p><h1 class="page-title">${title}</h1><p class="article-summary">${summary}</p></header><div class="prose">${renderMarkdown(body, post.path)}</div></article></main><footer class="site-footer shell"><p>© <span data-year>2026</span> wnsdud412</p><p>조금씩, 꾸준히 기록하기.</p><a href="/">모든 글 ↑</a></footer></body></html>\n`;
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.isFile() && /\.md$/i.test(entry.name) && entry.name.toLowerCase() !== 'readme.md') files.push(target);
  }
  return files;
}
export async function build() {
  const drafts = [];
  for (const filename of await walk(path.join(root, 'content', 'posts'))) {
    const { metadata, body } = parseFrontMatter(await readFile(filename, 'utf8'));
    if (!metadata.title || !metadata.date || !metadata.summary) throw new Error(`${path.basename(filename)}: title, date, summary가 필요합니다.`);
    if (metadata.draft) throw new Error('공개 저장소에는 비공개 초안을 두지 마세요. 별도 비공개 저장소에 보관해야 합니다.');
    const filePath = path.relative(root, filename).split(path.sep).join('/');
    const item = { ...metadata, slug: metadata.slug || path.basename(filename, '.md'), path: filePath };
    drafts.push({ item, body });
  }
  const posts = validatePosts(drafts.map(draft => draft.item));
  for (const post of posts) {
    const output = path.join(root, 'posts', post.slug);
    await mkdir(output, { recursive: true });
    const draft = drafts.find(entry => entry.item.slug === post.slug);
    await writeFile(path.join(output, 'index.html'), renderPost(post, draft.body));
  }
  await writeFile(path.join(root, 'posts.json'), `${JSON.stringify(posts, null, 2)}\n`);
  const locations = ['', '/about.html', ...posts.map(post => `/${post.url}`)];
  await writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.map(location => `<url><loc>${escapeHtml(siteUrl + location)}</loc></url>`).join('')}</urlset>\n`);
  await writeFile(path.join(root, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>기록 — wnsdud412</title><link>${siteUrl}</link><description>대화에서 시작해 글로 남기는 생각</description><language>ko</language>${posts.map(post => `<item><title>${escapeHtml(post.title)}</title><link>${escapeHtml(`${siteUrl}/${post.url}`)}</link><guid>${escapeHtml(`${siteUrl}/${post.url}`)}</guid><description>${escapeHtml(post.summary)}</description><pubDate>${new Date(`${post.date}T00:00:00+09:00`).toUTCString()}</pubDate></item>`).join('')}</channel></rss>\n`);
  console.log(`공개 글 ${posts.length}개 · 글 목록, 개별 페이지, RSS, 사이트맵 생성 완료`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
