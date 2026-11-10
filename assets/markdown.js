import { marked } from './vendor/marked.js';
import DOMPurify from './vendor/purify.js';
import { parseFrontMatter, resolveRepoReference, fileKind } from './core.js';

export function markdownFragment(source, { privatePath, publicBase } = {}) {
  const { body } = parseFrontMatter(source);
  const fragment = DOMPurify.sanitize(marked.parse(body, { gfm: true, breaks: false }), {
    RETURN_DOM_FRAGMENT: true, USE_PROFILES: { html: true }, ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'link', 'meta'],
    FORBID_ATTR: ['style', 'srcset', 'name', 'id'],
  });
  for (const image of fragment.querySelectorAll('img')) {
    const original = image.getAttribute('src') || '';
    image.removeAttribute('src'); image.removeAttribute('srcset'); image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
    if (privatePath) {
      try {
        if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(original) && original.length < 7_000_000) image.src = original;
        else { const path = resolveRepoReference(privatePath, original); if (fileKind(path) !== 'IMAGE') throw new Error(); image.dataset.privateImage = path; }
      } catch { const note = document.createElement('span'); note.className = 'blocked-image-note'; note.textContent = '이 이미지는 비공개 저장소 내부 파일이 아닙니다.'; image.replaceWith(note); }
    } else {
      try { const url = new URL(original, publicBase); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); image.src = url.href; } catch { image.remove(); }
    }
  }
  for (const link of fragment.querySelectorAll('a')) {
    const reference = link.getAttribute('href') || '';
    if (/^https:\/\//i.test(reference)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; }
    else if (privatePath) {
      try { const path = resolveRepoReference(privatePath, reference); if (!fileKind(path)) throw new Error(); link.dataset.privateFile = path; link.href = '#'; } catch { link.removeAttribute('href'); }
    } else {
      try { const url = new URL(reference, publicBase); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); link.href = url.href; } catch { link.removeAttribute('href'); }
    }
  }
  return fragment;
}
