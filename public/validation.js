// Shared browser/server rules so signup steps agree with final submission.
export const emailValid=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const reserved=new Set(['admin','api','www','dashboard','login','signup','store','digitaldukan','templates','demo','forgot-password','reset-password','verify-email','mail','smtp','ftp','assets','uploads','stock']);
export function usernameIssue(value){
 if(!/^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/.test(value))return 'Use 4–40 small letters or numbers. A dash (-) can go in the middle. No spaces.';
 if(reserved.has(value))return 'This username is reserved. Pick another name.';
 return '';
}
export function normalizeSocialLink(value){
 const raw=String(value??'').trim();if(!raw)return '';
 const invalid=()=>{throw Error('Use a full link, like instagram.com/myshop. Do not add spaces.');};
 if(raw.length>2000||/\s|\\/.test(raw))invalid();
 let candidate=raw;if(candidate.startsWith('//'))candidate='https:'+candidate;else if(!/^[a-z][a-z0-9+.-]*:/i.test(candidate))candidate='https://'+candidate;
 let url;try{url=new URL(candidate)}catch{invalid()}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||url.hostname.startsWith('.')||url.hostname.endsWith('.')||!url.hostname.split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)))invalid();
 return url.href;
}
