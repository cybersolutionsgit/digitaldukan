import {localStock} from './stock-manifest.js';
// Shared category metadata and stock references. No generation API or per-store assets.
export const categoryKits = [
 ['fashion','Fashion & accessories','Studio Edit','#8f3651','Style that feels like you.','1483985988355-763728e1935b','Fashion editorial with shoppers','Everyday kurta|Signature tote|Summer scarf|Classic shirt'],
 ['home','Home & living','Everyday Home','#496747','Make room for lovely living.','1600210492486-724fe5c67fb0','Warm living room interior','Ceramic bowl|Linen cushion|Scented candle|Everyday vase'],
 ['beauty','Beauty & care','Glow & Care','#795383','A little care. A daily ritual.','1596462502278-27bfdc403348','Beauty and skincare products','Daily cleanser|Hand cream|Care essentials|Body wash'],
 ['food','Food & groceries','Fresh Pantry','#a6471d','Good food. Everyday favorites.','1542838132-92c53300491e','Fresh grocery market','Sourdough loaf|Date cookies|Fresh produce|Everyday pantry'],
 ['electronics','Electronics','Circuit Store','#2452b5','Find your next everyday upgrade.','1498049794561-7780e7231661','Electronics workspace','Wireless headphones|Phone accessories|Desk essentials|Smart watch'],
 ['handmade','Handmade & gifts','Craft & Story','#9c5c31','Small details. A personal touch.','1452860606245-08befc0ff44b','Creative craft workspace','Woven bag|Handmade mug|Gift box|Personalized print'],
 ['jewelry','Jewelry & watches','Golden Hour','#886532','Details worth keeping.','1617038220319-276d3cfab638','Jewelry collection','Pendant|Everyday studs|Classic watch|Signature ring'],
 ['footwear','Shoes & footwear','The Next Step','#66534b','Find your everyday stride.','1542291026-7eec264c27ff','Red sneakers','Everyday sneakers|Leather sandals|Classic flats|Weekend shoes'],
 ['bags','Bags & leather goods','Carry Studio','#6f4937','Carry a little character.','1553062407-98eeb64c6a62','Navy fabric backpack','Everyday tote|Crossbody bag|Card holder|Travel bag'],
 ['kids','Kids & baby','Little Days','#727044','For their little everyday.','1519689680058-324335c77eba','Baby wearing sunglasses on a colorful swim ring','Baby essentials|Cotton set|Play mat|Little blanket'],
 ['toys','Toys & games','Playful Things','#a34e36','Make room for play.','1558060370-d644479cb6f7','Children toys','Building blocks|Board game|Soft toy|Creative kit'],
 ['books','Books & stationery','Paper Chapter','#555b7b','Your next chapter starts here.','1507842217343-583bb7270b66','Library bookshelves','Notebook|Reading journal|Weekly planner|Book collection'],
 ['sports','Sports & fitness','Move Everyday','#386454','Made for your next move.','1517836357463-d25dfeac3438','Person exercising in a gym','Training mat|Resistance band|Sports bottle|Workout bag'],
 ['outdoors','Outdoor & travel','Open Trails','#536748','Take the scenic route.','1464822759023-fed622ff2c3b','Mountain landscape','Day pack|Travel organizer|Camping light|Trail essentials'],
 ['pets','Pet supplies','Good Companions','#88603d','For the ones with paws.','1450778869180-41d0601e046e','Dog and cat outdoors','Pet bowl|Soft bed|Everyday lead|Play toy'],
 ['plants','Plants & gardening','Root & Leaf','#386340','Bring a little green home.','1416879595882-3373a0480b5b','Gardening and potted plants','Indoor plant|Ceramic planter|Garden tools|Plant care kit'],
 ['furniture','Furniture','Form & Space','#71614b','Good living starts with good design.','1555041469-a586c61ea9bc','Modern sofa and furniture','Accent chair|Side table|Lounge sofa|Wooden shelf'],
 ['kitchen','Kitchen & dining','Gather Around','#8d573a','Everyday moments, beautifully served.','1556911220-bff31c812dba','Bright kitchen with cookware and fresh produce','Dinner set|Serving bowl|Kitchen tools|Coffee cup'],
 ['bakery','Bakery & desserts','Butter & Crumb','#985b3d','A little joy, freshly baked.','1509440159596-0249088772ff','Fresh bread and bakery','Celebration cake|Cookie box|Fresh loaf|Brownie tray'],
 ['coffee','Coffee & tea','Slow Mornings','#6f4d3c','Make time for a better cup.','1447933601403-0c6688de566e','Roasted coffee beans','Coffee blend|Loose leaf tea|Brewing set|Everyday mug'],
 ['restaurant','Restaurant & catering','At the Table','#914a32','Good company. Great food.','1414235077428-338989a2e8c0','Restaurant dining','Family platter|Lunch box|Party menu|House special'],
 ['wellness','Health & wellness','Well Within','#577563','Small rituals for everyday wellbeing.','1544367567-0f2fcb009e0b','People practicing yoga','Wellness journal|Care bundle|Relaxation kit|Daily essentials'],
 ['salon','Salon & grooming','The Care Studio','#765569','Make time for yourself.','1560066984-138dadb4c035','Salon interior','Hair care set|Grooming kit|Styling essentials|Care collection'],
 ['art','Art & photography','Frame of Mind','#71545d','Make space for a new perspective.','1579783902614-a3fb3927b6a5','Artwork and painting','Art print|Canvas piece|Photo collection|Custom frame'],
 ['automotive','Auto & motorcycle','Road Ready','#4a5969','Everyday essentials for the road.','1492144534655-ae79c964c9d7','Car on the road','Car care kit|Seat accessory|Phone mount|Travel organizer'],
 ['tools','Hardware & tools','Made to Work','#8b602e','Ready for your next project.','1504148455328-c376907d081c','Workshop tools','Tool set|Safety gloves|Measuring tape|Repair essentials'],
 ['office','Office & business supplies','Work in Order','#425d79','A little more order. A better workday.','1497366811353-6870744d04b2','Modern office interior','Desk organizer|Office chair|Writing set|Work essentials'],
 ['events','Wedding & celebrations','The Occasion','#9a6170','Make the moment yours.','1519741497674-611481863552','Wedding celebration','Celebration decor|Invitation set|Gift favors|Table details'],
 ['digital','Digital products & creative services','Independent Studio','#6557a5','Good ideas deserve a beautiful space.','1522071820081-009f0129c71c','People collaborating in a creative studio','Design package|Print bundle|Custom artwork|Creative collection'],
 ['other','Other','Clean Essentials','#075e47','Discover what makes us yours.','1441986300917-64674bd600d8','Independent retail store','Everyday essential|Customer favorite|New arrival|Signature collection']
].map(([id,category,name,accent,heading,photo,alt,samples])=>({id,category,name,accent,heading,photo,alt,samples:samples.split('|')}));
export const stockImage = (key,width=1000) => {
 const kit=categoryKits.find(k=>k.id===key)||categoryKits.at(-1);
 if(localStock[kit.id])return localStock[kit.id];
 return `https://images.unsplash.com/photo-${kit.photo}?auto=format&fit=crop&w=${width}&q=75`;
};
export const homepageRecipes=[
 {name:'Editorial',description:'A photo-led story with a considered product edit.',layouts:[1,1,1,1,1,1,1,1]},
 {name:'Boutique',description:'Centered statements and a generous two-column collection.',layouts:[2,2,2,2,2,2,2,2]},
 {name:'Gallery',description:'Image-first sections and a compact product gallery.',layouts:[3,3,3,3,3,3,3,3]},
 {name:'Signature',description:'Immersive photography and a strong split composition.',layouts:[4,4,4,4,4,4,4,4]},
 {name:'Modern',description:'A graphic magazine layout with rounded visual details.',layouts:[5,5,5,5,5,5,5,5]}
];

