import { modsCatalogue, resolveModFile, type ModEnv } from '../../../lib/mods';
import { catalogueResponse, errorResponse, SourceError, USER_AGENT } from '../../../lib/upstream';
export async function GET(request: Request, env: ModEnv = {}) {
  try {
    const p=new URL(request.url).searchParams;
    if(p.get('action')!=='download')return catalogueResponse(await modsCatalogue(p,env));
    const file=await resolveModFile(p,env);
    if(!file.url)throw new SourceError('作者未提供第三方下载地址，请前往 CurseForge 原站下载。',403);
    const limit=64*1024*1024;
    if(file.size>limit)throw new SourceError('该文件超过批量下载的 64 MiB 上限，请使用原站下载。',413);
    const response=await fetch(file.url,{redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(90000)]),headers:{'User-Agent':USER_AGENT}});
    if(!response.ok||!response.body)throw new SourceError(`模组文件下载失败（${response.status}），请重试。`);
    if(Number(response.headers.get('content-length'))>limit){await response.body.cancel();throw new SourceError('文件超过 64 MiB，请使用原站下载。',413);}
    let length=0;
    const stream=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){length+=chunk.length;if(length>limit)throw new Error('File size exceeds limit');controller.enqueue(chunk);}}));
    return new Response(stream,{headers:{'Content-Type':'application/java-archive','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch(e){return errorResponse(e);}
}
