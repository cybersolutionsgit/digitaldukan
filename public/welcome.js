// A short, local celebration: no libraries, network requests or persistent loops.
export function celebrateSignup(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const layer=document.createElement('div');layer.className='welcome-confetti';layer.setAttribute('aria-hidden','true');
 const colors=['#075e47','#d7b56d','#65c9a8','#f5a0b5','#8c88d8'];
 for(let i=0;i<48;i++){
  const piece=document.createElement('i'),side=i%2?-1:1;
  piece.style.cssText=`--x:${side===1?4:96}vw;--travel:${side*(12+Math.random()*43)}vw;--fall:${20+Math.random()*65}vh;--spin:${side*(180+Math.random()*540)}deg;--delay:${Math.random()*.45}s;--duration:${1.8+Math.random()*1.2}s;background:${colors[i%colors.length]};border-radius:${i%3===0?'50%':'2px'}`;
  piece.addEventListener('animationend',()=>{piece.remove();if(!layer.childElementCount)layer.remove();},{once:true});layer.append(piece);
 }
 document.body.append(layer);
 // Also clear if animations are interrupted by a preference change or navigation.
 setTimeout(()=>layer.remove(),4000);
}
export async function copyStoreLink(link){
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(link);return;}}catch{}
 const input=document.createElement('textarea');input.value=link;input.setAttribute('readonly','');input.style.cssText='position:fixed;top:0;left:-9999px';document.body.append(input);
 const previous=document.activeElement;let copied=false;
 try{input.select();copied=document.execCommand('copy');}finally{input.remove();previous?.focus();}
 if(!copied){const visible=document.querySelector('#welcome-store-link');visible?.focus();visible?.select();throw Error('Copy did not work. Select and copy your website link.');}
}
