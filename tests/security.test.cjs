'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {serverOrigin,externalURL,connectionLink,trusted,updateLevel}=require('../desktop/security.cjs');
test('server address is a private connection choice, never arbitrary navigation or credentials',()=>{
 assert.equal(serverOrigin('https://server.example:8443/'),'https://server.example:8443');
 for(const url of ['http://example.com','file:///etc/passwd','javascript:alert(1)','https://user:password@example.com','https://example.com/path','https://example.com/?token=x'])assert.throws(()=>serverOrigin(url));
 assert.throws(()=>serverOrigin('http://localhost:1234'));
 assert.equal(serverOrigin('http://localhost:1234',{development:true}),'http://localhost:1234');
});
test('deep links validate the target server and external links use HTTPS only',()=>{
 assert.equal(connectionLink('e-server://connect?server=https%3A%2F%2Fserver.example'),'https://server.example');
 for(const url of ['e-server://run?command=x','e-server://connect?server=file:///etc/passwd'])assert.throws(()=>connectionLink(url));
 assert.throws(()=>externalURL('file:///etc/passwd'));assert.throws(()=>externalURL('https://user:pass@host/'));
});
test('only the configured main frame can call native capabilities',()=>{
 const frame={url:'https://server.example/account'},sender={mainFrame:frame};
 assert.equal(trusted({sender,senderFrame:frame},'https://server.example'),true);
 assert.equal(trusted({sender,senderFrame:{url:frame.url}},'https://server.example'),false);
 assert.equal(trusted({sender,senderFrame:frame},'https://other.example'),false);
});
test('version policies preserve patch state, clear minor cache and major sessions',()=>{
 assert.equal(updateLevel('1.0.0','1.0.1'),'patch');assert.equal(updateLevel('1.0.1','1.1.0'),'minor');assert.equal(updateLevel('1.1.0','2.0.0'),'major');
});
