import {homepageRecipes,contextualPhoto} from './catalog.js';
export {homepageRecipes};
export const layoutLabels={
 hero:['Editorial split','Centered campaign','Photo first','Immersive cover','Magazine collage'],
 categories:['Collection tiles','Centered collection','Split collection','Photo grid','Collection index'],
 featured:['Three-column edit','Two-column boutique','Four-column gallery','Spotlight collection','Magazine collection'],
 offers:['Editorial offer','Centered campaign','Accent campaign','Photo campaign','Split promotion'],
 about:['Editorial story','Centered story','Photo-first story','Full-bleed story','Magazine story'],
 reviews:['Feedback invitation','Centered invitation','Side-note invitation','Photo invitation','Conversation card'],
 benefits:['Three cards','Soft-panel cards','Stacked highlights','Photo & highlights','Numbered highlights'],
 contact:['Contact & delivery','Centered contact','Soft-panel contact','Photo & contact','Contact directory']
};
export function enhanceSection(markup,section,details,esc){
 const theme=details.theme||'classic';
 if(theme==='classic'&&!section.image&&section.layout<4)return markup;
 const context=contextualPhoto(theme,section.type);
 const url=section.image||details.banner||context.url;
 const isStock=!section.image&&!details.banner||/^https:\/\/images\.unsplash\.com\//.test(url)||url.startsWith('/stock/');
 const alt=section.image?section.imageAlt||'Store photograph':details.banner?details.name+' collection':context.alt;
 const image=`<figure class="kit-media"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async" style="--photo-position:${section.imagePosition||'center'};--photo-mobile-position:${section.mobileImagePosition||section.imagePosition||'center'}"><figcaption>${isStock?'Illustrative stock photograph':''}</figcaption></figure>`;
 if(!markup.includes('data-section='))markup=markup.replace('<section ',`<section data-section="${section.type}" `);
 if(section.type==='hero'){
  const marker='</div></div>';
  const copyEnd=markup.indexOf(marker);
  if(copyEnd>=0)markup=markup.slice(0,copyEnd+marker.length)+image+'</section>';
 }else if(section.type==='featured'){
  if(section.image)markup=markup.replace('<div class="store-product-grid">',image+'<div class="store-product-grid">');
 }else if(section.type==='categories'){
  markup=markup.replace('<div class="category-list">',image+'<div class="category-list">');
 }else{
  markup=markup.replace('</section>',image+'</section>');
 }
 return markup;
}
