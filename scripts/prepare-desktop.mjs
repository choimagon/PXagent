import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const platform=process.env.PX_BUILD_PLATFORM||process.platform;
const arch=process.env.PX_BUILD_ARCH||process.arch;
const vendor=path.join(root,'node_modules','@openai',`codex-${platform}-${arch}`,'vendor');
let directories;
try{directories=await readdir(vendor);}catch{throw Error(`플랫폼용 공식 Codex가 없습니다: ${platform}/${arch}. 해당 운영체제와 아키텍처에서 npm ci 후 빌드하세요.`);}
if(directories.length!==1)throw Error('Codex 플랫폼 폴더를 확인해주세요.');
const destination=path.join(root,'build','codex');await rm(destination,{recursive:true,force:true});await mkdir(path.dirname(destination),{recursive:true});
await cp(path.join(vendor,directories[0]),destination,{recursive:true,preserveTimestamps:true});
console.log(`공식 Codex ${platform}/${arch} 배포 리소스 준비 완료`);
