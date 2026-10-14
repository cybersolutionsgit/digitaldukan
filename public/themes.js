// Curated, local presets: no paid API, remote generation or per-store build.
const sections=(...rows)=>rows.map(([type,layout])=>({type,layout}));
export const themes={
 classic:{name:'Classic Dukan',category:'Other',accent:'#075e47',background:'#f8f9f4',ink:'#1c3028',heading:'Made for your everyday.',collection:'Find your next favorite.',art:'home',sections:sections(['hero',1],['featured',1],['benefits',1],['contact',1]),samples:['Ceramic bowl','Linen essentials','Scented candle','Everyday vase']},
 fashion:{name:'Studio Edit',category:'Fashion & accessories',accent:'#8f3651',background:'#fff7f7',ink:'#38252c',heading:'Style that feels like you.',collection:'Discover your next look.',art:'fashion',sections:sections(['hero',1],['categories',1],['featured',3],['offers',2],['benefits',1],['contact',1]),samples:['Everyday kurta','Signature tote','Summer scarf','Classic shirt']},
 home:{name:'Everyday Home',category:'Home & living',accent:'#496747',background:'#f8f6ed',ink:'#293829',heading:'Make room for lovely living.',collection:'Thoughtful pieces for your home.',art:'home',sections:sections(['hero',1],['categories',2],['featured',1],['about',1],['benefits',2],['contact',1]),samples:['Ceramic bowl','Linen cushion','Scented candle','Everyday vase']},
 beauty:{name:'Glow & Care',category:'Beauty & care',accent:'#795383',background:'#fbf5fc',ink:'#392d3e',heading:'Your everyday care, thoughtfully chosen.',collection:'Find your next routine essential.',art:'beauty',sections:sections(['hero',2],['categories',2],['featured',2],['about',2],['benefits',2],['contact',2]),samples:['Daily cleanser','Hand cream','Care essentials','Body wash']},
 food:{name:'Fresh Pantry',category:'Food & groceries',accent:'#a6471d',background:'#fff8ef',ink:'#423126',heading:'Good food. Everyday favorites.',collection:'Something delicious starts here.',art:'food',sections:sections(['hero',3],['categories',1],['featured',1],['offers',1],['benefits',1],['contact',1]),samples:['Sourdough loaf','Date cookies','Fresh produce','Everyday pantry']},
 electronics:{name:'Circuit Store',category:'Electronics',accent:'#2452b5',background:'#f2f6ff',ink:'#1c2d49',heading:'Find your next everyday upgrade.',collection:'Explore the latest essentials.',art:'electronics',sections:sections(['hero',1],['categories',3],['featured',3],['offers',3],['benefits',3],['contact',1]),samples:['Wireless headphones','Phone accessories','Desk essentials','Smart watch']},
 handmade:{name:'Craft & Story',category:'Handmade & gifts',accent:'#9c5c31',background:'#faf4e9',ink:'#453426',heading:'Small details. A personal touch.',collection:'Discover something thoughtfully made.',art:'handmade',sections:sections(['hero',3],['about',3],['featured',2],['categories',1],['benefits',2],['contact',3]),samples:['Woven bag','Handmade mug','Gift box','Personalized print']},
 other:{name:'Clean Essentials',category:'Other',accent:'#075e47',background:'#f5f9f6',ink:'#1c3028',heading:'Discover what makes us yours.',collection:'Explore our collection.',art:'other',sections:sections(['hero',1],['featured',1],['benefits',1],['contact',1]),samples:['Everyday essential','Customer favorite','New arrival','Signature collection']}
};
const keywords=[
 ['beauty',/\b(skincare|skin care|cosmetic|makeup|beauty|serum|perfume|salon|hair care)\b/i],
 ['food',/\b(food|grocery|groceries|bakery|baking|cake|cookies|bread|restaurant|snack|organic produce|mithai|khana)\b/i],
 ['electronics',/\b(electronics|phone|mobile|laptop|computer|gadget|headphone|charger|tech|gaming)\b/i],
 ['fashion',/\b(fashion|clothing|clothes|apparel|kurta|dress|shirt|abaya|jewellery|jewelry|shoe|footwear|kapray|kapre|garments)\b/i],
 ['home',/\b(home|furniture|decor|bedding|cushion|kitchen|ceramic|linen)\b/i],
 ['handmade',/\b(handmade|craft|gift|woven|personalized|personalised|artisan)\b/i]
];
export function themeForNiche(category='',niche=''){
 const match=keywords.find(([,pattern])=>pattern.test(String(niche).slice(0,200)));
 if(match)return match[0];
 return Object.keys(themes).find(key=>key!=='classic'&&themes[key].category===category)||'other';
}
export function themeForDetails(details){return themes[details.theme]||themes.classic;}
