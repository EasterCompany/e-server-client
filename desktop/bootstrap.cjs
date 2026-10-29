'use strict';
const {app}=require('electron'),path=require('node:path');
const {selected}=require('./updater.cjs');
const bundled=require('../package.json').version;
const root=path.join(app.getPath('appData'),'Easter Company','e-server-client','updates');
function inspect(file,manifest){const pkg=require(file+'/package.json');if(pkg.name!=='easter-eserver-client'||pkg.version!==manifest.version)throw Error('The e-server update identity is invalid.');}
const payload=app.isPackaged?selected(root,{bundled,runtime:process.versions.electron,inspect}):null;
if(payload){app.setAppPath(payload);require(payload+'/desktop/main.cjs');}else require('./main.cjs');
