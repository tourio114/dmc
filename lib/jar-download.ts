import { jarDisposition, isJarHeader } from './jar-format';
import { SourceError, USER_AGENT } from './upstream';
import { trustedModURL } from './mods';
export type JarSource = 'modrinth' | 'curseforge' | 'forge';
const forgeMirrors = new Set(['bmclapi2.bangbang93.com','mirrors.cernet.edu.cn','mirror.nju.edu.cn','mirrors.nju.edu.cn','mirrors.qlu.edu.cn','mirrors4.qlu.edu.cn','mirrors.sjtug.sjtu.edu.cn','mirrors.tuna.tsinghua.edu.cn','mirrors.bfsu.edu.cn','maven.minecraftforge.net']);
export function jarTarget(value: string, source: JarSource): string {
  if(source!=='forge')return trustedModURL(value,source);
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!forgeMirrors.has(u.hostname))throw new SourceError('Forge 下载被重定向到不支持的镜像，请稍后重试。');
  return u.href;
}
export async function fetchJar(url: string, source: JarSource, signal: AbortSignal): Promise<Response> {
  let target=jarTarget(url,source);
  for(let redirects=0;redirects<=5;redirects++) {
    // Workers supports only manual/follow. Validate each hop before sending it.
    const response=await fetch(target,{redirect:'manual',signal,headers:{'User-Agent':USER_AGENT}});
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get('location');await response.body?.cancel();
      if(!location)throw new SourceError('下载源重定向缺少文件地址');
      if(redirects===5)throw new SourceError('下载源重定向次数过多，请稍后重试');
      target=jarTarget(new URL(location,target).href,source);continue;
    }
    if(!response.ok||!response.body){await response.body?.cancel();throw new SourceError(`文件下载源返回 ${response.status}，请重试或前往原站。`,response.status===429?429:502,response.status);}
    return response;
  }
  throw new SourceError('下载源重定向失败');
}
export async function jarResponse(response: Response, filename: string, request: Request, limit=64*1024*1024): Promise<Response> {
  if(!response.body)throw new SourceError('下载文件内容为空');
  if(Number(response.headers.get('content-length'))>limit){await response.body.cancel();throw new SourceError('文件超过 64 MiB，请使用原站下载。',413);}
  const reader=response.body.getReader();const prefix:Uint8Array[]=[];const header=new Uint8Array(4);let headerLength=0,length=0;
  try {
    while(headerLength<4){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw new SourceError('文件超过下载大小上限',413);prefix.push(value);const count=Math.min(4-headerLength,value.length);header.set(value.subarray(0,count),headerLength);headerLength+=count;}
    if(headerLength<4||!isJarHeader(header))throw new SourceError('下载源返回的不是 JAR 文件，可能是错误页面；请重试或前往原站。');
  }catch(e){await reader.cancel();throw e;}
  const headers={'Content-Type':'application/octet-stream','Content-Disposition':jarDisposition(filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(request.method==='HEAD'){await reader.cancel();return new Response(null,{headers});}
  const stream=new ReadableStream<Uint8Array>({
    async pull(controller){
      try {
        request.signal.throwIfAborted();
        if(prefix.length){controller.enqueue(prefix.shift()!);return;}
        const {done,value}=await reader.read();if(done){controller.close();return;}
        length+=value.length;if(length>limit){await reader.cancel();throw new Error('File size exceeds download limit');}controller.enqueue(value);
      }catch(e){await reader.cancel().catch(()=>{});controller.error(e);}
    },
    async cancel(reason){await reader.cancel(reason);}
  });
  return new Response(stream,{headers});
}
