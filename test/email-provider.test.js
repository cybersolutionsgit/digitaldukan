import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {sendAccountEmail} from '../email.js';
const originalFetch=globalThis.fetch;
const names=['NODE_ENV','APP_URL','RESEND_API_KEY','MAIL_FROM'];
const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
before(()=>{process.env.NODE_ENV='production';process.env.APP_URL='https://example.com';process.env.RESEND_API_KEY='synthetic-test-key';process.env.MAIL_FROM='Digital Dukan <onboarding@resend.dev>';});
after(()=>{globalThis.fetch=originalFetch;for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}});
const send=()=>sendAccountEmail({to:'owner@example.com',kind:'verify',token:'a'.repeat(64),dataDir:'/unused'});
test('testing-recipient rejection gives a specific action without forwarding provider data',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({message:'You can only send testing emails to your own email address (private@example.com). To send emails to other recipients, please verify a domain.'}),{status:403});
 await assert.rejects(send(),error=>/testing emails can only go/.test(error.message)&&!error.message.includes('private@example.com'));
});
test('unverified sender, invalid key and usage limits have distinct instructions',async()=>{
 for(const [status,message,expected]of [[403,'The example.com domain is not verified.',/sender domain is not verified/],[401,'API key is invalid',/API key/],[429,'Too many requests',/sending limit reached/]]){
  globalThis.fetch=async()=>new Response(JSON.stringify({message}),{status});await assert.rejects(send(),expected);
 }
});
test('unknown or non-JSON provider errors expose only HTTP status',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({message:'sensitive-token-'+ 'a'.repeat(64)}),{status:400});
 await assert.rejects(send(),error=>error.message.includes('HTTP 400')&&!error.message.includes('sensitive-token'));
 globalThis.fetch=async()=>new Response('<html>gateway</html>',{status:502});await assert.rejects(send(),/HTTP 502/);
});
test('successful send uses the configured canonical URL and HTTPS endpoint',async()=>{
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const body=JSON.parse(options.body);assert.deepEqual(body.to,['owner@example.com']);assert.match(body.text,/https:\/\/example.com\/verify-email#token=/);return new Response('{}',{status:200})};
 await send();
});
