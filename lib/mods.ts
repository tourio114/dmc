import { SourceError, sourceJSON, sourceText, textOnly } from './upstream';
export type ModSource = 'modrinth' | 'curseforge' | 'mcmod';
export type ModImage = { url: string; thumbnail?: string; title?: string; description?: string };
export type ModProject = { id: string; source: ModSource; title: string; description: string; url: string; downloads?: number; icon?: string; gallery?: ModImage[]; categories?: string[]; about?: string };
export type ModFile = { id: string; project: string; source: 'modrinth' | 'curseforge'; name: string; filename: string; url: string | null; size: number; hash?: string; hashType?: 'SHA-1' | 'SHA-512'; date: string; gameVersions: string[]; loaders: string[]; dependencies: string[]; page: string };
export type ModEnv = { CURSEFORGE_API_KEY?: string };
const MR = 'https://api.modrinth.com/v2';
const CF = 'https://api.curseforge.com/v1';
const loaders: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
export function modOptions(p: URLSearchParams) {
  const source = p.get('source') || 'modrinth', action = p.get('action') || 'search', query = (p.get('q') || '').trim(), game = p.get('game') || '', loader = p.get('loader') || '', id = p.get('id') || '', file = p.get('file') || '', offset = Number(p.get('offset') || '0');
  if (!['modrinth','curseforge','mcmod'].includes(source) || !['search','versions','links','download','project'].includes(action) || query.length > 100 || !/^[\w.+-]{0,60}$/.test(game) || (loader && !(loader in loaders)) || !/^[\w-]{0,100}$/.test(id) || !/^[\w-]{0,100}$/.test(file) || !Number.isSafeInteger(offset) || offset < 0 || offset > 9800) throw new SourceError('模组查询参数无效', 400);
  if (['versions','links','download','project'].includes(action) && !id) throw new SourceError('缺少模组 ID',400);
  return { source: source as ModSource, action, query, game, loader, id, file, offset };
}
function cfHeaders(env: ModEnv) { if (!env.CURSEFORGE_API_KEY) throw new SourceError('CurseForge 尚未配置 API 密钥。站长在 Worker 设置中添加 CURSEFORGE_API_KEY 后即可启用搜索与批量下载；也可先使用 Modrinth。', 503); return { 'x-api-key': env.CURSEFORGE_API_KEY }; }
function cfParams(game: string, loader: string) { const p = new URLSearchParams({ pageSize:'20' }); if(game)p.set('gameVersion',game); if(loader)p.set('modLoaderType',String(loaders[loader])); return p; }
export function mcmodSearch(html: string): ModProject[] {
  return html.split('<div class="result-item">').slice(1).flatMap(block => {
    const link = block.match(/href="https:\/\/www\.mcmod\.cn\/class\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) return [];
    const description = block.match(/<div class="body">([\s\S]*?)<\/div>/)?.[1] || '';
    return [{ id:link[1],source:'mcmod',title:textOnly(link[2]),description:textOnly(description).slice(0,350),url:`https://www.mcmod.cn/class/${link[1]}.html` }];
  });
}
export function mcmodLinks(html: string): ModProject[] {
  const found: ModProject[] = [];
  for (const match of html.matchAll(/href="(?:https?:)?\/\/link\.mcmod\.cn\/target\/([A-Za-z0-9+/=]+)"/g)) {
    try {
      const url = new URL(atob(match[1])); if(url.protocol !== 'https:')continue;
      const mr = url.hostname === 'modrinth.com' && url.pathname.match(/^\/mod\/([\w-]+)\/?$/);
      const cf = ['www.curseforge.com','curseforge.com'].includes(url.hostname) && url.pathname.match(/^\/minecraft\/mc-mods\/([\w-]+)\/?$/);
      if (mr || cf) { const source = mr ? 'modrinth' : 'curseforge'; const id = (mr || cf as RegExpMatchArray)[1]; if(!found.some(p => p.source===source && p.id===id))found.push({ id,source,title:mr?'Modrinth 下载':'CurseForge 下载',description:'MC 百科条目收录的公开模组主页',url:url.href }); }
    } catch { /* Ignore malformed or unsupported external links. */ }
  }
  return found;
}
type MRVersion = { id:string; project_id:string; name:string; date_published:string; game_versions:string[]; loaders:string[]; files:{filename:string;url:string;size:number;primary:boolean;hashes:{sha1?:string;sha512?:string}}[];dependencies:{dependency_type:string;project_id?:string;version_id?:string}[] };
type CFProject = { id:number;name:string;summary:string;slug:string;downloadCount:number;links:{websiteUrl:string};logo?:{thumbnailUrl?:string;url?:string};screenshots?:{url:string;thumbnailUrl?:string;title?:string;description?:string}[];categories?:{name:string}[] };
type CFFile = { id:number;modId:number;displayName:string;fileName:string;downloadUrl:string|null;fileLength:number;fileDate:string;gameVersions:string[];hashes:{algo:number;value:string}[];dependencies:{modId:number;relationType:number}[];isAvailable:boolean };
// Only provider-hosted HTTPS images are exposed; no general image proxy.
export function modImageURL(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value.startsWith('//') ? 'https:' + value : value);
    if(u.protocol !== 'https:' || u.username || u.password || u.port || !['cdn.modrinth.com','media.forgecdn.net','mediafilez.forgecdn.net','edge.forgecdn.net','i.mcmod.cn','www.mcmod.cn'].includes(u.hostname)) return undefined;
    return u.href;
  } catch { return undefined; }
}
function galleryImages(images: {url?:string;thumbnail?:string;title?:string|null;description?:string|null}[] = []): ModImage[] {
  const seen = new Set<string>();
  return images.flatMap(image => { const url=modImageURL(image.url); if(!url || seen.has(url))return [];seen.add(url);return [{url,thumbnail:modImageURL(image.thumbnail),title:image.title?.slice(0,150),description:image.description?.slice(0,500)}]; }).slice(0,12);
}
function cfProject(m:CFProject):ModProject { return {id:String(m.id),source:'curseforge',title:m.name,description:m.summary,url:`https://www.curseforge.com/minecraft/mc-mods/${encodeURIComponent(m.slug)}`,downloads:m.downloadCount,icon:modImageURL(m.logo?.thumbnailUrl||m.logo?.url),gallery:galleryImages(m.screenshots?.map(i=>({...i,thumbnail:i.thumbnailUrl}))),categories:m.categories?.map(c=>c.name).slice(0,8)}; }
export function readableAbout(html: string): string {
  return textOnly(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|div|h[1-6])>|<br\b[^>]*>/gi,'\n')).replace(/\n{3,}/g,'\n\n').slice(0,6000);
}
function markdownAbout(body = '') { return readableAbout(body.replace(/```[\s\S]*?```/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/^#{1,6}\s+/gm,'').replace(/\*\*|__/g,'')); }
export function mcmodProject(html: string, id: string): ModProject {
  const title=html.match(/<div class="class-title">[\s\S]*?<h3>([\s\S]*?)<\/h3>/)?.[1] || 'MC 百科模组';
  const introStart=/<li\b[^>]*class="[^"]*\btext-area\b[^"]*\bcommon-text\b[^"]*"[^>]*>/g.exec(html);
  let intro='';
  if(introStart) {
    const body=html.slice(introStart.index+introStart[0].length);let depth=1;
    for(const tag of body.matchAll(/<\/?li\b[^>]*>/gi)) { depth+=tag[0].startsWith('</')?-1:1; if(depth===0){intro=body.slice(0,tag.index);break;} }
  }
  const cover=modImageURL(html.match(/<div class="class-cover-image">[\s\S]*?<img\b[^>]*\bsrc="([^"]+)"/)?.[1]);
  const images=[...intro.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m=>({url:m[1],title:'模组介绍图片'}));
  const gallery=galleryImages([...(cover?[{url:cover,title:'模组封面'}]:[]),...images]);
  const about=readableAbout(intro);
  return {id,source:'mcmod',title:textOnly(title),description:about.split('\n').filter(Boolean).slice(0,3).join(' ').slice(0,350),about,url:`https://www.mcmod.cn/class/${id}.html`,icon:cover,gallery};
}
async function mcmodText(url: string) {
  try { return await sourceText(url); } catch(e) {
    if(e instanceof SourceError && e.upstreamStatus===403)throw new SourceError('MC 百科拒绝了当前服务器访问（403）。可以在浏览器中直接打开百科，或改用 Modrinth / CurseForge 查看图片与下载。',403,403);
    throw e;
  }
}
export function trustedModURL(value: string, source: 'modrinth'|'curseforge'): string {
  const u = new URL(value);
  const allowed = source === 'modrinth' ? ['cdn.modrinth.com'] : ['edge.forgecdn.net','mediafilez.forgecdn.net','media.forgecdn.net'];
  if(u.protocol !== 'https:' || u.username || u.password || u.port || !allowed.includes(u.hostname))throw new SourceError('下载源返回了不支持的文件地址');
  return u.href;
}
function mrFiles(v: MRVersion): ModFile[] { return v.files.filter(f=>f.filename.endsWith('.jar')).map(f=>({id:v.id,project:v.project_id,source:'modrinth',name:v.name,filename:f.filename,url:trustedModURL(f.url,'modrinth'),size:f.size,hash:f.hashes.sha512||f.hashes.sha1,hashType:f.hashes.sha512?'SHA-512':'SHA-1',date:v.date_published,gameVersions:v.game_versions,loaders:v.loaders,dependencies:v.dependencies.filter(d=>d.dependency_type==='required').map(d=>d.project_id||d.version_id||'外部前置模组'),page:`https://modrinth.com/mod/${v.project_id}/version/${v.id}`})); }
function cfFile(f: CFFile): ModFile { const hash=f.hashes.find(h=>h.algo===1)?.value;return {id:String(f.id),project:String(f.modId),source:'curseforge',name:f.displayName,filename:f.fileName,url:f.downloadUrl?trustedModURL(f.downloadUrl,'curseforge'):null,size:f.fileLength,hash,hashType:'SHA-1',date:f.fileDate,gameVersions:f.gameVersions.filter(v=>/^\d/.test(v)),loaders:f.gameVersions.filter(v=>Object.keys(loaders).includes(v.toLowerCase())),dependencies:f.dependencies.filter(d=>d.relationType===3).map(d=>String(d.modId)),page:`https://www.curseforge.com/minecraft/mc-mods/${f.modId}/files/${f.id}`}; }
async function cfID(id: string, env: ModEnv) { if(/^\d+$/.test(id))return id;const r=await sourceJSON<{data:CFProject[]}>(`${CF}/mods/search?gameId=432&classId=6&slug=${encodeURIComponent(id)}`,cfHeaders(env));if(!r.data[0])throw new SourceError('CurseForge 未找到此模组',404);return String(r.data[0].id); }
export async function modsCatalogue(p: URLSearchParams, env: ModEnv) {
  const o = modOptions(p);
  if(o.source==='mcmod') {
    if(o.action==='search') { if(!o.query) return { projects:[],hasMore:false }; const html=await mcmodText(`https://search.mcmod.cn/s?${new URLSearchParams({key:o.query,filter:'1',page:String(Math.floor(o.offset/20)+1)})}`);return {projects:mcmodSearch(html),hasMore:/下一页/.test(html)}; }
    if(o.action==='links' && /^\d+$/.test(o.id))return { projects:mcmodLinks(await mcmodText(`https://www.mcmod.cn/class/${o.id}.html`)),hasMore:false };
    if(o.action==='project' && /^\d+$/.test(o.id)){const html=await mcmodText(`https://www.mcmod.cn/class/${o.id}.html`);return {project:mcmodProject(html,o.id),projects:mcmodLinks(html)};}
    throw new SourceError('MC 百科提供中文检索及公开来源导航，请选择条目中的下载平台。',400);
  }
  if(o.action==='project') {
    if(o.source==='modrinth') {
      const m=await sourceJSON<{id:string;slug:string;title:string;description:string;body?:string;downloads:number;icon_url?:string;gallery?:{url:string;raw_url?:string;title?:string;description?:string;featured?:boolean;ordering?:number}[];categories?:string[]}>(`${MR}/project/${encodeURIComponent(o.id)}`);
      return {project:{id:m.id,source:'modrinth',title:m.title,description:m.description,about:markdownAbout(m.body),url:`https://modrinth.com/mod/${m.slug}`,downloads:m.downloads,icon:modImageURL(m.icon_url),gallery:galleryImages([...(m.gallery||[])].map(i=>({...i,url:i.raw_url||i.url,thumbnail:i.url})).sort((a,b)=>Number(!!b.featured)-Number(!!a.featured)||(a.ordering||0)-(b.ordering||0))),categories:m.categories?.slice(0,8)}};
    }
    const id=await cfID(o.id,env);
    const data=await sourceJSON<{data:CFProject}>(`${CF}/mods/${id}`,cfHeaders(env));
    return {project:cfProject(data.data)};
  }
  if(o.action==='search') {
    if(o.source==='modrinth') {
      const facets=[['project_type:mod']];if(o.game)facets.push([`versions:${o.game}`]);if(o.loader)facets.push([`categories:${o.loader}`]);
      const data=await sourceJSON<{hits:{project_id:string;slug:string;title:string;description:string;downloads:number;icon_url?:string;featured_gallery?:string;gallery?:string[];categories?:string[]}[];total_hits:number}>(`${MR}/search?${new URLSearchParams({query:o.query,facets:JSON.stringify(facets),limit:'20',offset:String(o.offset),index:'downloads'})}`);
      return {projects:data.hits.map(m=>({id:m.project_id,source:'modrinth',title:m.title,description:m.description,url:`https://modrinth.com/mod/${m.slug}`,downloads:m.downloads,icon:modImageURL(m.icon_url),gallery:galleryImages([...(m.featured_gallery?[{url:m.featured_gallery}]:[]),...(m.gallery||[]).map(url=>({url}))]).slice(0,3),categories:m.categories?.slice(0,8)})),hasMore:o.offset+20<data.total_hits};
    }
    const p=cfParams(o.game,o.loader);p.set('gameId','432');p.set('classId','6');p.set('searchFilter',o.query);p.set('index',String(o.offset));p.set('sortField','6');p.set('sortOrder','desc');
    const data=await sourceJSON<{data:CFProject[];pagination:{totalCount:number}}>(`${CF}/mods/search?${p}`,cfHeaders(env));return {projects:data.data.map(cfProject),hasMore:o.offset+20<data.pagination.totalCount};
  }
  if(o.action==='versions') {
    if(!o.game || !o.loader)throw new SourceError('请选择游戏版本和加载器，再查看匹配文件。',400);
    if(o.source==='modrinth') {const p=new URLSearchParams({game_versions:JSON.stringify([o.game]),loaders:JSON.stringify([o.loader]),include_changelog:'false'}); const list=await sourceJSON<MRVersion[]>(`${MR}/project/${encodeURIComponent(o.id)}/version?${p}`);return {files:list.sort((a,b)=>b.date_published.localeCompare(a.date_published)).slice(0,40).flatMap(mrFiles)}; }
    const id=await cfID(o.id,env);const data=await sourceJSON<{data:CFFile[]}>(`${CF}/mods/${id}/files?${cfParams(o.game,o.loader)}`,cfHeaders(env));return {files:data.data.filter(f=>f.isAvailable && f.fileName.endsWith('.jar')).sort((a,b)=>b.fileDate.localeCompare(a.fileDate)).map(cfFile)};
  }
  throw new SourceError('请求操作无效',400);
}
export async function resolveModFile(p: URLSearchParams, env: ModEnv): Promise<ModFile> {
  const o=modOptions(p);if(o.action!=='download' || !o.file || o.source==='mcmod')throw new SourceError('下载参数无效',400);
  if(o.source==='modrinth') { const v=await sourceJSON<MRVersion>(`${MR}/version/${encodeURIComponent(o.file)}`);if(v.project_id!==o.id)throw new SourceError('模组与文件不匹配',400);const name=p.get('filename');const file=mrFiles(v).find(f=>f.filename===name);if(!file)throw new SourceError('文件不存在',404);return file; }
  if(!/^\d+$/.test(o.id)||!/^\d+$/.test(o.file))throw new SourceError('CurseForge 文件 ID 无效',400);
  const data=await sourceJSON<{data:CFFile}>(`${CF}/mods/${o.id}/files/${o.file}`,cfHeaders(env));if(String(data.data.modId)!==o.id||!data.data.isAvailable)throw new SourceError('文件不可用',404);return cfFile(data.data);
}
