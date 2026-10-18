// Shared, deterministic color roles. No per-store builds or remote color service.
export const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function mix(a,b,weight){return '#'+rgb(a).map((v,i)=>Math.round(v*(1-weight)+rgb(b)[i]*weight).toString(16).padStart(2,'0')).join('');}
const luminance=hex=>rgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readable(preferred,background,ratio=4.5){
 if(contrast(preferred,background)>=ratio)return preferred;
 const end=contrast('#101820',background)>contrast('#ffffff',background)?'#101820':'#ffffff';
 for(let i=1;i<=20;i++){const candidate=mix(preferred,end,i/20);if(contrast(candidate,background)>=ratio)return candidate;}
 return contrast('#000000',background)>contrast('#ffffff',background)?'#000000':'#ffffff';
}
export function storePalette(details={},theme={}){
 const primary=validColor(details.accent)?details.accent:theme.accent||'#075e47';
 const background=mix(primary,'#ffffff',.92),surface=mix(primary,'#ffffff',.985);
 const secondary=validColor(details.secondaryColor)?details.secondaryColor:mix(primary,'#101820',.3);
 let banner=secondary;
 if(contrast(banner,background)<1.6){for(let i=1;i<=20;i++){banner=mix(secondary,'#101820',i/20);if(contrast(banner,background)>=1.6)break;}}
 const requestedText=validColor(details.textColor)?details.textColor:theme.ink||'#1c3028';
 const text=readable(requestedText,background),surfaceText=readable(text,surface);
 // Both the page and white card surfaces must remain readable.
 const ink=readable(surfaceText,background),bannerInk=readable(requestedText,banner);
 const actionInk=readable('#ffffff',primary),brandInk=readable(primary,background);
 const bannerAction=contrast(primary,banner)>=1.6?primary:bannerInk;
 return {primary,secondary,background,surface,ink,banner,bannerInk,actionInk,brandInk,
  muted:readable(mix(ink,background,.2),background),bannerAction,bannerActionInk:readable('#ffffff',bannerAction),
  border:mix(primary,'#ffffff',.75),photoOverlay:mix(banner,'#000000',.7)+'d9',
  adjusted:banner.toLowerCase()!==secondary.toLowerCase()||ink.toLowerCase()!==requestedText.toLowerCase()||bannerInk.toLowerCase()!==requestedText.toLowerCase()};
}
export function paletteStyle(p){return `--brand:${p.primary};--store-bg:${p.background};--store-surface:${p.surface};--store-ink:${p.ink};--store-muted:${p.muted};--store-secondary:${p.banner};--banner-ink:${p.bannerInk};--brand-ink:${p.brandInk};--action-ink:${p.actionInk};--banner-action:${p.bannerAction};--banner-action-ink:${p.bannerActionInk};--store-border:${p.border};--photo-overlay:${p.photoOverlay}`;}
