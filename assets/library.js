import { safeRepoPath, fileKind } from './core.js';
const API = 'https://api.github.com';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
export class LibraryError extends Error {}

export class GitHubLibrary {
  #token = ''; #controller; #files = []; #cache = new Map(); #epoch = 0;
  #fetch; #prefix;
  constructor({ owner = 'wnsdud412', repo = 'private-tabs', fetcher = globalThis.fetch.bind(globalThis) } = {}) {
    if (!/^[\w-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw new LibraryError('저장소 설정이 올바르지 않습니다.');
    this.#fetch = fetcher;
    this.#prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }
  get files() { return this.#files.map(item => ({ ...item })); }
  clear() { this.#controller?.abort(); this.#controller = undefined; this.#token = ''; this.#files = []; this.#cache = new Map(); this.#epoch++; }
  async #request(suffix, raw = false) {
    if (!this.#token || !this.#controller) throw new LibraryError('먼저 보관함을 연결해 주세요.');
    const epoch = this.#epoch;
    let response;
    try {
      response = await this.#fetch(`${API}${this.#prefix}${suffix}`, {
        method: 'GET', headers: { Authorization: `Bearer ${this.#token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
        credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: this.#controller.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError' || epoch !== this.#epoch) throw new DOMException('연결이 해제되었습니다.', 'AbortError');
      throw new LibraryError('GitHub에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.');
    }
    if (epoch !== this.#epoch) throw new DOMException('연결이 해제되었습니다.', 'AbortError');
    if (!response.ok) {
      if (response.status === 401) throw new LibraryError('토큰이 올바르지 않거나 만료되었습니다. 다시 연결해 주세요.');
      if (response.status === 403) throw new LibraryError('읽기 권한이 없거나 요청 한도에 도달했습니다. 토큰의 Contents 읽기 권한을 확인해 주세요.');
      if (response.status === 404 || response.status === 409) throw new LibraryError('파일을 찾을 수 없습니다. 저장소 선택과 읽기 권한을 확인해 주세요.');
      throw new LibraryError('자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    return { response, epoch };
  }
  async connect(token) {
    this.clear();
    if (typeof token !== 'string' || token.trim().length < 16 || token.length > 300 || /\s/.test(token.trim())) throw new LibraryError('접근 토큰을 다시 확인해 주세요.');
    this.#token = token.trim(); this.#controller = new AbortController();
    const attempt = this.#epoch;
    try {
      const { response, epoch } = await this.#request('');
      const repo = await response.json();
      if (epoch !== this.#epoch) throw new DOMException('연결이 해제되었습니다.', 'AbortError');
      if (repo.private !== true) throw new LibraryError('악보 저장소가 비공개 상태가 아닙니다. GitHub에서 Private 설정을 확인해 주세요.');
      const branch = typeof repo.default_branch === 'string' ? repo.default_branch : 'main';
      const treeResult = await this.#request(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      const tree = await treeResult.response.json();
      if (treeResult.epoch !== this.#epoch) throw new DOMException('연결이 해제되었습니다.', 'AbortError');
      if (tree.truncated) throw new LibraryError('보관함의 파일이 너무 많아 목록을 모두 읽을 수 없습니다.');
      if (!Array.isArray(tree.tree)) throw new LibraryError('파일 목록 형식이 올바르지 않습니다.');
      this.#files = tree.tree.filter(item => item.type === 'blob' && typeof item.path === 'string' && fileKind(item.path) && !/(^|\/)readme\.md$/i.test(item.path)).flatMap(item => {
        try { return [{ path: safeRepoPath(item.path), kind: fileKind(item.path), size: item.size || 0 }]; } catch { return []; }
      }).sort((a, b) => a.path.localeCompare(b.path, 'ko', { numeric: true }));
      return this.files;
    } catch (error) { if (this.#epoch === attempt) this.clear(); throw error; }
  }
  async readFile(path) {
    safeRepoPath(path);
    if (!fileKind(path)) throw new LibraryError('지원하지 않는 파일 형식입니다.');
    if (!this.#token) throw new LibraryError('먼저 보관함을 연결해 주세요.');
    const cache = this.#cache;
    if (!cache.has(path)) {
      const promise = (async () => {
        const { response, epoch } = await this.#request(`/contents/${path.split('/').map(encodeURIComponent).join('/')}`, true);
        if (Number(response.headers.get('content-length')) > MAX_FILE_SIZE) throw new LibraryError('50MB 이하의 파일만 열 수 있습니다.');
        const buffer = await response.arrayBuffer();
        if (epoch !== this.#epoch) throw new DOMException('연결이 해제되었습니다.', 'AbortError');
        if (buffer.byteLength > MAX_FILE_SIZE) throw new LibraryError('50MB 이하의 파일만 열 수 있습니다.');
        return buffer;
      })();
      cache.set(path, promise);
      promise.catch(() => cache.delete(path));
    }
    return cache.get(path);
  }
}
