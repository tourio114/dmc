'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Search, ExternalLink, X, Plus, Check, ArrowLeft, Package, Square } from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import type { ModFile, ModProject, ModSource } from '../lib/mods';
import { ModPicture, ModTags, ModOverview } from './mod-media';
import JarDownload from './jar-download';

type QueueItem = { file: ModFile; title: string; game: string; loader: string; checked: boolean; status: string };
const sourceNames = { modrinth: 'Modrinth', curseforge: 'CurseForge', mcmod: 'MC 百科' };
const limit = 200 * 1024 * 1024;
const formatSize = (n: number) => n ? `${(n / 1024 / 1024).toFixed(1)} MiB` : '大小未知';
async function query<T>(params: Record<string,string>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/mods?' + new URLSearchParams(params), { signal });
  const data = await response.json() as T & {error?:string};
  if (!response.ok) throw new Error(data.error || '模组来源连接失败');
  return data;
}
const key = (f: ModFile) => `${f.source}:${f.project}:${f.id}:${f.filename}`;
const fileURL = (f: ModFile) => '/api/mods?' + new URLSearchParams({ action:'download',source:f.source,id:f.project,file:f.id,filename:f.filename });
const safeName = (name: string) => name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0,180) || 'mod.jar';
function save(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),60000); }
export default function ModsPanel({ games }: {games:string[]}) {
  const [source,setSource]=useState<ModSource>('modrinth'),[search,setSearch]=useState(''),[game,setGame]=useState('1.21.1'),[loader,setLoader]=useState('fabric');
  const [projects,setProjects]=useState<ModProject[]>([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [project,setProject]=useState<ModProject>(),[files,setFiles]=useState<ModFile[]>([]),[links,setLinks]=useState<ModProject[]>([]),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState('');
  const [info,setInfo]=useState<ModProject>(),[infoLoading,setInfoLoading]=useState(false),[infoError,setInfoError]=useState('');
  const [queue,setQueue]=useState<QueueItem[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const controller=useRef<AbortController|null>(null),detailController=useRef<AbortController|null>(null);
  const queueRef=useRef<QueueItem[]>([]);
  const updateQueue=(fn:(prev:QueueItem[])=>QueueItem[])=>setQueue(prev=>{const next=fn(prev);queueRef.current=next;return next;});
  useEffect(()=>()=>{controller.current?.abort();detailController.current?.abort();},[]);
  useEffect(()=>{
    const c=new AbortController();setLoading(true);setError('');setProjects([]);setProject(undefined);setFiles([]);setLinks([]);detailController.current?.abort();
    const timer=setTimeout(()=>{query<{projects:ModProject[];hasMore:boolean}>({source,action:'search',q:search,game,loader,offset:String(offset)},c.signal).then(data=>{setProjects(data.projects);setHasMore(data.hasMore);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},350);
    return()=>{clearTimeout(timer);c.abort();};
  },[source,search,game,loader,offset,refresh]);
  const openProject=async(p:ModProject)=>{
    detailController.current?.abort();const c=new AbortController();detailController.current=c;setProject(p);setInfo(p);setFiles([]);setLinks([]);setDetailError('');setDetailLoading(true);setInfoLoading(true);setInfoError('');
    const infoTask=query<{project:ModProject;projects?:ModProject[]}>({source:p.source,action:'project',id:p.id},c.signal).then(data=>{
      if(c.signal.aborted)return;
      setInfo({...p,...data.project});
      if(p.source==='mcmod')setLinks(data.projects||[]);
    }).catch(e=>{if(!c.signal.aborted){if(p.source==='mcmod')setDetailError(e.message);else setInfoError(e.message);}}).finally(()=>{if(!c.signal.aborted){setInfoLoading(false);if(p.source==='mcmod')setDetailLoading(false);}});
    if(p.source==='mcmod'){await infoTask;return;}
    const fileTask=query<{files:ModFile[]}>({source:p.source,action:'versions',id:p.id,game,loader},c.signal).then(data=>{if(!c.signal.aborted)setFiles(data.files);}).catch(e=>{if(!c.signal.aborted)setDetailError(e.message);}).finally(()=>{if(!c.signal.aborted)setDetailLoading(false);});
    await Promise.all([infoTask,fileTask]);
  };
  const add=(file:ModFile)=>{
    if(busy)return;
    if(queueRef.current.some(q=>q.game!==game||q.loader!==loader)){setMessage('队列中的游戏版本或加载器不同，请先清空队列再添加。');return;}
    if(!file.url){setMessage('作者未开放此文件的第三方下载，请前往原站。');return;}
    if(file.size>64*1024*1024){setMessage('此文件超过单文件 64 MiB 上限，请使用原站下载。');return;}
    const otherProjects=queueRef.current.filter(q=>!(q.file.source===file.source&&q.file.project===file.project));
    if(otherProjects.length>=30){setMessage('每批最多 30 个模组，请先下载当前队列。');return;}
    updateQueue(prev=>[...prev.filter(q=>!(q.file.source===file.source&&q.file.project===file.project)),{file,title:project?.title||file.name,game,loader,checked:true,status:'待下载'}]);setMessage('已加入下载队列；同一来源的同一模组只保留一个版本。');
  };
  const batch=async()=>{
    const chosen=queueRef.current.filter(q=>q.checked);if(!chosen.length)return;
    if(chosen.reduce((sum,q)=>sum+q.file.size,0)>limit){setMessage('本批超过 200 MiB，请减少勾选数量。');return;}
    const c=new AbortController();controller.current=c;setBusy(true);setMessage('');setProgress('准备下载…');
    const archive:Record<string,Uint8Array>={};const completed:QueueItem[]=[],failed:string[]=[];let total=0;
    const status=(f:ModFile,s:string)=>updateQueue(prev=>prev.map(q=>key(q.file)===key(f)?{...q,status:s}:q));
    try {
      for(let index=0;index<chosen.length;index++){
        c.signal.throwIfAborted();const item=chosen[index];status(item.file,'下载中');setProgress(`${index+1} / ${chosen.length} · ${item.title}`);
        try{
          const r=await fetch(fileURL(item.file),{signal:c.signal});if(!r.ok){const e=await r.json() as {error?:string};throw new Error(e.error||`下载失败 ${r.status}`);}
          const reader=r.body?.getReader();if(!reader)throw new Error('文件响应为空');const chunks:Uint8Array[]=[];let length=0;
          try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>64*1024*1024||total+length>limit)throw new Error('达到文件或批量大小上限，请分批下载');chunks.push(value);setProgress(`${index+1} / ${chosen.length} · ${item.title} · ${formatSize(length)}`);}}catch(e){await reader.cancel();throw e;}
          const bytes=new Uint8Array(length);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
          if(item.file.hash&&item.file.hashType){const digest=await crypto.subtle.digest(item.file.hashType,bytes);const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');if(hex!==item.file.hash.toLowerCase())throw new Error('文件校验失败，请重试');}
          let name='mods/'+safeName(item.file.filename);let suffix=1;while(archive[name])name='mods/'+suffix+++'-'+safeName(item.file.filename);archive[name]=bytes;total+=length;completed.push(item);status(item.file,'已校验，待打包');
        }catch(e){if(c.signal.aborted)throw e;const reason=e instanceof Error?e.message:'下载失败';failed.push(`${item.title}: ${reason}`);status(item.file,reason);}
      }
      c.signal.throwIfAborted();
      if(completed.length){setProgress('正在打包 ZIP…');archive['dmc-manifest.json']=strToU8(JSON.stringify({gameVersion:chosen[0].game,loader:chosen[0].loader,createdAt:new Date().toISOString(),files:completed.map(q=>({source:q.file.source,project:q.file.project,version:q.file.id,filename:q.file.filename,hash:q.file.hash,hashType:q.file.hashType,page:q.file.page,requiredDependencies:q.file.dependencies})),failed},null,2));archive['README.txt']=strToU8('将 mods 文件夹内的 JAR 放入对应游戏版本的 mods 目录。\n游戏版本：'+chosen[0].game+'\n加载器：'+chosen[0].loader+'\n本批仅下载你选择的文件，前置依赖请根据清单与原站说明补齐。\n同一个模组请只保留一个来源与版本。\n');const zip=zipSync(archive,{level:0});save(new Blob([zip.buffer as ArrayBuffer],{type:'application/zip'}),`dmc-mods-${safeName(chosen[0].game)}-${chosen[0].loader}.zip`);for(const q of completed)status(q.file,'已打包');}
      setMessage(failed.length?`已打包 ${completed.length} 个，失败 ${failed.length} 个。可点“只选未完成项”重试；ZIP 清单内附失败原因。`:`已打包 ${completed.length} 个模组，下载已开始。`);
    }catch(e){setMessage(c.signal.aborted?'已取消下载，可重新选择后重试。':e instanceof Error?e.message:'批量下载失败');updateQueue(prev=>prev.map(q=>q.status==='下载中'?{...q,status:'已取消'}:q));}
    finally{setBusy(false);setProgress('');controller.current=null;}
  };
  const checked=queue.filter(q=>q.checked);
  return <div className="mods-panel"><div className="resource-intro"><div><h2>模组下载</h2><p>找到适合你的模组，选好版本，一次打包带走。</p></div><span className="source-chip">支持批量 ZIP 下载</span></div>
  <div className="filters mods-filters"><label>模组来源<select value={source} onChange={e=>{setSource(e.target.value as ModSource);setOffset(0);}}><option value="modrinth">Modrinth</option><option value="curseforge">CurseForge</option><option value="mcmod">MC 百科 · 中文检索</option></select></label><label>Minecraft 版本<input list="mod-game-versions" value={game} maxLength={60} onChange={e=>{setGame(e.target.value);setOffset(0);}} placeholder="如 1.21.1"/><datalist id="mod-game-versions">{games.map(v=><option key={v} value={v}/>)}</datalist></label><label>模组加载器<select value={loader} onChange={e=>{setLoader(e.target.value);setOffset(0);}}><option value="fabric">Fabric</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option><option value="quilt">Quilt</option></select></label><label className="mods-search-label">搜索模组<div className="search"><Search size={17}/><input aria-label="搜索模组" value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);setOffset(0);}} placeholder={source==='mcmod'?'中文名称，如 钠':'名称或关键词，如 Sodium'}/>{search&&<button aria-label="清除模组搜索" onClick={()=>setSearch('')}><X size={15}/></button>}</div></label></div>
  {source==='mcmod'&&<p className="inline-note">MC 百科提供中文资料检索。点击条目后选择其收录的 Modrinth 或 CurseForge 来源下载；版本和加载器在下载平台中匹配。</p>}
  <div className="mods-layout"><div className="mods-browser">
  {project ? <div className="mod-detail"><div className="mod-detail-heading"><button className="text-button" onClick={()=>{detailController.current?.abort();setProject(undefined);}}><ArrowLeft size={16}/>返回结果</button><a href={project.url} target="_blank" rel="noreferrer">{sourceNames[project.source]} 原站<ExternalLink size={14}/></a></div><ModOverview project={info||project} loading={infoLoading} error={infoError}/><p>{project.source==='mcmod'?'选择百科条目收录的公开下载来源。':`Minecraft ${game} · ${loader} · 按发布时间排序`}</p>
  {detailLoading?<div className="notice">正在读取匹配文件…</div>:detailError?<div className="notice" role="status"><p>{detailError}</p>{project.source==='mcmod'?<div className="mcmod-fallback-actions"><a className="download-button" href={project.url} target="_blank" rel="noreferrer">在浏览器中打开百科<ExternalLink size={14}/></a><button className="text-button" onClick={()=>{setSource('modrinth');setSearch(project.title);setOffset(0);}}>改用 Modrinth 搜索</button></div>:<button className="text-button" onClick={()=>openProject(project)}>重试</button>}</div>:project.source==='mcmod'?<div className="mcmod-links">{links.length?links.map(p=><button key={p.source+p.id} className="download-button" onClick={()=>openProject({...p,title:project.title})}>{sourceNames[p.source]} · 查看匹配文件</button>):<p className="inline-note">该条目未提供可解析的 Modrinth／CurseForge 公开链接，请到百科条目查看其他下载方式。</p>}</div>:files.length?files.map(file=><article className="mod-file" key={key(file)}><div><strong>{file.name}</strong><span>{file.filename} · {formatSize(file.size)}</span><span>{file.date.slice(0,10)} · {file.loaders.join(' / ')} · {file.gameVersions.slice(0,4).join(', ')}</span>{file.dependencies.length>0&&<span className="dependency-note">必需前置：{file.dependencies.join(', ')}（请另行添加）</span>}</div><div className="mod-file-actions">{file.url?<><button className="download-button" disabled={busy||queue.some(q=>key(q.file)===key(file))} onClick={()=>add(file)}>{queue.some(q=>key(q.file)===key(file))?<Check size={15}/>:<Plus size={15}/>}加入队列</button><JarDownload className="icon-button" label={'单独下载 '+file.filename} url={fileURL(file)} filename={file.filename} hash={file.hash} hashType={file.hashType} disabled={busy}><Download size={16}/></JarDownload></>:<span className="inline-note">第三方下载未开放</span>}<a className="text-button" href={file.page} target="_blank" rel="noreferrer">原站<ExternalLink size={13}/></a></div></article>):<div className="notice">没有匹配此游戏版本与加载器的文件，请调整筛选。</div>}</div>
  :loading?<div className="notice">正在检索 {sourceNames[source]}…</div>:error?<div className="notice" role="status"><p>{error}</p><button className="text-button" onClick={()=>setRefresh(n=>n+1)}>重新加载</button>{source==='mcmod'&&<div className="mcmod-fallback-actions"><a className="download-button" href={'https://search.mcmod.cn/s?'+new URLSearchParams({key:search,filter:'1'})} target="_blank" rel="noreferrer">在浏览器中搜索 MC 百科<ExternalLink size={14}/></a><button className="text-button" onClick={()=>{setSource('modrinth');setOffset(0);}}>改用 Modrinth 搜索</button></div>}{source==='curseforge'&&<p><a href={'https://www.curseforge.com/minecraft/search?class=mc-mods&search='+encodeURIComponent(search)} target="_blank" rel="noreferrer">前往 CurseForge 搜索</a></p>}</div>:projects.length?<><div className="mod-results">{projects.map(p=><article className="mod-card" key={p.source+p.id}><div className="mod-card-main"><ModPicture src={p.icon} alt={p.title} className="mod-card-icon" icon/><div className="mod-card-copy"><h3>{p.title}</h3><ModTags categories={p.categories}/><p>{p.description||'来源暂未提供简介，打开详情查看原站资料。'}</p><span>{sourceNames[p.source]}{p.downloads!==undefined?' · '+p.downloads.toLocaleString()+' 次下载':''}</span></div><button className="download-button" onClick={()=>openProject(p)}>图文详情</button></div>{p.gallery?.[0]&&<button className="mod-card-preview" onClick={()=>openProject(p)} aria-label={'查看 '+p.title+' 的图片与介绍'}><ModPicture src={p.gallery[0].url} alt={p.gallery[0].title||p.title+' 预览图'}/><span>查看模组效果</span></button>}</article>)}</div><div className="mod-pagination"><button disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-20))}>上一页</button><span>第 {Math.floor(offset/20)+1} 页</span><button disabled={!hasMore} onClick={()=>setOffset(n=>n+20)}>下一页</button></div></>:<div className="notice">{source==='mcmod'&&!search?'输入中文或英文名称，检索 MC 百科模组条目。':'没有找到模组，试试其他关键词、游戏版本或加载器。'}</div>}
  </div><aside className="mod-queue" aria-label="批量下载队列"><div className="queue-heading"><h3>下载队列 <span>{queue.length}</span></h3><button className="text-button" disabled={busy||!queue.length} onClick={()=>{updateQueue(()=>[]);setMessage('');}}>清空</button></div><p>最多 30 个 · 总计 200 MiB · 单文件 64 MiB</p>{queue.length?<><div className="queue-tools"><button disabled={busy} onClick={()=>updateQueue(prev=>prev.map(q=>({...q,checked:true})))}>全选</button><button disabled={busy} onClick={()=>updateQueue(prev=>prev.map(q=>({...q,checked:false})))}>全不选</button><button disabled={busy} onClick={()=>updateQueue(prev=>prev.map(q=>({...q,checked:q.status!=='已打包'})))}>只选未完成项</button></div><div className="queue-items">{queue.map(q=><div className="queue-item" key={key(q.file)}><input type="checkbox" aria-label={'选择 '+q.title} disabled={busy} checked={q.checked} onChange={e=>updateQueue(prev=>prev.map(item=>key(item.file)===key(q.file)?{...item,checked:e.target.checked}:item))}/><div><strong>{q.title}</strong><span>{q.game} · {q.loader} · {formatSize(q.file.size)}</span><span>{q.file.filename}</span><small role="status">{q.status}</small></div><button className="icon-button" disabled={busy} aria-label={'移除 '+q.title} onClick={()=>updateQueue(prev=>prev.filter(item=>key(item.file)!==key(q.file)))}><X size={14}/></button></div>)}</div><p>已选 {checked.length} 个 · {formatSize(checked.reduce((n,q)=>n+q.file.size,0))}</p><button className="batch-button" disabled={busy||!checked.length} onClick={batch}><Download size={17}/>下载选中为 ZIP</button>{busy&&<button className="text-button" onClick={()=>controller.current?.abort()}>取消下载</button>}</>:<div className="queue-empty"><Square size={27}/><p>选择模组版本，<br/>加入你的下载队列。</p></div>}{progress&&<p className="batch-progress" role="status">{progress}</p>}{message&&<p className="batch-message" role="status">{message}</p>}<p className="queue-note">ZIP 中含 mods 文件夹与版本清单。仅下载你选择的文件，请补齐必需前置，同名模组只保留一个来源。</p></aside></div></div>;
}
