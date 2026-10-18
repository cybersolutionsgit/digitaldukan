// Illustrative catalogue examples. Never inserted into an owner's actual inventory.
import {isServiceStore} from './store-mode.js';
import {contextualPhoto} from './catalog.js';
const photo=(key)=>'/stock/product-'+key+'.webp';
// Each photograph was decoded and visually checked against this item, not just a niche keyword.
const items={
 tshirt:['White cotton T-shirt','T-shirts',photo('tshirt'),'A plain white short-sleeved T-shirt.',1800],
 shirt:['White formal shirt','Shirts',photo('shirt'),'A white collared shirt styled with a tie.',2600],
 jeans:['Denim jeans','Denim',photo('jeans'),'Folded denim jeans in classic washes.',3200],
 wrap:['Cream knitted wrap','Knitwear',photo('wrap'),'A cream open-knit wrap on a hanger.',2400],
 vases:['Decorative vase set','Decor',photo('vases'),'A pair of pale vases styled with flowering stems.',2100],
 cushion:['White cushion','Soft furnishings',photo('cushion'),'A simple white cushion.',1400],
 candle:['Glass jar candle','Candles',photo('candle'),'A lit candle in a glass jar.',1200],
 dinnerware:['Ceramic dinnerware','Tableware',photo('dinnerware'),'Stacked ceramic plates and bowls.',3800],
 makeup:['Makeup essentials','Makeup','/stock/beauty.webp','Makeup brushes and cosmetic essentials.',2200],
 cream:['Care cream','Skin care',photo('skincare'),'An illustrative care-product tube.',1600],
 perfume:['Fragrance bottle','Fragrance',photo('perfume'),'A perfume bottle shown as an illustrative sample.',4500],
 dispenser:['Amber pump dispenser','Accessories',photo('soap'),'An amber bottle with a pump dispenser.',1100],
 broccoli:['Fresh broccoli','Vegetables',photo('broccoli'),'A fresh head of broccoli.',350],
 produce:['Fresh produce selection','Produce','/stock/food.webp','A market selection of fresh vegetables.',900],
 bread:['Seeded bread loaves','Bread','/stock/bakery.webp','Rustic bread loaves with seeded crusts.',650],
 coffee:['Roasted coffee beans','Coffee','/stock/coffee.webp','Roasted coffee beans.',1800],
 cookies:['Chocolate-chip cookies','Cookies',photo('cookies'),'Cookies with visible chocolate pieces.',950],
 cake:['Celebration cake','Cakes',photo('cake'),'A chocolate-frosted celebration cake.',3500],
 brownies:['Chocolate dessert slices','Chocolate treats',photo('brownies'),'Slices of chocolate dessert with chocolate sauce.',1200],
 headphones:['Over-ear headphones','Audio',photo('headphones'),'Black over-ear headphones on a yellow background.',4200],
 phone:['Smartphone','Phones',photo('phone'),'A smartphone with a touch-screen display.',28000],
 watch:['Minimal wristwatch','Watches',photo('watch'),'A minimalist watch with a pale strap.',3800],
 keyboard:['Desktop keyboard','Accessories',photo('keyboard'),'A light-colored desktop keyboard.',2600],
 craft:['Creative tool set','Craft supplies','/stock/handmade.webp','Craft tools, tapes and drawing supplies.',1700],
 artwork:['Floral art print','Art','/stock/art.webp','A floral still-life artwork.',2500],
 hoops:['Gold-tone jewelry set','Jewelry','/stock/jewelry.webp','A set of gold-colored jewelry.',1900],
 ring:['Solitaire-style ring','Rings',photo('ring'),'An illustrative ring with a prominent clear stone.',2400],
 bracelet:['Gold-tone bracelet','Bracelets',photo('bracelet'),'A gold-colored decorative bracelet.',2100],
 necklace:['Blue pendant necklace','Necklaces',photo('necklace'),'A blue pendant on a necklace.',2600],
 sneakers:['Red trainers','Trainers','/stock/footwear.webp','Red athletic shoes.',4200],
 whiteTrainers:['Brown trainers','Trainers',photo('browntrainers'),'Brown athletic footwear.',3900],
 shoes:['Green lace-up shoes','Lace-up shoes',photo('greenshoes'),'Green lace-up shoes.',4800],
 heels:['Floral heels','Heels',photo('heels'),'Blue floral-patterned high-heeled shoes.',3400],
 backpack:['Navy backpack','Backpacks','/stock/bags.webp','A navy fabric backpack.',2900],
 handbag:['Quilted handbag','Handbags',photo('handbag'),'An illustrative quilted handbag.',3500],
 shoulderbag:['Red handbag','Handbags',photo('shoulderbag'),'A red handled handbag.',3100],
 tote:['Woven handbag','Handbags',photo('wovenbag'),'A woven handbag with a tan handle and flap.',2400],
 babyoutfit:['Hooded baby outfit','Baby clothing',photo('babyclothes'),'A baby wearing a cozy hooded outfit.',1800],
 swimring:['Baby swim ring','Baby accessories','/stock/kids.webp','A baby using a colorful swim ring.',1200],
 toys:['Retro toy collection','Toys','/stock/toys.webp','Toy robots, vehicles and wooden toys.',1800],
 notebook:['Spiral notebook','Stationery',photo('notebook'),'A spiral notebook and pen.',550],
 book:['Poetry paperback','Books',photo('book'),'An illustrative poetry paperback.',950],
 yoga:['Exercise mat','Fitness','/stock/wellness.webp','An exercise mat shown in use.',1900],
 weights:['Barbell training set','Training','/stock/sports.webp','Weight-training equipment shown in use.',5200],
 petfood:['Dry pet food','Food',photo('petfood'),'A bowl of dry pet food.',1500],
 petbowl:['Pet feeding bowl','Feeding',photo('petfood'),'A blue pet-food bowl.',800],
 petbed:['Pet bed','Bedding','', 'An example item awaiting its own product photograph.',2200],
 petlead:['Pet lead','Accessories','', 'An example item awaiting its own product photograph.',950],
 succulent:['Potted succulent','Indoor plants',photo('indoorplant'),'A succulent in a pale green pot.',1300],
 garden:['Gardening essentials','Gardening','/stock/plants.webp','A garden trowel, soil and small plants.',1700],
 sofa:['Green sofa','Seating','/stock/furniture.webp','A green upholstered sofa.',42000],
 mug:['White ceramic mug','Drinkware',photo('cup'),'A plain white ceramic mug.',750],
 drill:['Cordless drill','Power tools','/stock/tools.webp','A red and black cordless drill.',6800],
 gloves:['Work gloves','Safety','', 'An example item awaiting its own product photograph.',650],
 measure:['Measuring tape','Hand tools','', 'An example item awaiting its own product photograph.',550],
 carcloth:['Car cleaning cloths','Car care','', 'An example item awaiting its own product photograph.',850],
 carkit:['Car cleaning kit','Car care','', 'An example item awaiting its own product photograph.',2200],
 giftbox:['Wrapped gift box','Gift packaging',photo('giftbox'),'A wrapped pink gift box with a ribbon.',650],
 giftwrap:['Black & gold gift wrap','Gift packaging',photo('giftwrap'),'Gift packages with gold ribbons.',450]
};
const catalogue={
 fashion:['tshirt','shirt','jeans','wrap'],home:['vases','cushion','candle','dinnerware'],beauty:['makeup','cream','perfume','dispenser'],food:['produce','bread','broccoli','cookies'],electronics:['headphones','phone','watch','keyboard'],handmade:['craft','wrap','artwork','candle'],jewelry:['hoops','ring','bracelet','necklace'],footwear:['sneakers','whiteTrainers','shoes','heels'],bags:['backpack','handbag','shoulderbag','tote'],kids:['babyoutfit','swimring','toys','cushion'],toys:['toys','craft','notebook','giftbox'],books:['book','notebook','craft','giftwrap'],sports:['weights','yoga','sneakers','headphones'],outdoors:['backpack','sneakers','mug','notebook'],pets:['petfood','petbowl','petbed','petlead'],plants:['succulent','garden','vases','notebook'],furniture:['sofa','cushion','vases','succulent'],kitchen:['dinnerware','mug','dispenser','candle'],bakery:['cake','cookies','bread','brownies'],coffee:['coffee','mug','cookies','cake'],restaurant:['produce','bread','cake','cookies'],wellness:['yoga','candle','cushion','notebook'],salon:['cream','perfume','makeup','dispenser'],art:['artwork','craft','notebook','vases'],automotive:['carkit','carcloth','drill','gloves'],tools:['drill','craft','gloves','measure'],office:['notebook','keyboard','headphones','mug'],events:['giftbox','giftwrap','candle','hoops'],digital:['artwork','notebook','book','giftwrap'],other:['tshirt','backpack','mug','bread'],classic:['vases','cushion','candle','dinnerware']
};
export function sampleProductsFor(details={}){
 const key=details.theme||'classic';
 const serviceNames={digital:['Project consultation','Design & visual direction','Creative production','Artwork consultation'],salon:['Hair consultation','Grooming appointment enquiry','Styling consultation','Personal care consultation'],sports:['Fitness consultation','Training plan enquiry','Coaching discussion','Workout session enquiry'],wellness:['Wellbeing consultation','Guided session enquiry','Routine planning','Personal support enquiry'],events:['Celebration planning','Event styling enquiry','Custom decor enquiry','Occasion consultation'],restaurant:['Catering enquiry','Menu consultation','Event meal planning','Custom menu enquiry'],bakery:['Custom cake enquiry','Celebration consultation','Dessert table enquiry','Bulk baking enquiry'],fashion:['Style consultation','Custom clothing enquiry','Wardrobe planning','Personal styling enquiry'],automotive:['Vehicle-care enquiry','Workshop consultation','Service availability','Custom work enquiry']};
 if(isServiceStore(details))return (serviceNames[key]||['Initial consultation','Custom request','Planning discussion','Follow-up support']).map((name,i)=>({id:'preview-service-'+i,details:{name,category:i<2?'Planning':'Services',price:2500+i*1500,salePrice:null,stock:null,images:[contextualPhoto(key,i===0?'hero':i===1?'about':i===2?'contact':'reviews').url],imageAlt:'Illustrative creative-service context',description:'Discuss scope, availability and a final quote with the business.',sizes:'',colors:''}}));
 return (catalogue[key]||catalogue.other).map((id,i)=>{const [name,category,image,description,price]=items[id];return {id:'preview-'+id+'-'+i,details:{name,category,price,salePrice:null,stock:null,images:image?[image]:[],imageAlt:description,description,sizes:'',colors:''}};});
}
