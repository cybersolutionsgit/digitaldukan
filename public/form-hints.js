// Short examples, translated with the interface switch. Never change entered values.
const hints={
 email:['Like you@example.com','Jaisay aap@example.com'],
 password:['Type your password','Apna password likho'],
 newPassword:['Make a new password: 8 or more letters or numbers','Naya password banao: 8 ya zyada harf ya number'],
 confirmPassword:['Type the same new password again','Wohi naya password dobara likho'],
 confirm:['Type the same password again','Wohi password dobara likho'],
 adminPassword:['Type your admin password','Apna admin password likho'],
 slug:['Like nayastore (no spaces)','Jaisay nayastore (beech mein khali jagah nahi)'],
 confirmSlug:['Copy the username shown above','Upar wala Username yahan likho'],
 whatsapp:['Like 923001234567 (92, then your number)','Jaisay 923001234567 (92 ke baad apna number)'],
 phone:['Like 03001234567','Jaisay 03001234567'],
 niche:['Like clothes, cakes or toys','Jaisay kapray, cake ya khilonay'],
 description:['Tell people what you sell','Likho ke tum kya bechtay ho'],
 address:['Write your shop or business address','Apni dukan ya kaam ka pata likho'],
 deliveryInfo:['Where do you deliver? How many days does it take?','Saman kahan bhejtay ho? Kitne din lagtay hain?'],
 returns:['Can people return an item? Tell them how','Saman wapas ho sakta hai? Kaise? Yahan likho'],
 delivery:['Like 200. Use 0 for free delivery','Jaisay 200. Free delivery ho to 0 likho'],
 instagram:['Like instagram.com/myshop','Jaisay instagram.com/meridukan'],
 facebook:['Like facebook.com/myshop','Jaisay facebook.com/meridukan'],
 price:['Like 1500','Jaisay 1500'],salePrice:['Like 1200 (less than the price above)','Jaisay 1200 (asal qeemat se kam)'],
 stock:['How many do you have? Like 10','Tumhare paas kitne hain? Jaisay 10'],
 category:['Like Cakes or Clothes','Jaisay Cake ya Kapray'],
 option1Name:['Like Weight or Flavor','Jaisay Wazan ya Zaiqa'],option2Name:['Like Pack or Color','Jaisay Pack ya Rang'],
 sizes:['Like 500g, 1kg','Jaisay 500g, 1kg'],colors:['Like Red, Blue','Jaisay Laal, Neela'],
 seoTitle:['Like My Dukan - Fresh Cakes','Jaisay Meri Dukan - Taaza Cake'],
 seoDescription:['Write one short line about your shop','Apni dukan ke baray mein aik chhoti line likho'],
 imageAlt:['What is in this photo?','Is photo mein kya hai?'],
 notes:['Tell the shop what you need','Dukan walay ko batao ke tumhein kya chahiye']
};
const labels={
 'Store name':['Like My Dukan','Jaisay Meri Dukan'],
 'Product name':['Like Chocolate Cake','Jaisay Chocolate Cake'],
 'Your full name':['Type your full name','Apna poora naam likho'],
 'Product description':['Tell people about this product','Is cheez ke baray mein batao']
};
const createPassword=['Make a password: 8 or more letters or numbers','Password banao: 8 ya zyada harf ya number'];
const generic=['Write here','Yahan likho'];
export function placeholderFor(label,name,type,path=''){if(type==='color'||type==='hidden')return '';return (labels[label]||(name==='password'&&['/signup','/reset-password'].includes(path)?createPassword:hints[name])||generic)[0];}
export const hintTranslations=Object.fromEntries([...Object.values(hints),...Object.values(labels),createPassword,generic]);
