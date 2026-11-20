'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, Box, Coffee, Layers, Search, ExternalLink, X, Copy, Check, RefreshCw, ArrowDownToLine, Code2 as Github, Pickaxe, ShieldCheck, Zap, ChevronRight, Sun, Moon } from 'lucide-react';
import { BMCL, mirrorURL } from '../lib/downloads';

type Version = { id: string; type: string; url: string; releaseTime: string };
type Manifest = { latest: { release: string; snapshot: string }; versions: Version[] };
type FileItem = { name: string; url: string; detail?: string; hash?: string; hashType?: string; size?: number };
type Tab = 'minecraft' | 'forge' | 'fabric' | 'java';
const names: Record<Tab, string> = { minecraft: 'Minecraft', forge: 'Forge', fabric: 'Fabric', java: 'Java' };
type ForgeBuild = { build: number; version: string; branch?: string; mcversion: string; modified: string; files: { category: string; format: string; hash?: string }[] };
type FabricInstaller = { version: string; url: string; stable: boolean };
type JavaAsset = { version: { semver: string }; binary: { package: { link: string; size: number; checksum: string; name: string } } };
type CatalogTypes = {
  manifest: Manifest;
  'forge-games': string[];
  'fabric-games': { stable: boolean; version: string }[];
  forge: ForgeBuild[];
  fabric: { loader: { version: string; stable: boolean } }[];
  'fabric-installer': FabricInstaller[];
  'java-mirror': { title: string; file: string }[];
  java: JavaAsset[];
  version: { javaVersion?: { majorVersion: number }; downloads?: Record<string, { url: string; size: number; sha1: string }> };
};
async function api<K extends keyof CatalogTypes>(type: K, params: Record<string, string> = {}, signal?: AbortSignal): Promise<CatalogTypes[K]> {
  const response = await fetch('/api/catalog?' + new URLSearchParams({ type, ...params }), { signal });
  const data = await response.json();
  if (!response.ok) throw new Error((data as { error?: string }).error || '加载失败，请重试');
  return data as CatalogTypes[K];
}
const date = (value: string) => new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
const size = (n?: number) => n ? `${(n / 1024 / 1024).toFixed(1)} MB` : '';
function FileLink({ item }: { item: FileItem }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return <div className="file-row"><div className="file-info"><strong>{item.name}</strong><span>{item.detail} {size(item.size)}</span>{item.hash && <code title={item.hash}>{item.hashType || 'SHA-1'}: {item.hash}</code>}</div><div className="file-actions"><button className="icon-button" title={copyError ? '复制失败，请手动复制下载链接' : copied ? '已复制链接' : '复制下载链接'} aria-label="复制下载链接" onClick={async () => { try { await navigator.clipboard.writeText(item.url); setCopied(true); setCopyError(false); setTimeout(() => setCopied(false), 1800); } catch { setCopyError(true); } }}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button><a className="download-button" href={item.url} target="_blank" rel="noreferrer"><Download size={16}/>下载</a></div>{copyError && <small role="status">复制失败，可右键下载按钮复制链接</small>}</div>;
}
function Notice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="notice" role="status"><p>{message}</p>{retry && <button className="text-button" onClick={retry}><RefreshCw size={15}/>重新加载</button>}</div>;
}
function ResourcePanel({ tab }: { tab: Exclude<Tab, 'minecraft'> }) {
  const [games, setGames] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [java, setJava] = useState('21');
  const [os, setOS] = useState('windows');
  const [arch, setArch] = useState('x64');
  const [source, setSource] = useState('temurin');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (tab === 'java') return;
    const controller = new AbortController();
    setLoading(true); setError('');
    (tab === 'forge' ? api('forge-games', {}, controller.signal).then(data => data.filter(v => typeof v === 'string')) : api('fabric-games', {}, controller.signal).then(data => data.filter(v => v.stable).map(v => v.version))).then(ids => {
      ids.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      setGames(ids); setVersion(ids[0] || '');
      if (!ids.length) { setError('下载源暂未提供可用的游戏版本'); setLoading(false); }
    }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [tab, refresh]);
  useEffect(() => {
    if (tab !== 'java' && !version) return;
    const controller = new AbortController(); setLoading(true); setError(''); setFiles([]);
    (async () => {
      let list: FileItem[] = [];
      if (tab === 'forge') {
        const data = await api('forge', { version }, controller.signal);
        list = data.sort((a: { build: number }, b: { build: number }) => b.build - a.build).flatMap((build: { version: string; branch?: string; mcversion: string; modified: string; files: { category: string; format: string; hash?: string }[] }) => build.files.filter(f => f.category === 'installer' && f.format === 'jar').map(f => {
          const params = new URLSearchParams({ mcversion: build.mcversion, version: build.version, category: f.category, format: f.format });
          if (build.branch) params.set('branch', build.branch);
          return { name: `Forge ${build.version}`, detail: `MC ${build.mcversion} · JAR 安装器 · ${date(build.modified)}`, url: BMCL + '/forge/download?' + params, hash: f.hash, hashType: f.hash?.length === 32 ? 'MD5' : 'SHA-1' };
        }));
      } else if (tab === 'fabric') {
        const [loaders, installers] = await Promise.all([api('fabric', { version }, controller.signal), api('fabric-installer', {}, controller.signal)]);
        const installer = installers.find((i: { stable: boolean }) => i.stable) || installers[0];
        if (installer) list.push({ name: `Fabric 安装器 ${installer.version}`, url: mirrorURL(installer.url), detail: `通用 JAR 安装器 · 打开后选择 Minecraft ${version}` });
        list.push(...loaders.map((entry: { loader: { version: string; stable: boolean } }) => ({ name: `Fabric Loader ${entry.loader.version}`, detail: `MC ${version} · ${entry.loader.stable ? '稳定版' : '测试版'} · 启动器配置 JSON`, url: `${BMCL}/fabric-meta/v2/versions/loader/${encodeURIComponent(version)}/${encodeURIComponent(entry.loader.version)}/profile/json` })));
      } else if (source === 'bmcl') {
        const data = await api('java-mirror', {}, controller.signal);
        list = data.map((item: { title: string; file: string }) => ({ name: item.title, url: `${BMCL}/java/${encodeURIComponent(item.file)}`, detail: 'BMCLAPI 旧版 JRE 镜像 · 以来源说明为准' }));
      } else {
        const data = await api('java', { version: java, os, arch }, controller.signal);
        list = data.map((item: { version: { semver: string }; binary: { package: { link: string; size: number; checksum: string; name: string } } }) => ({ name: `Temurin ${item.version.semver}`, url: item.binary.package.link, size: item.binary.package.size, hash: item.binary.package.checksum, hashType: 'SHA-256', detail: item.binary.package.name }));
      }
      if (!controller.signal.aborted) setFiles(list);
    })().catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, version, java, os, arch, source, refresh]);
  return <><div className="resource-intro"><div><h2>{names[tab]} 下载</h2><p>{tab === 'java' ? '为你的世界准备合适的 Java 环境。' : `选择 Minecraft 版本，获取匹配的 ${names[tab]}。`}</p></div><span className="source-chip">{tab === 'java' && source === 'temurin' ? 'Adoptium 官方源' : 'BMCLAPI 镜像源'}</span></div><div className="filters">
    {tab !== 'java' ? <label>Minecraft 版本<select value={version} onChange={e => setVersion(e.target.value)} disabled={!games.length}>{!games.length && <option>正在读取版本…</option>}{games.map(v => <option key={v}>{v}</option>)}</select></label> : <><label>下载来源<select value={source} onChange={e => setSource(e.target.value)}><option value="temurin">Temurin · 现代 Java</option><option value="bmcl">BMCLAPI · 旧版 JRE</option></select></label>{source === 'temurin' && <><label>Java 版本<select value={java} onChange={e => setJava(e.target.value)}>{['25','21','17','11','8'].map(v => <option key={v} value={v}>Java {v}</option>)}</select></label><label>操作系统<select value={os} onChange={e => setOS(e.target.value)}><option value="windows">Windows</option><option value="mac">macOS</option><option value="linux">Linux</option></select></label><label>处理器架构<select value={arch} onChange={e => setArch(e.target.value)}><option value="x64">x64 / Intel / AMD</option><option value="aarch64">ARM64 / Apple Silicon</option></select></label></>}</>}
    <button className="icon-button refresh" aria-label="刷新版本列表" onClick={() => setRefresh(n => n + 1)}><RefreshCw size={18}/></button></div>
    {tab === 'fabric' && <p className="inline-note">安装器用于安装客户端；Loader JSON 供启动器集成使用。请在安装器内选择对应的游戏和 Loader 版本。</p>}
    {tab === 'java' && <p className="inline-note">Java 需求以游戏版本详情为准。Temurin 为官方 JDK 压缩包，包含运行环境；解压后配置启动器的 Java 路径。BMCLAPI 旧版 JRE 不适用于需要 Java 17 / 21 / 25 的版本。</p>}
    {loading ? <Notice message="正在连接下载源…"/> : error ? <Notice message={error} retry={() => setRefresh(n => n + 1)}/> : !files.length ? <Notice message="当前条件下没有可下载文件，请更换版本、系统或架构。"/> : <div className="file-list">{files.map((item, i) => <FileLink key={item.url + i} item={item}/>)}</div>}</>;
}
function VersionDialog({ version, close }: { version: Version; close: () => void }) {
  const [files, setFiles] = useState<FileItem[]>([]); const [java, setJava] = useState<number>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api('version', { path: new URL(version.url).pathname }, controller.signal).then(data => {
      setJava(data.javaVersion?.majorVersion);
      setFiles(['client','server'].flatMap(key => { const file = data.downloads?.[key]; return file ? [{ name: key === 'client' ? '原版客户端 JAR' : '原版服务端 JAR', url: mirrorURL(file.url), hash: file.sha1, size: file.size, detail: `${version.id} · BMCLAPI 镜像` }] : []; }));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version, retry]);
  useEffect(() => { const before = document.activeElement as HTMLElement; const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }; document.addEventListener('keydown', handler); document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; before?.focus(); }; }, [close]);
  return <div className="modal-backdrop" onClick={close}><dialog open className="modal" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Tab') { const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')); const first = focusable[0], last = focusable[focusable.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}><button autoFocus onClick={close} className="icon-button modal-close" aria-label="关闭"><X/></button><div className="square-icon"><Box/></div><h2 id="dialog-title">Minecraft {version.id}</h2><p>{date(version.releaseTime)} 发布{java ? ` · 需要 Java ${java}` : ''}</p>{loading ? <Notice message="正在获取下载文件…"/> : error ? <Notice message={error} retry={() => setRetry(n => n + 1)}/> : files.length ? files.map(item => <FileLink key={item.url} item={item}/>) : <Notice message="该历史版本未提供独立 JAR 下载。"/>}<div className="dialog-note">客户端 JAR 并非完整游戏，需使用合法启动器补全资源与依赖，并使用正版账号登录。服务端首次运行后需阅读并同意 Minecraft EULA。</div></dialog></div>;
}
export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    try { const saved = localStorage.getItem('dmc-theme'); if (saved === 'light' || saved === 'dark') return saved; } catch {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem('dmc-theme', next); } catch {}
  };
  const [tab, setTab] = useState<Tab>('minecraft'); const [manifest, setManifest] = useState<Manifest>(); const [error, setError] = useState(''); const [filter, setFilter] = useState('release'); const [search, setSearch] = useState(''); const [limit, setLimit] = useState(12); const [selected, setSelected] = useState<Version>(); const [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController(); setError(''); api('manifest', {}, controller.signal).then(setManifest).catch(e => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [refresh]);
  const versions = useMemo(() => (manifest?.versions || []).filter(v => (filter === 'all' || v.type === filter || filter === 'old' && ['old_alpha','old_beta'].includes(v.type)) && v.id.toLowerCase().includes(search.toLowerCase().trim())), [manifest, search, filter]);
  const go = (next: Tab) => { setTab(next); document.getElementById('downloads')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return <><header><a href="#" className="brand"><img src="/favicon.svg" width="34" height="34" alt=""/>DMC<span>下载站</span></a><nav aria-label="主导航"><a href="#downloads">下载中心</a><a href="#guide">使用指南</a><a href="https://github.com/tourio114/dmc" target="_blank" rel="noreferrer"><Github size={17}/>GitHub</a></nav><span className="header-tag">为下一个世界做好准备</span><button className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'} title={theme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button></header>
  <main><section className="hero"><div className="hero-copy"><span className="eyebrow"><span/> POWERED BY BMCLAPI</span><h1>新的世界，<br/><em>即刻开始。</em></h1><p>从原版到模组，从 Java 到加载器。<br/>你需要的 Minecraft 下载，都在这里。</p><a className="primary-button" href="#downloads"><ArrowDownToLine size={18}/>探索下载</a><div className="hero-meta"><span><Zap size={15}/>国内镜像加速</span><span><ShieldCheck size={15}/>版本实时获取</span></div></div><div className="hero-art" aria-hidden="true"><div className="art-grid"/><svg viewBox="0 0 500 360" className="voxel"><defs><pattern id="grass" width="28" height="20" patternUnits="userSpaceOnUse"><rect width="28" height="20" fill="#9dc65b"/><path d="M0 4h10v5H0M17 12h11v5H17" fill="#afd76c"/></pattern><pattern id="dirt" width="32" height="26" patternUnits="userSpaceOnUse"><rect width="32" height="26" fill="#735440"/><path d="M3 5h11v7H3m15 9h9v5h-9" fill="#876448"/></pattern></defs><ellipse cx="261" cy="310" rx="175" ry="27" fill="#0c1c16" opacity=".25"/><g><path d="m79 204 158-81 183 91-160 82z" fill="url(#grass)"/><path d="m79 204 181 92v51L79 256z" fill="url(#dirt)"/><path d="m260 296 160-82v51l-160 82z" fill="#594737"/><path d="m79 204 181 92v16L79 220z" fill="#65954a"/><path d="m260 296 160-82v16l-160 82z" fill="#487640"/><path d="m112 220 61-31 90 45-61 32z" fill="#6db6ae"/><path d="m144 235 28-14 56 28-27 15z" fill="#89cfc5"/><path d="m283 220 63-32 35 18-63 32z" fill="#c0cf80"/><path d="m283 220 35 18v29l-35-18z" fill="#7a9c4e"/><path d="m318 238 63-32v29l-63 32z" fill="#568844"/>
<path d="m292 135 18-9 18 9v100l-18 9-18-9z" fill="#72533a"/><path d="m310 144 18-9v100l-18 9z" fill="#503f30"/><path d="m250 101 60-31 68 34-61 32z" fill="#8cb84a"/><path d="m250 101 67 35v51l-67-34z" fill="#527e3a"/><path d="m317 136 61-32v52l-61 31z" fill="#366b36"/><path d="m268 65 42-22 49 25-43 22z" fill="#afd15e"/><path d="m268 65 48 25v42l-48-25z" fill="#76a246"/><path d="m316 90 43-22v42l-43 22z" fill="#57883b"/><path d="m164 153 25-13 28 14-25 13z" fill="#d4d7b1"/><path d="m164 153 28 14v30l-28-14z" fill="#b8baa0"/><path d="m192 167 25-13v30l-25 13z" fill="#8e9d87"/><path d="m174 180 8 4v18l-8-4zm22 8 7-4v17l-7 4" fill="#514739"/><path d="m157 167 15-8 15 8v15l-15 8-15-8z" fill="#d9c5ad"/><path d="M161 169h4v4h-4m12 4h4v4h-4" fill="#534d40"/><path d="m370 138 9-5 10 5-10 5z" fill="#e7e17a"/><path d="m370 138 9 5v16l-9-5z" fill="#aac451"/></g><g fill="#c3d4b9" opacity=".7"><path d="m70 74 33-16 40 20-33 17z"/><path d="m350 37 26-13 31 15-26 14z"/></g></svg><div className="art-label"><span className="tiny-square"/>无限可能，从一个方块开始</div></div></section>
  <section className="download-section" id="downloads"><div className="section-heading"><div><span className="eyebrow muted">YOUR NEXT ADVENTURE</span><h2>找到你的版本<span>，开启冒险。</span></h2></div><span className="section-caption">选择 · 下载 · 开始创造</span></div><div className="download-shell"><div className="tabs" role="tablist" aria-label="下载类型">{(['minecraft','forge','fabric','java'] as Tab[]).map(t => { const Icon = t === 'minecraft' ? Box : t === 'forge' ? Pickaxe : t === 'fabric' ? Layers : Coffee; return <button key={t} role="tab" aria-selected={tab === t} aria-controls="download-panel" id={'tab-' + t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}><Icon size={19}/>{names[t]}<span>{t === 'minecraft' ? '原版游戏' : t === 'java' ? '运行环境' : '模组加载器'}</span></button>; })}</div><div className="panel" id="download-panel" role="tabpanel" aria-labelledby={'tab-' + tab}>
  {tab === 'minecraft' ? <><div className="toolbar"><div className="segmented" aria-label="版本类型">{[['release','正式版'],['snapshot','快照版'],['old','远古版'],['all','全部']].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={filter === key ? 'selected' : ''} onClick={() => { setFilter(key); setLimit(12); }}>{label}</button>)}</div><div className="search"><Search size={17}/><input aria-label="搜索游戏版本" value={search} onChange={e => { setSearch(e.target.value); setLimit(12); }} placeholder="搜索版本，如 1.21.1"/>{search && <button aria-label="清除搜索" onClick={() => setSearch('')}><X size={15}/></button>}</div></div><div className="list-heading"><span>版本 / VERSION</span><span>发布日期</span><span>下载</span></div>{error ? <Notice message={error} retry={() => setRefresh(n => n + 1)}/> : !manifest ? <Notice message="正在从 BMCLAPI 获取版本列表…"/> : !versions.length ? <Notice message="没有找到匹配版本，试试其他关键词或版本类型。"/> : <>{versions.slice(0, limit).map(v => <div className="version-row" key={v.id}><div className="version-name"><div className={'version-icon ' + (v.type === 'release' ? '' : 'snapshot')}><Box size={21}/></div><div><strong>{v.id}{v.id === manifest.latest.release && <span className="latest-badge">最新正式版</span>}{v.id === manifest.latest.snapshot && <span className="latest-badge">最新快照</span>}</strong><small>Minecraft Java Edition · {v.type === 'release' ? '正式版' : v.type === 'snapshot' ? '快照版' : '远古版'}</small></div></div><time dateTime={v.releaseTime}>{date(v.releaseTime)}</time><button className="row-download" onClick={() => setSelected(v)}><Download size={16}/><span>下载</span></button></div>)}<div className="list-footer"><span>共 {versions.length} 个版本 · 数据来自 BMCLAPI</span>{limit < versions.length && <button onClick={() => setLimit(n => n + 24)}>加载更多<ChevronRight size={15}/></button>}</div></> }</> : <ResourcePanel key={tab} tab={tab}/>}
  </div></div></section>
  <section className="guides" id="guide"><div className="guide-heading"><h2>出发前，准备一下。</h2><p>距离你的下一个世界，只差几步。</p></div><div className="guide-grid"><article><span className="guide-icon"><Coffee/></span><h3>准备 Java 环境</h3><p>先在游戏版本详情查看 Java 要求，再下载匹配系统与架构的运行环境。</p><button onClick={() => go('java')}>获取 Java<ChevronRight size={16}/></button></article><article><span className="guide-icon"><Layers/></span><h3>让世界多一点不同</h3><p>选择与你的游戏版本对应的 Forge 或 Fabric，安装后再添加兼容的模组。</p><button onClick={() => go('forge')}>浏览模组加载器<ChevronRight size={16}/></button></article><article><span className="guide-icon"><ShieldCheck/></span><h3>关于下载与使用</h3><p>原版客户端 JAR 需启动器补全依赖。游戏需正版授权；本站不提供账号或授权服务。</p><a href="https://www.minecraft.net/zh-hans/download" target="_blank" rel="noreferrer">Minecraft 官方网站<ExternalLink size={15}/></a></article></div></section>
  <div className="source-note"><Box size={22}/><p>感谢每一个让下载更快的方块。<span>Minecraft、Forge、Fabric 镜像由 <a href="https://bmclapidoc.bangbang93.com/" target="_blank" rel="noreferrer">BMCLAPI</a> 与 OpenBMCLAPI 社区提供。现代 Java 来自 Adoptium 官方源。</span></p><a href="https://afdian.com/a/bangbang93" target="_blank" rel="noreferrer">支持 BMCLAPI<ExternalLink size={14}/></a></div></main><footer><a className="brand" href="#"><img src="/favicon.svg" width="26" height="26" alt=""/>DMC</a><p>每一次下载，都是新世界的起点。</p><span>非 Mojang / Microsoft 官方网站</span><a href="https://github.com/tourio114/dmc" target="_blank" rel="noreferrer"><Github size={17}/>开源代码</a></footer>{selected && <VersionDialog version={selected} close={() => setSelected(undefined)}/>}</>;
}