// Reuse relevant photos from the shared collection rather than repeating a hero everywhere.
const relatedPhotos={
 fashion:['fashion','bags','jewelry','footwear'],home:['home','furniture','plants','kitchen'],beauty:['beauty','salon','wellness','beauty'],food:['food','bakery','coffee','restaurant'],electronics:['electronics','office','tools','digital'],handmade:['handmade','art','events','jewelry'],jewelry:['jewelry','fashion','bags','events'],footwear:['footwear','fashion','sports','outdoors'],bags:['bags','fashion','outdoors','office'],kids:['kids','toys','books','home'],toys:['toys','kids','books','handmade'],books:['books','office','handmade','art'],sports:['sports','wellness','outdoors','footwear'],outdoors:['outdoors','bags','sports','plants'],pets:['pets','home','outdoors','pets'],plants:['plants','home','outdoors','kitchen'],furniture:['furniture','home','office','kitchen'],kitchen:['kitchen','coffee','bakery','restaurant'],bakery:['bakery','kitchen','coffee','food'],coffee:['coffee','kitchen','bakery','restaurant'],restaurant:['restaurant','kitchen','food','coffee'],wellness:['wellness','sports','plants','home'],salon:['salon','beauty','fashion','wellness'],art:['art','handmade','home','books'],automotive:['automotive','tools','electronics','outdoors'],tools:['tools','handmade','automotive','office'],office:['office','electronics','books','digital'],events:['events','jewelry','art','restaurant'],digital:['digital','office','electronics','art'],other:['other','fashion','home','food']
};
export function contextualPhoto(key,section='hero',index=0){
 const related=relatedPhotos[key]||relatedPhotos.other;
 const position=section==='product'?index%4:({hero:0,categories:2,about:1,offers:1,reviews:0,benefits:3,contact:1}[section]??0);
 const kit=categoryKits.find(k=>k.id===related[position]);
 return {url:stockImage(kit.id,section==='product'?600:1200),alt:kit.alt};
}
