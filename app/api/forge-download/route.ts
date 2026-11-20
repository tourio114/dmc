import { BMCL } from '../../../lib/downloads';
import { fetchJar, jarResponse } from '../../../lib/jar-download';
import { errorResponse, SourceError, sourceJSON } from '../../../lib/upstream';
type ForgeBuild={version:string;branch?:string|null;mcversion:string;files:{format:string;category:string}[]};
export async function GET(request: Request) {
  try {
    const p=new URL(request.url).searchParams, mc=p.get('mcversion')||'',version=p.get('version')||'',branch=p.get('branch')||'';
    if(!/^[\w.+-]{1,60}$/.test(mc)||!/^[\w.+-]{1,60}$/.test(version)||!/^[\w.+-]{0,60}$/.test(branch))throw new SourceError('Forge 版本参数无效',400);
    const builds=await sourceJSON<ForgeBuild[]>(`${BMCL}/forge/minecraft/${encodeURIComponent(mc)}`);
    const build=builds.find(b=>b.mcversion===mc&&b.version===version&&(b.branch||'')===branch&&b.files.some(f=>f.category==='installer'&&f.format==='jar'));
    if(!build)throw new SourceError('未找到对应的 Forge JAR 安装器，请刷新列表。',404);
    const artifact=`${mc}-${version}${branch?'-'+branch:''}`,filename=`forge-${artifact}-installer.jar`;
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(90000)]);
    const path=`net/minecraftforge/forge/${encodeURIComponent(artifact)}/${encodeURIComponent(filename)}`;
    const sources=[{url:`${BMCL}/maven/${path}`,name:'BMCLAPI'},{url:`https://maven.minecraftforge.net/${path}`,name:'Forge Maven'}];
    for(let index=0;index<sources.length;index++) {
      try {
        const response=await jarResponse(await fetchJar(sources[index].url,'forge',signal),filename,request);
        response.headers.set('X-DMC-Download-Source',sources[index].name);
        return response;
      }catch(error){if(signal.aborted||index===sources.length-1)throw error;}
    }
    throw new SourceError('Forge 下载源暂时不可用，请重试。');
  }catch(e){return errorResponse(e);}
}
