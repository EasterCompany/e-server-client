'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pkg=require('../package.json'),platform=process.argv[2];
if(!['linux','win32'].includes(platform))throw Error('Choose linux or win32');
const source=path.join(__dirname,'../release',platform==='linux'?'linux-unpacked':'win-unpacked','resources/app.asar');
const bytes=fs.readFileSync(source),base='Easter-e-server-Update-'+platform+'-x64';
const header=JSON.parse(bytes.subarray(16,16+bytes.readUInt32LE(12)).toString('utf8'));
const dataOffset=8+bytes.readUInt32LE(4),members=new Map();
function walk(files,prefix=''){for(const [name,item] of Object.entries(files)){const full=prefix+name;if(item.files)walk(item.files,full+'/');else{if(item.unpacked||name.endsWith('.node'))throw Error('Native or unpacked code requires a full runtime installer.');members.set(full,item);}}}
walk(header.files);
function read(name){const item=members.get(name);if(!item)throw Error('Packaged app is missing '+name);return bytes.subarray(dataOffset+Number(item.offset),dataOffset+Number(item.offset)+item.size);}
const packaged=JSON.parse(read('package.json'));
if(packaged.name!==pkg.name||packaged.version!==pkg.version||packaged.main!=='desktop/bootstrap.cjs')throw Error('Packaged application identity differs from source.');
function verify(directory,prefix='desktop/'){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())verify(file,prefix+entry.name+'/');else if(!read(prefix+entry.name).equals(fs.readFileSync(file)))throw Error('Stale packaged source: '+prefix+entry.name);}}
verify(path.join(__dirname,'../desktop'));
fs.copyFileSync(source,path.join(__dirname,'../release',base+'.asar'));
const manifest={schema:1,bootstrap:1,version:pkg.version,platform,arch:'x64',runtime:pkg.devDependencies.electron,asset:base+'.asar',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
fs.writeFileSync(path.join(__dirname,'../release',base+'.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Verified update payload:',base,manifest.sha256);
