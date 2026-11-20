'use client';
import { useState, type ReactNode } from 'react';
import { isJarHeader, jarFilename } from '../lib/jar-format';
export default function JarDownload({url,filename,children,className='download-button',label,hash,hashType,disabled=false}:{url:string;filename:string;children:ReactNode;className?:string;label?:string;hash?:string;hashType?:string;disabled?:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const start=async()=>{
    setBusy(true);setError('');
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
      if(!response.ok){let message=`下载失败（${response.status}），请重试。`;try{const data=await response.json() as {error?:string};if(data.error)message=data.error;}catch{}throw new Error(message);}
      const reader=response.body?.getReader();if(!reader)throw new Error('下载文件内容为空');const parts:Uint8Array[]=[];let length=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>64*1024*1024)throw new Error('文件超过 64 MiB，请使用原站下载。');parts.push(value);}}catch(e){await reader.cancel();throw e;}
      const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
      if(!isJarHeader(bytes))throw new Error('下载源返回了错误页面，没有保存为 JAR；请重试或前往原站。');
      if(hash&&hashType&&['SHA-1','SHA-512','SHA-256'].includes(hashType)){const digest=await crypto.subtle.digest(hashType,bytes);const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');if(hex!==hash.toLowerCase())throw new Error('文件校验不一致，请重试。');}
      const blobURL=URL.createObjectURL(new Blob([bytes],{type:'application/java-archive'}));const link=document.createElement('a');link.href=blobURL;link.download=jarFilename(filename);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(blobURL),60000);
    }catch(e){setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'连接超时，请重试或使用原站下载。');}finally{setBusy(false);}
  };
  return <span className="jar-download-control"><button type="button" className={className} aria-label={label} disabled={disabled||busy} aria-busy={busy} onClick={start}>{busy?'下载中…':children}</button>{error&&<span className="jar-download-error" role="alert">{error}</span>}</span>;
}
