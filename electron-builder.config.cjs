// An empty CI secret must mean unsigned, not a certificate path to the project directory.
for(const key of ['CSC_LINK','CSC_KEY_PASSWORD','WIN_CSC_LINK'])if(process.env[key]==='')delete process.env[key];
module.exports={
  appId:'com.pxagents.office',productName:'PXagents',asar:false,
  directories:{output:'release',buildResources:'build'},
  artifactName:'PXagents-${version}-${os}-${arch}.${ext}',
  files:['desktop/**','public/**','agents/**','harness/**','tools/**','skills/**','scripts/remote-terminal.mjs','scripts/ssh-askpass.cjs','scripts/ssh-askpass.mjs','*.mjs','codex-*.schema.json','package.json','build/icon.png','build/licenses/**','THIRD-PARTY-NOTICES.md','!tests/**','!data/**','!.env','!node_modules/**','!scripts/prepare-desktop.mjs','!scripts/launch-office.mjs'],
  extraResources:[{from:'build/codex',to:'codex'}],
  mac:{category:'public.app-category.productivity',target:['dmg','zip'],icon:'build/icon.png',hardenedRuntime:true,entitlements:'build/entitlements.mac.plist',entitlementsInherit:'build/entitlements.mac.plist',notarize:process.env.PX_NOTARIZE==='1'},
  win:{target:['nsis'],icon:'build/icon.png'},
  nsis:{include:'build/installer.nsh',oneClick:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true},
  linux:{maintainer:process.env.PX_MAINTAINER||'PXagents <maintainer@example.invalid>',target:['AppImage','deb'],category:'Office',icon:'build/icon.png'},
};
