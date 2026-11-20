import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
test('single-file Worker serves complete HTML and favicon without bindings', async () => {
  const res = await worker.fetch(new Request('https://dmc.test/'));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /DMC · 我的世界下载站/);
  assert.match(html, /<script>/);
  assert.match(html, /<style>/);
  assert.match(await (await worker.fetch(new Request('https://dmc.test/favicon.svg'))).text(), /<svg/);
  const head = await worker.fetch(new Request('https://dmc.test/', {method:'HEAD'}));
  assert.equal(await head.text(), '');
});
test('Worker rejects unsupported methods, missing routes and invalid proxy input', async () => {
  assert.equal((await worker.fetch(new Request('https://dmc.test/', {method:'POST'}))).status,405);
  assert.equal((await worker.fetch(new Request('https://dmc.test/missing'))).status,404);
  assert.equal((await worker.fetch(new Request('https://dmc.test/api/catalog?type=version&path=https://localhost/private'))).status,400);
});
test('Worker catalogue handles success and upstream failures', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async url=> { assert.equal(url,'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json'); return Response.json({latest:{release:'1.21.1'},versions:[]}); };
    const ok=await worker.fetch(new Request('https://dmc.test/api/catalog?type=manifest'));
    assert.equal(ok.status,200);assert.equal((await ok.json()).latest.release,'1.21.1');
    assert.match(ok.headers.get('cache-control'),/max-age=300/);
    globalThis.fetch=async()=>new Response('Forbidden',{status:403});
    const unavailable=await worker.fetch(new Request('https://dmc.test/api/catalog?type=java-mirror'));
    assert.equal(unavailable.status,502);assert.equal((await unavailable.json()).upstreamStatus,403);
  } finally {globalThis.fetch=original;}
});
