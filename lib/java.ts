import { SourceError, sourceJSON, sourceText } from './upstream';
export type JavaDownload = { name: string; url: string; detail: string; hash?: string; hashType?: string; size?: number };
export function javaOptions(p: URLSearchParams) {
  const version = p.get('version') || '21', os = p.get('os') || 'windows', arch = p.get('arch') || 'x64', kind = p.get('kind') || 'jre', source = p.get('source') || 'tuna';
  if (!['8','11','17','21','25'].includes(version) || !['windows','linux','mac'].includes(os) || !['x64','aarch64'].includes(arch) || !['jdk','jre'].includes(kind) || !['tuna','huawei','adoptium'].includes(source)) throw new SourceError('Java 参数无效', 400);
  return { version, os, arch, kind, source };
}
export function tunaFiles(html: string, base: string): JavaDownload[] {
  const files = Array.from(html.matchAll(/href="([^"<>]+)"/g), m => m[1]).filter(name => /^OpenJDK[\w.+-]+\.(?:zip|tar\.gz|msi|pkg)$/.test(name));
  return [...new Set(files)].map(name => ({ name, url: base + encodeURIComponent(name), detail: `清华 TUNA 国内镜像 · ${/\.(msi|pkg)$/.test(name) ? '安装程序' : '压缩包，解压后选择 Java 路径'}` }));
}
export async function javaDownloads(p: URLSearchParams): Promise<JavaDownload[]> {
  const { version, os, arch, kind, source } = javaOptions(p);
  if (source === 'tuna') {
    const base = `https://mirrors.tuna.tsinghua.edu.cn/Adoptium/${version}/${kind}/${arch}/${os}/`;
    return tunaFiles(await sourceText(base), base);
  }
  if (source === 'huawei') {
    if (kind !== 'jdk') throw new SourceError('华为 OpenJDK 镜像提供 JDK，请切换安装包类型为 JDK。', 400);
    const root = 'https://mirrors.huaweicloud.com/openjdk/';
    const listing = await sourceText(root);
    const dirs = [...listing.matchAll(/href="(\d+(?:\.\d+)*\/?)["\/]/g)].map(m => m[1].replace(/\/$/, '')).filter(v => v.split('.')[0] === version).sort((a,b) => b.localeCompare(a,undefined,{numeric:true}));
    if (!dirs.length) return [];
    const base = root + dirs[0] + '/';
    const html = await sourceText(base);
    const tag = (os === 'mac' ? 'macos' : os) + '-' + arch;
    return [...new Set([...html.matchAll(/href="([^"<>]+)"/g)].map(m => m[1]))].filter(name => /^openjdk-[\w.+-]+\.(?:zip|tar\.gz)$/.test(name) && name.includes(tag)).map(name => ({ name, url: base + encodeURIComponent(name), detail: '华为云国内镜像 · OpenJDK · 压缩包' }));
  }
  type Asset = { version: { semver: string }; binary: { package: { link: string; name: string; size: number; checksum: string } } };
  const assets = await sourceJSON<Asset[]>(`https://api.adoptium.net/v3/assets/latest/${version}/hotspot?architecture=${arch}&image_type=${kind}&os=${os}&vendor=eclipse`);
  return assets.map(a => ({ name: `Temurin ${a.version.semver} ${kind.toUpperCase()}`, url: a.binary.package.link, detail: 'Adoptium 官方源 · ' + a.binary.package.name, size: a.binary.package.size, hash: a.binary.package.checksum, hashType: 'SHA-256' }));
}
