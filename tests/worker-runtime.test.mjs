import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
const jar=new Uint8Array([80,75,3,4,1,2,3,4]);
const filename="示例模组 (1)'s.jar";
const mrVersion={id:'v1',project_id:'p1',name:'Example',date_published:'2026-01-01',game_versions:['1.21.1'],loaders:['fabric'],files:[{filename,url:'https://cdn.modrinth.com/start.jar',size:jar.length,hashes:{}}],dependencies:[]};
const cfFile={id:10,modId:20,displayName:'Example',fileName:'example.jar',downloadUrl:'https://edge.forgecdn.net/start.jar',fileLength:jar.length,fileDate:'2026-01-01',gameVersions:['1.21.1','Fabric'],hashes:[],dependencies:[],isAvailable:true};
const forge='forge-1.21.1-52.0.1-installer.jar';
test('downloads execute inside workerd: redirects, bytes, names and upstream errors',async t=>{
 let mode='normal';const calls=[];
 const mf=new Miniflare({modules:true,scriptPath:'worker.js',compatibilityDate:'2026-05-22',compatibilityFlags:['enable_request_signal'],bindings:{CURSEFORGE_API_KEY:'test-secret'},outboundService:async request=>{
  const u=new URL(request.url);calls.push(u.href);
  if(u.hostname==='api.modrinth.com')return Response.json(mrVersion);
  if(u.hostname==='api.curseforge.com'){assert.equal(request.headers.get('x-api-key'),'test-secret');return Response.json({data:cfFile});}
  if(u.hostname==='bmclapi2.bangbang93.com'&&u.pathname.startsWith('/forge/minecraft/'))return Response.json([{version:'52.0.1',mcversion:'1.21.1',files:[{category:'installer',format:'jar'}]}]);
  assert.equal(request.headers.get('x-api-key'),null,'API credentials must never be forwarded to file servers');
  if(mode==='mirror-down'&&u.hostname==='bmclapi2.bangbang93.com')return new Response('Unavailable',{status:503});
  if(mode==='bad-body')return new Response('<html>Access denied</html>',{headers:{'Content-Type':'text/html'}});
  if(mode==='unsafe')return new Response(null,{status:302,headers:{Location:'https://localhost/private'}});
  if(u.hostname==='cdn.modrinth.com'&&u.pathname==='/start.jar')return new Response(null,{status:302,headers:{Location:'/final.jar'}});
  if(u.hostname==='edge.forgecdn.net')return new Response(null,{status:302,headers:{Location:'https://mediafilez.forgecdn.net/final.jar'}});
  if(u.hostname==='bmclapi2.bangbang93.com')return new Response(null,{status:302,headers:{Location:'https://mirrors.cernet.edu.cn/bmclapi/'+forge}});
  if(u.hostname==='mirrors.cernet.edu.cn')return new Response(null,{status:302,headers:{Location:'https://mirror.nju.edu.cn/bmclapi/'+forge}});
  // Split the magic bytes across chunks; the relay must preserve every byte.
  return new Response(new ReadableStream({start(c){c.enqueue(jar.slice(0,1));c.enqueue(jar.slice(1,3));c.enqueue(jar.slice(3));c.close();}}),{headers:{'Content-Type':'application/java-archive'}});
 }});
 const mr='https://dmc.test/api/mods?'+new URLSearchParams({source:'modrinth',action:'download',id:'p1',file:'v1',filename});
 try{
  await t.test('Modrinth redirect and Chinese filename survive the Worker runtime',async()=>{const r=await mf.dispatchFetch(mr);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.match(r.headers.get('content-disposition'),/filename=".*\.jar";/);assert.match(r.headers.get('content-disposition'),/filename\*=UTF-8''%E7%A4%BA/);assert.match(r.headers.get('content-disposition'),/%27s.jar/);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),jar);});
  await t.test('CurseForge edge redirect reaches mediafilez and returns a JAR',async()=>{const r=await mf.dispatchFetch('https://dmc.test/api/mods?source=curseforge&action=download&id=20&file=10');assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/filename="example.jar"/);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),jar);assert(calls.includes('https://mediafilez.forgecdn.net/final.jar'));});
  await t.test('Forge installer keeps its full .jar name through the mirror chain',async()=>{const r=await mf.dispatchFetch('https://dmc.test/api/forge-download?mcversion=1.21.1&version=52.0.1');assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/filename="forge-1.21.1-52.0.1-installer.jar"/);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),jar);assert(calls.some(url=>url.startsWith('https://mirror.nju.edu.cn/')));});
  await t.test('Forge falls back to official Maven when its mirror fails',async()=>{mode='mirror-down';const r=await mf.dispatchFetch('https://dmc.test/api/forge-download?mcversion=1.21.1&version=52.0.1');assert.equal(r.status,200);assert.equal(r.headers.get('x-dmc-download-source'),'Forge Maven');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),jar);mode='normal';});
  await t.test('Error HTML is returned as an error, never a fake JAR attachment',async()=>{mode='bad-body';const r=await mf.dispatchFetch(mr);assert.equal(r.status,502);assert.equal(r.headers.get('content-disposition'),null);assert.match((await r.json()).error,/不是 JAR/);});
  await t.test('Unapproved redirect is refused before the target receives a request',async()=>{mode='unsafe';const r=await mf.dispatchFetch(mr);assert.equal(r.status,502);assert(!calls.some(u=>u.includes('localhost')));});
  await t.test('Invalid Forge paths are rejected without an upstream request',async()=>{const count=calls.length;const r=await mf.dispatchFetch('https://dmc.test/api/forge-download?mcversion=../../etc&version=52.0.1');assert.equal(r.status,400);assert.equal(calls.length,count);});
 }finally{await mf.dispose();}
});
