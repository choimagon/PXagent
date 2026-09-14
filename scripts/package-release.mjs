import {readdir,copyFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const platform=process.env.PX_BUILD_PLATFORM||process.platform;
const arch=process.env.PX_BUILD_ARCH||process.arch;
await mkdir('release-assets',{recursive:true});
const files=await readdir('release');
const version=JSON.parse(await (await import('node:fs/promises')).readFile('package.json','utf8')).version;
if(platform==='win32') {
 const exe=files.find(f=>f===`PXagents-${version}-win-${arch}.exe`);
 if(!exe)throw Error('Installer missing');
 await copyFile(path.join('release',exe),`release-assets/PXagents-windows-${arch}.exe`);
} else if(platform==='darwin') {
 const zip=files.find(f=>f===`PXagents-${version}-mac-${arch}.zip`);
 if(!zip)throw Error('App ZIP missing');
 await copyFile(path.join('release',zip),`release-assets/PXagents-mac-${arch}.zip`);
 for(const f of files.filter(f=>f===`PXagents-${version}-mac-${arch}.dmg`))await copyFile(path.join('release',f),path.join('release-assets',f));
} else {
 const folder=`linux${arch==='arm64'?'-arm64':''}-unpacked`;
 // Normalise the archive root so install.sh can use the same layout on both CPUs.
 const staging=path.resolve('release','pxagents');
 const {cp,rm}=await import('node:fs/promises');
 await cp(path.resolve('release',folder),staging,{recursive:true});
 // Per-user installs use Chromium's namespace sandbox, not a setuid executable.
 execFileSync('chmod',['0755',path.join(staging,'chrome-sandbox')]);
 execFileSync('tar',['-czf',path.resolve(`release-assets/PXagents-linux-${arch}.tar.gz`),'-C',path.resolve('release'),'pxagents']);
 await rm(staging,{recursive:true,force:true});
 for(const [extension,nativeArch] of [['AppImage',arch==='x64'?'x86_64':arch],['deb',arch==='x64'?'amd64':arch]]) {
  const source=`PXagents-${version}-linux-${nativeArch}.${extension}`;
  if(!files.includes(source))throw Error(`${extension} installer missing: ${source}`);
  await copyFile(path.join('release',source),`release-assets/PXagents-${version}-linux-${arch}.${extension}`);
 }
}
