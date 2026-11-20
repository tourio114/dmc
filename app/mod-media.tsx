'use client';
import { useEffect, useState } from 'react';
import { Package, ImageOff, ExternalLink } from 'lucide-react';
import type { ModImage, ModProject } from '../lib/mods';
const categoryLabels: Record<string,string> = {
  optimization:'性能优化', adventure:'冒险探索', worldgen:'世界生成', technology:'科技机械', magic:'魔法', storage:'仓储管理', decoration:'建筑装饰', utility:'实用工具', library:'前置与开发库', equipment:'装备道具', food:'食物', mobs:'生物', transportation:'交通运输', management:'管理工具', economy:'经济系统', social:'社交', gameMechanics:'游戏机制', 'game-mechanics':'游戏机制', 'quality-of-life':'便捷体验', 'client-utility':'客户端工具', 'server-utility':'服务器工具', cursed:'趣味玩法', fabric:'Fabric', forge:'Forge', neoforge:'NeoForge', quilt:'Quilt', 'user-interface':'界面工具', performance:'性能优化', rendering:'画面渲染', 'map-information':'地图与信息', 'world-gen':'世界生成', 'mc-technology':'科技', 'mc-magic':'魔法', 'mc-world-gen':'世界生成', 'mc-mobs':'生物'
};
export function ModPicture({src,alt,className='',icon=false}:{src?:string;alt:string;className?:string;icon?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  if(!src||failed)return <span className={'mod-picture-fallback '+className} role="img" aria-label={icon?`${alt}（暂无图标）`:failed?'图片加载失败':'暂无预览图'}>{icon?<Package size={26}/>:<><ImageOff size={23}/><span>{failed?'图片加载失败':'暂无预览图'}</span></>}</span>;
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}
export function ModTags({categories=[]}:{categories?:string[]}) {
  const tags=categories.filter(c=>!['fabric','forge','neoforge','quilt'].includes(c.toLowerCase())).slice(0,5);
  if(!tags.length)return null;
  return <div className="mod-tags" aria-label="模组用途分类">{tags.map(c=><span key={c}>{categoryLabels[c]||categoryLabels[c.toLowerCase()]||c}</span>)}</div>;
}
export function ModGallery({images,title}:{images:ModImage[];title:string}) {
  const [selected,setSelected]=useState(0);
  useEffect(()=>setSelected(0),[images]);
  const active=images[selected]||images[0];
  if(!active)return <div className="mod-gallery-empty"><ImageOff size={20}/><span>作者暂未提供预览图，可先查看用途简介与原站介绍。</span></div>;
  return <section className="mod-gallery" aria-label={title+' 图片预览'}><a className="mod-gallery-main" href={active.url} target="_blank" rel="noreferrer" title="打开原图"><ModPicture key={active.url} src={active.url} alt={active.title||title+' 预览图'}/><span className="original-image">查看原图<ExternalLink size={13}/></span></a><div className="mod-gallery-caption"><strong>{active.title||title+' · 预览图'}</strong>{active.description&&<p>{active.description}</p>}<span>{selected+1} / {images.length}</span></div>{images.length>1&&<div className="mod-gallery-thumbs" aria-label="选择预览图">{images.map((image,i)=><button key={image.url} aria-label={`查看第 ${i+1} 张图片`} aria-pressed={selected===i} onClick={()=>setSelected(i)}><ModPicture src={image.thumbnail||image.url} alt={image.title||`第 ${i+1} 张预览图`}/></button>)}</div>}</section>;
}
export function ModOverview({project,loading,error}:{project:ModProject;loading:boolean;error:string}) {
  return <section className="mod-overview" aria-label="模组用途与图片"><div className="mod-overview-heading"><ModPicture src={project.icon} alt={project.title} className="mod-overview-icon" icon/><div><h3>{project.title}</h3><ModTags categories={project.categories}/></div></div><p className="mod-purpose">{project.description||'来源暂未提供简介，请查看原站介绍。'}</p>{loading&&<p className="media-status" role="status">正在获取图片与介绍…</p>}{error&&<p className="media-status" role="status">{error}</p>}<ModGallery images={project.gallery||[]} title={project.title}/>{project.about&&project.about!==project.description&&<details className="mod-about"><summary>展开原站介绍</summary><p>{project.about}</p></details>}<a className="mod-chinese-link" href={'https://search.mcmod.cn/s?'+new URLSearchParams({key:project.title,filter:'1'})} target="_blank" rel="noreferrer">到 MC 百科查看中文资料<ExternalLink size={13}/></a></section>;
}
