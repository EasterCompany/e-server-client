'use strict';
// The rename bridge, held to one rule. Every published build up to 1.0.2 refuses a payload whose
// package name is not the old literal, so 1.0.3 has to accept BOTH names or the machines in the
// field can never be handed the renamed release. This is that rule, and the check that both
// shipped guards actually defer to it - a single guard left comparing a literal is exactly the
// defect the bridge exists to prevent.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {identifies,PAYLOAD_NAMES}=require('../desktop/updater.cjs');

test('a payload is this client\'s own while the name is on either side of the rename',()=>{
 const manifest={version:'1.0.4'};
 // The old name stays first on purpose: 1.0.3 publishes it, and 1.0.5 is the earliest release
 // that may drop it.
 assert.deepEqual(PAYLOAD_NAMES,['easter-eserver-client','easter-server-client']);
 assert.equal(identifies({name:'easter-eserver-client',version:'1.0.4'},manifest),true);
 assert.equal(identifies({name:'easter-server-client',version:'1.0.4'},manifest),true);
});

test('the widening is the NAME only: version, foreign names and missing parts still refuse',()=>{
 const manifest={version:'1.0.4'};
 assert.equal(identifies({name:'easter-server-client',version:'1.0.3'},manifest),false);
 assert.equal(identifies({name:'easter-company-launcher',version:'1.0.4'},manifest),false);
 assert.equal(identifies({name:'easter-server-client'},manifest),false);
 assert.equal(identifies({},manifest),false);
 assert.equal(identifies(null,manifest),false);
 assert.equal(identifies({name:'easter-server-client',version:'1.0.4'},null),false);
});

test('both shipped guards ask the one rule, so the rename cannot land in one of them only',()=>{
 const read=file=>fs.readFileSync(path.join(__dirname,'..','desktop',file),'utf8');
 const main=read('main.cjs'),bootstrap=read('bootstrap.cjs'),updater=read('updater.cjs');
 // main.cjs refuses an activation, bootstrap.cjs refuses a staged payload on the next start.
 assert.match(main,/if\(!updater\.identifies\(pkg,manifest\)\)throw Error\('Invalid e-server client update\.'\)/);
 assert.match(bootstrap,/if\(!identifies\(pkg,manifest\)\)throw Error\('The e-server update identity is invalid\.'\)/);
 assert.match(bootstrap,/const \{selected,identifies\}=require\('\.\/updater\.cjs'\)/);
 assert.match(updater,/const PAYLOAD_NAMES=\['easter-eserver-client','easter-server-client'\]/);
 // No guard may name one package again: a literal comparison is what rejects a renamed payload.
 assert.doesNotMatch(main,/pkg\.name!=='easter-eserver-client'/);
 assert.doesNotMatch(bootstrap,/pkg\.name!=='easter-eserver-client'/);
});
