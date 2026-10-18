// Build-time only: a shared, bounded photo set. Never runs for signup or page requests.
import {categoryKits} from '../public/catalog.js';
import {localStock} from '../public/stock-manifest.js';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const manifest={...localStock};let failed=0;
await mkdir('public/stock',{recursive:true});
for(const kit of categoryKits){
 if(manifest[kit.id]){console.log(kit.id+': already cached');continue;}
 const url=`https://images.unsplash.com/photo-${kit.photo}?fit=crop&w=1200&q=76&fm=webp`;
 try{
  // curl respects the environment HTTPS proxy, keeps TLS verification enabled, and bounds time/size.
  const {stdout:bytes}=await run('curl',['--fail','--silent','--show-error','--max-time','20','--max-filesize','700000',url],{encoding:'buffer',maxBuffer:750000});
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Provider did not return a WebP image');
  const path='public/stock/'+kit.id+'.webp';await writeFile(path+'.tmp',bytes);await rename(path+'.tmp',path);manifest[kit.id]='/stock/'+kit.id+'.webp';console.log(kit.id+': cached '+Math.round(bytes.length/1024)+' KB');
 }catch{failed++;console.error(kit.id+': download unavailable; existing photos preserved');}
}
await writeFile('public/stock-manifest.js','// Shared optimized stock images; see docs/STOCK_PHOTOS.md.\nexport const localStock = '+JSON.stringify(manifest,null,2)+';\n');
console.log(Object.keys(manifest).length+' of '+categoryKits.length+' category photos cached locally.');
if(failed)process.exitCode=1;
