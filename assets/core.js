export function safeRepoPath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || /^[\/]/.test(value) || /[\\\x00-\x1f\x7f?#%:]/.test(value)) throw new Error('올바르지 않은 파일 경로입니다.');
  const parts = value.split('/');
  if (parts.some(part => !part || part.startsWith('.'))) throw new Error('허용되지 않은 파일 경로입니다.');
  return parts.join('/');
}

export function resolveRepoReference(basePath, reference) {
  safeRepoPath(basePath);
  if (typeof reference !== 'string' || !reference || /^(?:[a-z][a-z\d+.-]*:|[\/])/i.test(reference) || /[\\\x00-\x1f\x7f?]/.test(reference)) throw new Error('저장소 내부 파일만 불러올 수 있습니다.');
  let decoded;
  try { decoded = decodeURIComponent(reference.split('#')[0]); } catch { throw new Error('올바르지 않은 파일 주소입니다.'); }
  if (!decoded || /^(?:[a-z][a-z\d+.-]*:|[\/])/i.test(decoded)) throw new Error('저장소 내부 파일만 불러올 수 있습니다.');
  const parts = basePath.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error('저장소 밖의 파일은 불러올 수 없습니다.');
      parts.pop();
    } else parts.push(part);
  }
  return safeRepoPath(parts.join('/'));
}

export function fileKind(path) {
  if (/\.md$/i.test(path)) return 'MD';
  if (/\.pdf$/i.test(path)) return 'PDF';
  if (/\.(?:png|jpe?g|webp|gif)$/i.test(path)) return 'IMAGE';
  return null;
}

export function parseFrontMatter(source) {
  source = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!source.startsWith('---\n')) return { metadata: {}, body: source };
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) return { metadata: {}, body: source };
  const metadata = {};
  for (const line of source.slice(4, end).split('\n')) {
    const match = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
    if (!match || ['__proto__', 'constructor', 'prototype'].includes(match[1])) continue;
    let value = match[2].trim();
    if (/^".*"$/.test(value) || /^\[.*\]$/.test(value)) {
      try { value = JSON.parse(value); } catch { value = value.replace(/^"|"$/g, ''); }
    } else if (/^'.*'$/.test(value)) value = value.slice(1, -1);
    metadata[match[1]] = value;
  }
  return { metadata, body: source.slice(end + 5) };
}

export function validatePosts(input) {
  if (!Array.isArray(input)) throw new Error('글 목록 형식이 올바르지 않습니다.');
  const slugs = new Set();
  return input.map(item => {
    if (!item || typeof item.slug !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(item.slug) || slugs.has(item.slug.toLowerCase()) || typeof item.title !== 'string' || !item.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) throw new Error('글 정보가 올바르지 않습니다.');
    const path = safeRepoPath(item.path);
    if (!path.startsWith('content/posts/') || !path.endsWith('.md')) throw new Error('공개 글 경로가 올바르지 않습니다.');
    if (Number.isNaN(Date.parse(`${item.date}T00:00:00Z`)) || new Date(`${item.date}T00:00:00Z`).toISOString().slice(0, 10) !== item.date) throw new Error('글 날짜가 올바르지 않습니다.');
    slugs.add(item.slug.toLowerCase());
    return { slug: item.slug, title: item.title.trim(), date: item.date, path, url: `posts/${encodeURIComponent(item.slug)}/`, summary: typeof item.summary === 'string' ? item.summary : '', category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : '기록', tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : [] };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ko'));
}

export function friendlyDate(value) { return value.replaceAll('-', '.'); }
