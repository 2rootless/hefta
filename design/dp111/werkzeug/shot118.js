// PD158: jede Ansicht als eigenes Bild (Element-Screenshot, DSF 1, damit 58 px wirklich 58 px sind). Nur file:.
const {chromium}=require('playwright');const fs=require('fs');const L=require('./html/liste.json');fs.mkdirSync('png/einzel',{recursive:true});
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:2200},deviceScaleFactor:1});
 for(const datei of [...new Set(L.map(x=>x.datei))]){await p.goto('file://'+__dirname+'/html/'+datei+'.html');await p.waitForTimeout(400);
  await p.screenshot({path:`png/bogen-${datei}.png`,fullPage:true});
  for(const x of L.filter(x=>x.datei===datei)){const el=p.locator('[id="'+x.id+'"] .ic');await el.screenshot({path:`png/einzel/${x.id}.png`})}}
 await b.close();console.log('ok')})();
