export class SourceError extends Error {
  constructor(message: string, public status = 502, public upstreamStatus?: number) { super(message); }
}
export const USER_AGENT = 'DMC/1.1 (+https://github.com/tourio114/dmc)';
export async function boundedText(response: Response, limit = 8 * 1024 * 1024): Promise<string> {
  if (!response.ok) throw new SourceError(`下载源返回 ${response.status}，请稍后重试。`, response.status === 429 ? 429 : 502, response.status);
  const reader = response.body?.getReader(); if (!reader) throw new SourceError('下载源返回空响应');
  const parts: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > limit) { await reader.cancel(); throw new SourceError('下载源目录过大'); } parts.push(value); }
  const result = new Uint8Array(length); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(result);
}
export async function sourceText(url: string, headers: Record<string, string> = {}) {
  return boundedText(await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': USER_AGENT, ...headers } }));
}
export async function sourceJSON<T>(url: string, headers: Record<string, string> = {}): Promise<T> { return JSON.parse(await sourceText(url, { Accept: 'application/json', ...headers })) as T; }
export const textOnly = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
export function errorResponse(error: unknown) { return Response.json({ error: error instanceof SourceError ? error.message : '连接来源失败，请重试或更换来源。', ...(error instanceof SourceError && error.upstreamStatus ? {upstreamStatus:error.upstreamStatus} : {}) }, { status: error instanceof SourceError ? error.status : 502 }); }
export function catalogueResponse(data: unknown) { return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } }); }
