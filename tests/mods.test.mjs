import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result=await build({entryPoints:['lib/mods.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
const {modOptions,mcmodSearch,mcmodLinks,trustedModURL,modImageURL,mcmodProject}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
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

test('provider images allow only approved HTTPS hosts',()=>{
 assert.equal(modImageURL('//i.mcmod.cn/class/cover/a.jpg'),'https://i.mcmod.cn/class/cover/a.jpg');
 assert.equal(modImageURL('https://cdn.modrinth.com/data/a/icon.webp'),'https://cdn.modrinth.com/data/a/icon.webp');
 for(const value of ['http://cdn.modrinth.com/a.jpg','https://cdn.modrinth.com.evil.example/a.png','https://localhost/image','data:image/svg+xml,test','https://user@i.mcmod.cn/a.jpg','https://i.mcmod.cn:8443/a.jpg'])assert.equal(modImageURL(value),undefined);
});
test('MC encyclopedia overview extracts its real cover and readable purpose',()=>{
 const html='<div class="class-cover-image"><img src="//i.mcmod.cn/class/cover/sodium.jpg"/></div><div class="class-title"><h3>钠</h3></div><li class="text-area">无关的依赖列表</li><li class="text-area common-text font14"><p>渲染优化模组。</p><p>提高帧率。</p><ul><li>嵌套条目</li></ul><script>doNotRender()</script><img src="https://i.mcmod.cn/editor/example.jpg"/></li>';
 const p=mcmodProject(html,'2785');
 assert.equal(p.icon,'https://i.mcmod.cn/class/cover/sodium.jpg');assert.equal(p.title,'钠');assert.equal(p.gallery.length,2);assert.match(p.about,/提高帧率/);assert(!p.about.includes('doNotRender'));assert(!p.about.includes('无关的依赖列表'));assert.match(p.about,/嵌套条目/);
});
