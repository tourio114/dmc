export const BMCL = 'https://bmclapi2.bangbang93.com';
const mojangHosts = new Set(['piston-meta.mojang.com','piston-data.mojang.com','launchermeta.mojang.com','launcher.mojang.com']);
export function mirrorURL(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('下载地址必须使用 HTTPS');
  if (mojangHosts.has(url.hostname)) return BMCL + url.pathname;
  if (url.hostname === 'maven.fabricmc.net') return BMCL + '/maven' + url.pathname;
  if (url.hostname === 'bmclapi2.bangbang93.com') return url.href;
  throw new Error('无法识别的下载来源');
}
export function catalogTarget(params: URLSearchParams): string {
  const type = params.get('type');
  const version = params.get('version') || '';
  if (type === 'manifest') return BMCL + '/mc/game/version_manifest_v2.json';
  if (type === 'java-mirror') return BMCL + '/java/list';
  if (type === 'fabric-installer') return BMCL + '/fabric-meta/v2/versions/installer';
  if (type === 'fabric-games') return BMCL + '/fabric-meta/v2/versions/game';
  if (type === 'forge-games') return BMCL + '/forge/minecraft';
  if ((type === 'forge' || type === 'fabric') && /^[a-zA-Z0-9_.+\-]{1,80}$/.test(version)) {
    return BMCL + (type === 'forge' ? '/forge/minecraft/' : '/fabric-meta/v2/versions/loader/') + encodeURIComponent(version);
  }
  if (type === 'version') {
    const path = params.get('path') || '';
    if (/^\/v1\/packages\/[a-f0-9]{40}\/[a-zA-Z0-9_.+\-]+\.json$/.test(path) || /^\/mc\/game\/[a-zA-Z0-9_.+\-]+\/[a-zA-Z0-9_.+\-]+\.json$/.test(path)) return BMCL + path;
  }
  if (type === 'java') {
    const os = params.get('os') || 'windows';
    const arch = params.get('arch') || 'x64';
    if (!['8','11','17','21','25'].includes(version) || !['windows','linux','mac'].includes(os) || !['x64','aarch64'].includes(arch)) throw new Error('无效的 Java 参数');
    return `https://api.adoptium.net/v3/assets/latest/${version}/hotspot?architecture=${arch}&image_type=jdk&os=${os}&vendor=eclipse`;
  }
  throw new Error('无效的接口参数');
}
