import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const source = ts.transpileModule(readFileSync(new URL('../lib/downloads.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { catalogTarget, mirrorURL, BMCL } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const target = params => catalogTarget(new URLSearchParams(params));
test('Mojang metadata and binary URLs and Fabric Maven files map to BMCLAPI', () => {
  assert.equal(mirrorURL('https://piston-data.mojang.com/v1/objects/abc/client.jar'), BMCL + '/v1/objects/abc/client.jar');
  assert.equal(mirrorURL('https://piston-meta.mojang.com/v1/packages/abc/1.21.json'), BMCL + '/v1/packages/abc/1.21.json');
  assert.equal(mirrorURL('https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.0/a.jar'), BMCL + '/maven/net/fabricmc/fabric-installer/1.0.0/a.jar');
  assert.throws(() => mirrorURL('https://evil.example/file.jar'));
  assert.throws(() => mirrorURL('http://piston-data.mojang.com/client.jar'));
});
test('catalogue proxy rejects arbitrary targets, traversal, invalid Java input and unknown kinds', () => {
  for (const params of [ {type:'version',path:'https://localhost/secret'}, {type:'version',path:'/v1/packages/../secret.json'}, {type:'forge',version:'../../foo'}, {type:'java',version:'21',os:'../../etc'}, {type:'java',version:'21',arch:'x86'}, {type:'anything'} ]) assert.throws(() => target(params));
});
test('valid catalogues generate only fixed upstream hosts and supported JSON paths', () => {
  assert.equal(target({type:'forge', version:'1.21.1'}), BMCL + '/forge/minecraft/1.21.1');
  const path = '/v1/packages/' + 'a'.repeat(40) + '/26.3.json';
  assert.equal(target({type:'version',path}), BMCL + path);
  assert.equal(new URL(target({type:'java',version:'21',os:'mac',arch:'aarch64'})).hostname, 'api.adoptium.net');
});
