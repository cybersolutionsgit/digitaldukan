// One shared control for public pages, dashboards, long dialogs and the live editor.
const controls=document.createElement('div');controls.className='page-scroll-controls';controls.hidden=true;
controls.innerHTML='<button type="button" data-scroll-edge="top" aria-label="Scroll to top" title="Scroll to top">↑</button><button type="button" data-scroll-edge="bottom" aria-label="Scroll to bottom" title="Scroll to bottom">↓</button>';
document.body.append(controls);
let panel=null,queued=false;
const overflowing=el=>el&&el.isConnected&&el.clientHeight>0&&el.scrollHeight>el.clientHeight+40;
function target(){const modal=document.querySelector('.modal-backdrop .modal');if(modal)return overflowing(modal)?modal:null;return overflowing(panel)?panel:document.scrollingElement;}
function refresh(){queued=false;const el=target(),long=overflowing(el);controls.hidden=!long;if(!long)return;
 const roman=localStorage.getItem('dd-language')==='roman'&&!document.querySelector('#app > .storefront');
 for(const button of controls.children){const bottom=button.dataset.scrollEdge==='bottom',label=bottom?(roman?'Page ke aakhir mein jayein':'Scroll to bottom'):(roman?'Page ke shuru mein jayein':'Scroll to top');button.setAttribute('aria-label',label);button.title=label;button.hidden=bottom?el.scrollHeight-el.clientHeight-el.scrollTop<=8:el.scrollTop<=8;}
 controls.dataset.scrollTarget=el===document.scrollingElement?'page':'panel';
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
controls.addEventListener('click',event=>{const button=event.target.closest('button'),el=target();if(!button||!el)return;el.scrollTo({top:button.dataset.scrollEdge==='bottom'?el.scrollHeight:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});schedule();});
document.addEventListener('scroll',event=>{if(event.target===document)panel=null;else if(event.target instanceof Element&&overflowing(event.target))panel=event.target;schedule();},{capture:true,passive:true});
document.addEventListener('pointerdown',event=>{if(event.target.closest('.page-scroll-controls'))return;panel=event.target.closest('.studio-preview-wrap,.modal');schedule();},{passive:true});
document.addEventListener('focusin',event=>{if(!event.target.closest('.page-scroll-controls')){panel=event.target.closest('.studio-preview-wrap,.modal');schedule();}});
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
new ResizeObserver(schedule).observe(document.body);window.addEventListener('resize',schedule,{passive:true});schedule();
