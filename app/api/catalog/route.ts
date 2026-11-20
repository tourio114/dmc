import { catalogTarget } from '../../../lib/downloads';
export async function GET(request: Request) {
  let target: string;
  try { target = catalogTarget(new URL(request.url).searchParams); }
  catch { return Response.json({ error: '请求参数无效' }, { status: 400 }); }
  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', 'User-Agent': 'DMC/1.0 (+https://github.com/tourio114/dmc)' } });
    if (!upstream.ok) return Response.json({ error: `下载源暂时不可用（${upstream.status}），请稍后重试。`, upstreamStatus: upstream.status }, { status: upstream.status === 429 ? 429 : 502 });
    // Only bounded catalogue JSON is read here. Download binaries never pass through this route.
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error('empty response');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error('catalogue too large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=1800', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'catalogue_fetch_failed', target, message: error instanceof Error ? error.message : 'unknown' }));
    return Response.json({ error: '连接下载源超时或返回格式异常，请重试。' }, { status: 502 });
  }
}
