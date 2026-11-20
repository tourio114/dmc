import { modsCatalogue, resolveModFile, type ModEnv } from '../../../lib/mods';
import { catalogueResponse, errorResponse, SourceError } from '../../../lib/upstream';
import { fetchJar, jarResponse } from '../../../lib/jar-download';
export async function GET(request: Request, env: ModEnv = {}) {
  try {
    const p=new URL(request.url).searchParams;
    if(p.get('action')!=='download')return catalogueResponse(await modsCatalogue(p,env));
    const file=await resolveModFile(p,env);
    if(!file.url)throw new SourceError('作者未提供第三方下载地址，请前往 CurseForge 原站下载。',403);
    const limit=64*1024*1024;
    if(file.size>limit)throw new SourceError('该文件超过批量下载的 64 MiB 上限，请使用原站下载。',413);
    const response=await fetchJar(file.url,file.source,AbortSignal.any([request.signal,AbortSignal.timeout(90000)]));
    return await jarResponse(response,file.filename,request,limit);
  } catch(e){return errorResponse(e);}
}
