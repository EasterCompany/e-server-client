'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {update,selected,validate,compare,staged,activateStaged}=require('../desktop/updater.cjs');
const body=Buffer.from('a complete fixture ASAR payload'),digest=crypto.createHash('sha256').update(body).digest('hex');
const manifest={schema:1,bootstrap:1,version:'1.0.1',platform:'linux',arch:'x64',runtime:'44.7.2',asset:'Easter-e-server-Update-linux-x64.asar',sha256:digest,size:body.length};
test('update manifests refuse wrong identity, paths, runtime, size and checksum shapes',()=>{
 for(const change of [{asset:'../../file'},{runtime:'1.0.0'},{size:0},{sha256:'bad'},{platform:'win32'}])assert.throws(()=>validate({...manifest,...change},{release:'1.0.1',platform:'linux',arch:'x64',runtime:'44.7.2'}));
 assert.throws(()=>compare('1.0.0-beta','1.0.0'));assert.equal(compare('1.0.1','1.0.0'),1);
});
test('stage, verify and activate atomically; a corrupted saved payload never loads',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'eserver-update-'));try{
  const fetch=async url=>url.endsWith('.json')?new Response(JSON.stringify(manifest)):new Response(body);
  await update({current:'1.0.0',platform:'linux',arch:'x64',runtime:'44.7.2',root,fetch,apply:false});
  assert.equal(selected(root,{bundled:'1.0.0',runtime:'44.7.2',platform:'linux'}),null);
  assert.equal(staged(root,{current:'1.0.0',runtime:'44.7.2',platform:'linux'}).version,'1.0.1');
  await activateStaged({current:'1.0.0',root,runtime:'44.7.2',platform:'linux'});
  const file=selected(root,{bundled:'1.0.0',runtime:'44.7.2',platform:'linux'});assert.ok(file);
  await fs.writeFile(file,Buffer.alloc(body.length));assert.equal(selected(root,{bundled:'1.0.0',runtime:'44.7.2',platform:'linux'}),null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('failed downloads cannot replace the active update receipt',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'eserver-update-'));try{
  const fetch=async url=>url.endsWith('.json')?new Response(JSON.stringify(manifest)):new Response('wrong bytes');
  await assert.rejects(update({current:'1.0.0',platform:'linux',arch:'x64',runtime:'44.7.2',root,fetch}));
  assert.deepEqual(await fs.readdir(root),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
