import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const r=await build({entryPoints:['lib/java.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
const {tunaFiles,javaOptions}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
test('Java directory parser accepts actual installers and archives, not injected links',()=>{
 const base='https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jre/x64/windows/';
 const files=tunaFiles('<a href="OpenJDK21U-jre_x64_windows_hotspot_21.0.13_9.zip">ZIP</a><a href="OpenJDK21U-jre_x64_windows_hotspot_21.0.13_9.msi">MSI</a><a href="../../secret.zip">bad</a><a href="https://evil.example/OpenJDK21.zip">bad</a>',base);
 assert.equal(files.length,2);assert(files.every(f=>f.url.startsWith(base)));assert(files.every(f=>f.detail.includes('国内镜像')));
});
test('Java source and package validation restricts upstream destinations',()=>{
 assert.equal(javaOptions(new URLSearchParams()).source,'tuna');assert.equal(javaOptions(new URLSearchParams()).kind,'jre');
 for(const p of [{source:'https://evil.example'},{kind:'../../etc'},{arch:'x86'},{version:'999'}])assert.throws(()=>javaOptions(new URLSearchParams(p)));
});
