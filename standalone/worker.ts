import { GET } from '../app/api/catalog/route';
declare const DMC_HTML: string;
declare const DMC_ICON: string;
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    if (url.pathname === '/api/catalog') return GET(request);
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
    if (url.pathname === '/favicon.svg') return new Response(request.method === 'HEAD' ? null : DMC_ICON, { headers: { ...headers, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
    if (url.pathname === '/' || url.pathname === '/index.html') return new Response(request.method === 'HEAD' ? null : DMC_HTML, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    return new Response('Not Found', { status: 404, headers });
  },
};
