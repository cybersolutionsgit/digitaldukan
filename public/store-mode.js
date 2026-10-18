// Shared by storefront and server. Theme alone never overrides an explicit owner choice.
export function isServiceStore(details={}){
 if(details.businessMode==='retail')return false;
 if(details.businessMode==='enquiry')return true;
 return details.theme==='digital'||details.category==='Digital products & creative services';
}
