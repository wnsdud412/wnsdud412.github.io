import { marked } from './vendor/marked.js';
import DOMPurify from './vendor/purify.js';
import { parseFrontMatter, resolveRepoReference, fileKind } from './core.js';

function fitChordSheets(fragment) {
  for (const table of fragment.querySelectorAll('table.chord-sheet')) {
    const rows = [...table.rows];
    const systems = document.createElement('div');
    systems.className = 'chord-sheet-systems';
    let valid = rows.length > 0 && rows.length % 2 === 0;
    let measureNumber = 0;

    for (let index = 0; valid && index < rows.length; index += 2) {
      const chordRow = rows[index];
      const lyricRow = rows[index + 1];
      if (!chordRow.classList.contains('chord-row') || !lyricRow.classList.contains('lyric-row')) {
        valid = false;
        break;
      }

      const starts = [0];
      let columns = 0;
      for (const cell of chordRow.cells) {
        if (columns && cell.classList.contains('bar-start')) starts.push(columns);
        columns += cell.colSpan;
      }
      const lyricColumns = [...lyricRow.cells].reduce((total, cell) => total + cell.colSpan, 0);
      if (!columns || columns !== lyricColumns || [...chordRow.cells, ...lyricRow.cells].some(cell => cell.rowSpan !== 1)) {
        valid = false;
        break;
      }
      starts.push(columns);

      for (let measure = 0; measure < starts.length - 1; measure++) {
        const start = starts[measure];
        const end = starts[measure + 1];
        const part = document.createElement('table');
        part.className = 'chord-sheet chord-measure';
        part.setAttribute('aria-label', `${++measureNumber}마디`);
        const body = document.createElement('tbody');

        for (const row of [chordRow, lyricRow]) {
          const copy = row.cloneNode(false);
          let position = 0;
          for (const cell of row.cells) {
            const next = position + cell.colSpan;
            const overlap = Math.min(next, end) - Math.max(position, start);
            if (overlap > 0) {
              const value = cell.cloneNode(true);
              value.colSpan = overlap;
              // A lyric spanning a bar line appears once, at its original start.
              if (position < start) value.replaceChildren();
              copy.append(value);
            }
            position = next;
          }
          body.append(copy);
        }
        part.append(body);
        systems.append(part);
      }
    }

    if (valid) {
      if (!table.parentElement?.classList.contains('chord-sheet-wrap')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chord-sheet-wrap';
        table.replaceWith(wrapper);
        wrapper.append(table);
      }
      table.replaceWith(systems);
    }
  }
}

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
  if (privatePath) fitChordSheets(fragment);
  return fragment;
}
