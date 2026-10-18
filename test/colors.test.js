import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storePalette,contrast,paletteStyle} from '../public/colors.js';
import {themes} from '../public/themes.js';

test('color roles keep page/banner distinct and text readable even with identical or extreme selections',()=>{
 const colors=['#ffffff','#000000','#777777','#ffff00','#075e47','#ff00ff','#0000ff'];
 for(const accent of colors)for(const secondaryColor of colors)for(const textColor of colors){const p=storePalette({accent,secondaryColor,textColor});
  assert.equal(p.primary,accent);assert.ok(contrast(p.background,p.banner)>=1.6);
  for(const [foreground,background]of [[p.ink,p.background],[p.ink,p.surface],[p.bannerInk,p.banner],[p.actionInk,p.primary],[p.bannerActionInk,p.bannerAction],[p.brandInk,p.background]])assert.ok(contrast(foreground,background)>=4.5,JSON.stringify({foreground,background,accent,secondaryColor,textColor}));
  assert.ok(contrast(p.bannerAction,p.banner)>=1.6);
 }
});
test('all category defaults and legacy stores resolve locally without mutating stored choices',()=>{
 for(const theme of Object.values(themes)){const details={accent:theme.accent},before=JSON.stringify(details),p=storePalette(details,theme);assert.ok(contrast(p.banner,p.background)>=1.6);assert.equal(JSON.stringify(details),before);assert.match(paletteStyle(p),/^--brand:#[a-f0-9]{6}/i);}
 const p=storePalette({accent:'invalid',secondaryColor:'url(evil)',textColor:'red'});assert.equal(p.primary,'#075e47');assert.doesNotMatch(paletteStyle(p),/invalid|url\(|evil/);
});
