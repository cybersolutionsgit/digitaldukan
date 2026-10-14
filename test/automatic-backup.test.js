import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('automatic startup backup runs without an admin click', { timeout: 80000 }, async () => {
 const dir=mkdtempSync(join(tmpdir(),'dukan-auto-backup-'));
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3483',DATA_DIR:dir,NODE_ENV:'test',AUTO_BACKUPS:'true',ADMIN_EMAIL:'auto@example.com',ADMIN_PASSWORD:'Auto-test-password-123'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  const started=Date.now();let names=[];
  while(Date.now()-started<70000){
   const folder=join(dir,'backups');
   names=existsSync(folder)?readdirSync(folder).filter(n=>n.endsWith('.tar.gz')):[];
   if(names.length)break;
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.equal(names.length,1,'automatic backup should complete after the startup delay');
 }finally{
  if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()});
  rmSync(dir,{recursive:true,force:true});
 }
});
