import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {categoryKits} from '../public/catalog.js';
import {sampleProductsFor} from '../public/samples.js';
import {renderStoreSection} from '../public/store-renderer.js';
import {isServiceStore} from '../public/store-mode.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tools={esc,money:x=>'PKR '+x,artwork:()=>'<div class="niche-art"></div>'};
const details={theme:'fashion',name:'Example',whatsapp:'923001234567',delivery:250};
test('featured-section introduction never replaces a product description or name',()=>{
 const items=[{id:'p1',details:{name:'Actual product',description:'Original product details.',category:'Clothing',price:100,stock:null,images:[],sizes:'',colors:''}}];
 const html=renderStoreSection({type:'featured',layout:5,title:'Collection title',text:'Section introduction <safe>'},details,items,tools);
 assert.ok(html.includes('Section introduction &lt;safe&gt;'));assert.ok(html.includes('Original product details.'));assert.ok(html.includes('Actual product'));assert.ok(html.indexOf('Section introduction')<html.indexOf('store-product-grid'));assert.ok(!html.includes('<safe>'));
});
test('all category sample catalogues use local existing media within the asset budgets',()=>{
 let photos=0;for(const kit of categoryKits){const sample=sampleProductsFor({theme:kit.id,businessMode:'retail'});assert.equal(sample.length,4);for(const p of sample){assert.ok(p.details.name);assert.ok(p.details.category);for(const image of p.details.images){assert.match(image,/^\/stock\/[a-z0-9-]+\.webp$/);assert.ok(existsSync('public'+image),image);assert.ok(statSync('public'+image).size<(image.startsWith('/stock/product-')?500000:700000));photos++;}}}assert.ok(photos>100);
 assert.deepEqual(sampleProductsFor({theme:'fashion'}).map(p=>p.details.images[0]),['/stock/product-tshirt.webp','/stock/product-shirt.webp','/stock/product-jeans.webp','/stock/product-wrap.webp']);
 assert.deepEqual(sampleProductsFor({theme:'bakery'}).map(p=>p.details.images[0]),['/stock/product-cake.webp','/stock/product-cookies.webp','/stock/bakery.webp','/stock/product-brownies.webp']);
});
test('service language has no physical fulfilment promises and explicit retail mode wins',()=>{
 assert.equal(isServiceStore({theme:'digital'}),true);assert.equal(isServiceStore({theme:'digital',businessMode:'retail'}),false);assert.equal(isServiceStore({theme:'fashion',businessMode:'enquiry'}),true);
 const service={...details,theme:'digital'};for(const type of ['hero','featured','benefits','contact']){const html=renderStoreSection({type,layout:4},service,sampleProductsFor(service),tools);assert.ok(!html.includes('Cash on delivery'));assert.ok(!html.includes('Fixed delivery:'));assert.ok(!html.includes('Delivered to you'));}
 const html=renderStoreSection({type:'hero',layout:1},{...service,businessMode:'retail'},[],tools);assert.ok(html.includes('Cash on delivery'));
});
