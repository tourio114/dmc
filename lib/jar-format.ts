export function jarFilename(value: string): string {
  const safe=value.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'_').replace(/^\.+/,'').trim();
  return (Array.from(safe.replace(/\.jar$/i,'')).slice(0,160).join('')||'download')+'.jar';
}
export function jarDisposition(filename: string): string {
  const name=jarFilename(filename);
  const ascii=name.replace(/[^\x20-\x7e]/g,'_').replace(/["\\;%]/g,'_');
  const utf8=encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
export function isJarHeader(bytes: Uint8Array): boolean { return bytes.length>=4 && bytes[0]===0x50 && bytes[1]===0x4b && ((bytes[2]===3&&bytes[3]===4)||(bytes[2]===5&&bytes[3]===6)||(bytes[2]===7&&bytes[3]===8)); }
