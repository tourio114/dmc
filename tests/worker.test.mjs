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
test('new sources return clear configuration errors without leaking keys',async()=>{
 const unconfigured=await worker.fetch(new Request('https://dmc.test/api/mods?source=curseforge&action=search&q=sodium'));
 assert.equal(unconfigured.status,503);assert.match((await unconfigured.json()).error,/CURSEFORGE_API_KEY/);
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).hostname,'api.curseforge.com');assert.equal(options.headers['x-api-key'],'test-secret');return Response.json({data:[{id:42,slug:'example',name:'Example',summary:'A mod',downloadCount:1,links:{websiteUrl:'https://example.invalid'}}],pagination:{totalCount:1}});};
  const configured=await worker.fetch(new Request('https://dmc.test/api/mods?source=curseforge&action=search'),{CURSEFORGE_API_KEY:'test-secret'});
  assert.equal(configured.status,200);const body=await configured.text();assert(!body.includes('test-secret'));assert.match(body,/curseforge.com\/minecraft\/mc-mods\/example/);
 }finally{globalThis.fetch=original;}
});
test('mod downloads resolve provider metadata and stream only the matching file',async()=>{
 const original=globalThis.fetch;const bytes=new Uint8Array([80,75,3,4,1,2,3]);
 const version={id:'version1',project_id:'project1',name:'Mod 1',date_published:'2026-01-01',game_versions:['1.21.1'],loaders:['fabric'],files:[{filename:'test.jar',url:'https://cdn.modrinth.com/data/project1/versions/version1/test.jar',size:bytes.length,primary:true,hashes:{}}],dependencies:[]};
 try{
  globalThis.fetch=async url=>{if(String(url).includes('/version/version1'))return Response.json(version);assert.equal(String(url),version.files[0].url);return new Response(bytes);};
  const response=await worker.fetch(new Request('https://dmc.test/api/mods?source=modrinth&action=download&id=project1&file=version1&filename=test.jar'));
  assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/test.jar/);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
  const wrong=await worker.fetch(new Request('https://dmc.test/api/mods?source=modrinth&action=download&id=wrong&file=version1&filename=test.jar'));assert.equal(wrong.status,400);
  version.files[0].url='https://localhost/private';
  const unsafe=await worker.fetch(new Request('https://dmc.test/api/mods?source=modrinth&action=download&id=project1&file=version1&filename=test.jar'));assert.equal(unsafe.status,502);
 }finally{globalThis.fetch=original;}
});
test('Java Huawei source discovers a real directory and matches macOS ARM64 packages',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async url=>String(url)==='https://mirrors.huaweicloud.com/openjdk/'?new Response('<a href="21.0.1/">old</a><a href="21.0.2/">new</a>'):new Response('<a href="openjdk-21.0.2_macos-aarch64_bin.tar.gz">mac</a><a href="openjdk-21.0.2_windows-x64_bin.zip">windows</a>');
  const response=await worker.fetch(new Request('https://dmc.test/api/java?source=huawei&version=21&os=mac&arch=aarch64&kind=jdk'));
  assert.equal(response.status,200);const files=await response.json();assert.equal(files.length,1);assert.equal(files[0].url,'https://mirrors.huaweicloud.com/openjdk/21.0.2/openjdk-21.0.2_macos-aarch64_bin.tar.gz');
 }finally{globalThis.fetch=original;}
});
test('mod search retains authentic icons, galleries and purpose categories',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({hits:[{project_id:'abc',slug:'test',title:'Test',description:'Optimizes the renderer',downloads:5,icon_url:'https://cdn.modrinth.com/data/abc/icon.png',featured_gallery:'https://cdn.modrinth.com/data/abc/featured.webp',gallery:['https://cdn.modrinth.com/data/abc/second.webp','https://evil.example/invalid.png'],categories:['optimization']}],total_hits:1});
  const r=await worker.fetch(new Request('https://dmc.test/api/mods?source=modrinth&action=search'));
  const p=(await r.json()).projects[0];assert.match(p.icon,/icon.png$/);assert.equal(p.gallery.length,2);assert.match(p.gallery[0].url,/featured.webp$/);assert.equal(p.categories[0],'optimization');
 }finally{globalThis.fetch=original;}
});
test('project overview returns full images and captions without blocking version routes',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async url=>{assert.equal(String(url),'https://api.modrinth.com/v2/project/abc');return Response.json({id:'abc',slug:'test',title:'Test',description:'Renderer improvement',body:'# About\nImproves frame rate.',downloads:5,icon_url:'https://cdn.modrinth.com/data/abc/icon.png',gallery:[{url:'https://cdn.modrinth.com/data/abc/thumb.webp',raw_url:'https://cdn.modrinth.com/data/abc/full.png',title:'Before and after',description:'Lighting comparison',featured:true}],categories:['optimization']});};
  const r=await worker.fetch(new Request('https://dmc.test/api/mods?source=modrinth&action=project&id=abc'));assert.equal(r.status,200);const p=(await r.json()).project;assert.match(p.gallery[0].url,/full.png$/);assert.match(p.gallery[0].thumbnail,/thumb.webp$/);assert.equal(p.gallery[0].description,'Lighting comparison');assert.match(p.about,/Improves frame rate/);
 }finally{globalThis.fetch=original;}
});
test('CurseForge project metadata includes logo and screenshot thumbnails',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({data:{id:42,name:'Example',slug:'example',summary:'Adds machines',downloadCount:1,links:{},logo:{thumbnailUrl:'https://media.forgecdn.net/avatars/icon.png'},screenshots:[{url:'https://media.forgecdn.net/attachments/full.png',thumbnailUrl:'https://media.forgecdn.net/attachments/thumb.png',title:'Factory'}],categories:[{name:'Technology'}]}});
  const r=await worker.fetch(new Request('https://dmc.test/api/mods?source=curseforge&action=project&id=42'),{CURSEFORGE_API_KEY:'test-secret'});const p=(await r.json()).project;assert.match(p.icon,/icon.png$/);assert.equal(p.gallery[0].title,'Factory');assert.match(p.gallery[0].thumbnail,/thumb.png$/);
 }finally{globalThis.fetch=original;}
});
test('MC encyclopedia 403 stays explicit instead of a generic gateway error',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('Forbidden',{status:403});
  for(const action of ['search','project','links']){
   const r=await worker.fetch(new Request('https://dmc.test/api/mods?'+new URLSearchParams({source:'mcmod',action,id:'2785',q:'钠'})));
   assert.equal(r.status,403);const body=await r.json();assert.equal(body.upstreamStatus,403);assert.match(body.error,/浏览器/);assert.match(body.error,/Modrinth/);
  }
 }finally{globalThis.fetch=original;}
});
