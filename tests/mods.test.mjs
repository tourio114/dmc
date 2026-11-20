import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result=await build({entryPoints:['lib/mods.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
const {modOptions,mcmodSearch,mcmodLinks,trustedModURL}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('mod requests reject unsupported sources, IDs, pagination, loaders and oversized search',()=>{
 for(const p of [{source:'evil'},{action:'download',id:'../../foo',file:'a'},{source:'modrinth',loader:'unsupported'},{offset:'NaN'},{offset:'-1'},{q:'x'.repeat(101)},{action:'download'}])assert.throws(()=>modOptions(new URLSearchParams(p)));
});
test('MC encyclopedia parsing exposes text and only public Modrinth / CurseForge mod links',()=>{
 const projects=mcmodSearch('<div class="result-item"><div class="head"><a href="https://www.mcmod.cn/class/2785.html">钠 (<em>Sodium</em>)</a></div><div class="body">性能 &amp; 渲染</div></div>');
 assert.equal(projects[0].title,'钠 (Sodium)');assert.equal(projects[0].description,'性能 & 渲染');
 const urls=['https://modrinth.com/mod/sodium','https://www.curseforge.com/minecraft/mc-mods/sodium','https://evil.example/mod/secret','http://modrinth.com/mod/not-https','https://modrinth.com/resourcepack/foo'];
 const links=mcmodLinks(urls.map(u=>`<a href="//link.mcmod.cn/target/${btoa(u)}">link</a>`).join(''));
 assert.deepEqual(links.map(p=>p.source),['modrinth','curseforge']);assert.equal(links[0].id,'sodium');
});
test('file download host validation rejects arbitrary URLs and credentials',()=>{
 assert.equal(trustedModURL('https://cdn.modrinth.com/data/a/versions/b/a.jar','modrinth'),'https://cdn.modrinth.com/data/a/versions/b/a.jar');
 for(const u of ['https://localhost/a.jar','https://cdn.modrinth.com.evil.example/a.jar','https://user@cdn.modrinth.com/a.jar','http://cdn.modrinth.com/a.jar','https://cdn.modrinth.com:8443/a.jar'])assert.throws(()=>trustedModURL(u,'modrinth'));
});
