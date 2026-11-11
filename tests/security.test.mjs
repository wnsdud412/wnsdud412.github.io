import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeRepoPath, resolveRepoReference, parseFrontMatter, validatePosts } from '../assets/core.js';
import { GitHubLibrary } from '../assets/library.js';
import { renderMarkdown, renderPost } from '../scripts/build-index.mjs';

const TEST_TOKEN = 'test-only-not-a-real-credential';
const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
test('private image references remain inside the repository', () => {
  assert.equal(resolveRepoReference('notes/song.md', '../scores/악보 1.png'), 'scores/악보 1.png');
  assert.equal(resolveRepoReference('notes/song.md', '../scores/악보%201.png'), 'scores/악보 1.png');
  for (const reference of ['https://evil.test/a.png', '//evil.test/a.png', '/a.png', '../../secret.png', '%2e%2e/%2e%2e/secret.png', '..\\secret.png', 'data:text/html,evil', '%2f%2fevil.test/a.png', 'a.png?token=x']) assert.throws(() => resolveRepoReference('notes/song.md', reference));
  for (const entry of ['../secret.md', '.git/config', 'a//b.pdf', 'a/./b.png', 'a/%2e%2e/b.md', 'https://evil.test/a.pdf']) assert.throws(() => safeRepoPath(entry));
});
test('post metadata rejects output traversal, private paths and invalid dates', () => {
  const base = { slug: 'first-note', title: '첫 기록', date: '2026-11-10', path: 'content/posts/first-note.md', tags: ['메모'] };
  assert.equal(validatePosts([base])[0].url, 'posts/first-note/');
  for (const changed of [{ slug: '../secret' }, { path: '.private/score.md' }, { date: '2026-02-30' }]) assert.throws(() => validatePosts([{ ...base, ...changed }]));
  assert.throws(() => validatePosts([base, { ...base, slug: 'FIRST-NOTE' }]));
  const parsed = parseFrontMatter('---\ntitle: "메모"\ntags: ["기타", "연습"]\n---\n# 본문');
  assert.equal(parsed.metadata.title, '메모'); assert.deepEqual(parsed.metadata.tags, ['기타', '연습']); assert.equal(parsed.body, '# 본문');
});
test('public static Markdown cannot inject active HTML, URLs or metadata', () => {
  const rendered = renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![bad](data:text/html,evil)\n\n<img src=x onerror=alert(1)>\n\n[good](https://example.com/)', 'content/posts/test.md');
  assert.ok(!rendered.includes('<script>')); assert.ok(!rendered.includes('href="javascript:')); assert.ok(!rendered.includes('src="data:')); assert.ok(!rendered.includes('<img src=x')); assert.ok(rendered.includes('href="https://example.com/"'));
  const html = renderPost({ title: '"><script>bad</script>', summary: '" onload="bad', date: '2026-11-10', path: 'content/posts/test.md', url: 'posts/test/', category: '<img src=x>' }, '## 본문');
  assert.ok(!html.includes('<script>bad</script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('rel="canonical"'));
});
test('private API requests use only GitHub, minimum read methods and no persistent cache', async () => {
  const requests = [];
  const client = new GitHubLibrary({ fetcher: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/private-tabs')) return json({ private: true, default_branch: 'main' });
    if (url.includes('/git/trees/')) return json({ tree: [{ path: 'notes/연습.md', type: 'blob' }, { path: 'README.md', type: 'blob' }, { path: '.git/secret.md', type: 'blob' }, { path: 'scores/score.pdf', type: 'blob' }] });
    return new Response('# 연습');
  } });
  const files = await client.connect(TEST_TOKEN); assert.equal(files.length, 2);
  const content = await client.readFile('notes/연습.md'); assert.equal(new TextDecoder().decode(content), '# 연습');
  for (const { url, options } of requests) {
    assert.equal(new URL(url).origin, 'https://api.github.com'); assert.ok(!url.includes(TEST_TOKEN));
    assert.equal(options.headers.Authorization, `Bearer ${TEST_TOKEN}`); assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.equal(options.referrerPolicy, 'no-referrer');
  }
  const count = requests.length; await assert.rejects(client.readFile('../../x.md')); assert.equal(requests.length, count);
  client.clear(); assert.equal(client.files.length, 0); await assert.rejects(client.readFile('notes/연습.md')); assert.equal(requests.length, count);
});
test('a public repository is rejected before any private file is requested', async () => {
  let calls = 0; const client = new GitHubLibrary({ fetcher: async () => { calls++; return json({ private: false }); } });
  await assert.rejects(client.connect(TEST_TOKEN), /비공개/); assert.equal(calls, 1); assert.equal(client.files.length, 0);
});
test('the default fetch uses the browser global as its receiver', async context => {
  context.mock.method(globalThis, 'fetch', async function (url) {
    assert.equal(this, globalThis);
    if (url.endsWith('/private-tabs')) return json({ private: true, default_branch: 'main' });
    return json({ tree: [] });
  });

  const client = new GitHubLibrary();
  assert.deepEqual(await client.connect(TEST_TOKEN), []);
});
test('revoked or invalid credentials do not expose raw server messages', async () => {
  const client = new GitHubLibrary({ fetcher: async () => new Response(`server debug ${TEST_TOKEN}`, { status: 401 }) });
  await assert.rejects(client.connect(TEST_TOKEN), error => /토큰/.test(error.message) && !error.message.includes(TEST_TOKEN));
  await assert.rejects(client.readFile('score.pdf'));
});
test('disconnect during a pending request cannot restore a stale session', async () => {
  let resolveRequest; const client = new GitHubLibrary({ fetcher: () => new Promise(resolve => { resolveRequest = resolve; }) });
  const request = client.connect(TEST_TOKEN); client.clear(); resolveRequest(json({ private: true, default_branch: 'main' }));
  await assert.rejects(request, error => error.name === 'AbortError'); assert.deepEqual(client.files, []);
});
test('viewer source never persists credentials and all executable assets are local', async () => {
  for (const file of ['private.js', 'library.js']) {
    const source = await readFile(new URL(`../assets/${file}`, import.meta.url), 'utf8');
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|console\.(?:log|error|debug)/.test(source), file);
  }
  const html = await readFile(new URL('../private/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes("connect-src https://api.github.com")); assert.ok(html.includes("img-src blob: data:")); assert.ok(!/src="https?:/.test(html));
});
