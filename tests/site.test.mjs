import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {calculatePrice,normalizePhone,makeRequest,whatsappUrl,sendLead,validateLead} from '../src/lib.js'
import {company} from '../src/data/company.js'
import {serviceCities} from '../src/data/service-area.js'
import {languages,locales,contentFor,localePath} from '../src/data/content.js'
import {sceneCopy} from '../src/data/scene.js'
import {proximityPose,sceneState} from '../src/scene-state.js'

test('CTA proximity has a stable boundary and keyboard intent takes priority',()=>{
 const rect={left:200,right:420,top:400,bottom:454}
 assert.deepEqual(proximityPose({x:20,y:420},rect),{near:false,progress:0})
 const entering=proximityPose({x:45,y:420},rect)
 assert.equal(entering.near,true)
 assert.equal(proximityPose({x:35,y:420},rect,true).near,true)
 assert.equal(proximityPose({x:20,y:420},rect,true).near,false)
 assert.equal(proximityPose({x:50,y:250},rect).near,false)
 assert.equal(sceneState(entering).mood,'hopeful')
 assert.equal(sceneState({...entering,focused:true}).mood,'ready')
 assert.equal(sceneState({hovered:true}).mood,'ready')
 assert.equal(sceneState({leaving:true}).mood,'ready')
 assert.deepEqual(sceneState(),{mood:'resigned',anticipation:0})
})
test('scene translations include all three states, alt text and price template',()=>{
 for(const lang of languages){
  const copy=sceneCopy[lang.code]
  assert.deepEqual(Object.keys(copy).sort(),Object.keys(sceneCopy.ru).sort())
  assert.deepEqual(Object.keys(copy.lines).sort(),['hopeful','ready','resigned'])
  assert.ok(copy.leaving && copy.alt && copy.price.includes('{price}'))
  assert.ok(copy.speaker && copy.pause && copy.resume)
  assert.equal(copy.quotes[0],copy.lines.resigned)
  assert.equal(new Set(copy.quotes).size,4)
 }
})

test('prices match the rendered reference; unsupported quantities require a quote',()=>{
 for(const [quantity,price] of [[1,250],[2,450],[3,600]])assert.equal(calculatePrice({type:'wall',quantity}),price)
 for(const input of [{type:'wall',quantity:4},{type:'wall',quantity:0},{type:'wall',quantity:1.5},{type:'central',quantity:2},{type:'vrf',quantity:1},{type:'unknown',quantity:1}])assert.equal(calculatePrice(input),null)
})
test('Israeli mobile numbers normalize to E.164 and invalid phones fail',()=>{
 assert.equal(normalizePhone('054-757-7371'),'+972547577371')
 assert.equal(normalizePhone('+972 (54) 757 7371'),'+972547577371')
 for(const phone of ['123','054123456','0441234567','+9720541234567','<script>',''])assert.equal(normalizePhone(phone),null)
})
test('refrigerant requests remain quote-only and name the correct service in all languages',()=>{
 for(const locale of languages.map(l=>l.code)){
  const values={service:'refrigerant',type:'wall',quantity:2,city:'Test city'}
  const t=contentFor(locale),message=makeRequest(values,{},locale)
  assert.equal(calculatePrice(values),null)
  assert.ok(message.includes(t.serviceOptions[1]))
  assert.ok(message.includes(t.quote));assert.ok(!message.includes('450 ₪'))
  assert.equal(t.services[1].id,'refrigerant')
 }
 assert.throws(()=>makeRequest({service:'other',type:'wall',quantity:1,city:'Test'}))
})
test('requests validate fields and retain localized prices and campaign attribution',()=>{
 for(const quantity of [0,11,1.5])assert.throws(()=>makeRequest({type:'wall',quantity,city:'City'}))
 for(const type of ['other','multi'])assert.throws(()=>makeRequest({type,quantity:1,city:'City'}))
 assert.throws(()=>makeRequest({type:'wall',quantity:1,city:' '}))
 for(const {code} of languages){
  const t=contentFor(code),values={type:'central',quantity:1,city:'Test city',phone:'0541234567'}
  const message=makeRequest(values,{},code)
  assert.deepEqual(validateLead(values,code),{})
  assert.ok(message.includes(t.systemTypes.find(type=>type.value==='central').label))
  assert.ok(message.includes(t.quote));assert.ok(!message.includes('250 ₪'))
 }
 for(const lang of languages){const t=contentFor(lang.code);const message=makeRequest({type:'wall',quantity:2,city:'Test city',phone:'0541234567'}, {utm_source:'instagram',utm_campaign:'summer'},lang.code);assert.ok(message.includes(t.requestHello));assert.ok(message.includes('450 ₪'));assert.ok(message.includes('instagram / summer'));assert.ok(message.includes('+972541234567'))}
})
test('WhatsApp does not use the original placeholder destinations',()=>{
 if(!company.whatsapp)assert.equal(whatsappUrl('test'),'')
 else{const url=new URL(whatsappUrl('Hello & + ?'));assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/'+company.whatsapp.replace(/\D/g,''));assert.equal(url.searchParams.get('text'),'Hello & + ?')}
})
const lead={name:'Test',city:'Test city',phone:'0541234567',type:'wall',quantity:2,note:'Test only'}
test('validation identifies each invalid field in every language and blocks transport',async()=>{
 for(const {code} of languages){
  assert.deepEqual(validateLead(lead,code),{})
  const invalid={...lead,city:'  ',phone:'123',type:'other',quantity:0,service:'other'}
  const errors=validateLead(invalid,code),t=contentFor(code)
  assert.deepEqual(Object.keys(errors),['service','city','phone','system','quantity'])
  assert.equal(errors.phone,t.invalidPhone);assert.equal(errors.city,t.validation.city)
  assert.deepEqual(validateLead({...lead,phone:'123'},code),{phone:t.invalidPhone})
  let sent=false
  await assert.rejects(sendLead(invalid,{locale:code,fetcher:async()=>{sent=true;return {ok:true}}}),e=>{
   assert.deepEqual(e.fieldErrors,errors);return true
  })
  assert.equal(sent,false)
 }
})
test('callback transport posts to the original endpoint and succeeds only after acceptance',async()=>{
 let called=0
 const result=await sendLead(lead,{locale:'en',campaign:{utm_source:'test'},fetcher:async(url,options)=>{
  called++;assert.equal(url,'https://formspree.io/f/mpwrzaby');assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');const payload=JSON.parse(options.body);assert.equal(payload.phone,'+972541234567');assert.equal(payload.utm_source,'test');assert.ok(payload.message.includes('450 ₪'));return {ok:true}
 }})
 assert.equal(called,1);assert.equal(result.status,'accepted')
})
test('callback failure is never reported as a successful lead',async()=>{
 await assert.rejects(sendLead(lead,{fetcher:async()=>({ok:false,status:422})}))
 await assert.rejects(sendLead(lead,{fetcher:async()=>{throw new Error('Network unavailable')}}))
 let called=false
 await assert.rejects(sendLead({...lead,phone:'123'},{fetcher:async()=>{called=true;return{ok:true}}}))
 await assert.rejects(sendLead({...lead,website:'spam'},{fetcher:async()=>{called=true;return{ok:true}}}))
 assert.equal(called,false)
})
test('all five language dictionaries have matching keys and complete core content',()=>{
 const keys=Object.keys(locales.ru).sort()
 for(const lang of languages){assert.deepEqual(Object.keys(locales[lang.code]).sort(),keys);const t=contentFor(lang.code);assert.equal(t.faqs.length,9);assert.equal(t.services.length,3);assert.equal(t.cities.length,company.serviceArea.length);assert.equal(t.priceLabels.length,3)}
})
test('service geography includes both corridors and complete translated city names',()=>{
 for(const name of ['Sderot','Haifa','Tel Aviv-Yafo','Jerusalem'])assert.ok(company.serviceArea.includes(name))
 assert.equal(new Set(company.serviceArea).size,company.serviceArea.length)
 for(const lang of languages){
  const t=contentFor(lang.code)
  assert.ok(serviceCities.every(city=>city[lang.code]))
  assert.deepEqual(t.cityGroups.flatMap(group=>group.cities),t.cities)
  assert.equal(t.cityGroups.length,t.regionGroups.length)
 }
})
test('every SSG page has its own content, canonical, hreflang, direction and offers',async()=>{
 for(const lang of languages){
  const path=lang.code==='ru'?'dist/index.html':`dist/${lang.code}/index.html`
  const html=await readFile(path,'utf8'),t=contentFor(lang.code)
  assert.match(html,new RegExp(`<html lang="${lang.code}" dir="${lang.dir}">`))
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1)
  assert.ok(html.includes(sceneCopy[lang.code].headline[0]))
  assert.ok(html.includes(sceneCopy[lang.code].lines.resigned))
  assert.match(html,/data-mood="resigned"/)
  assert.match(html,/<fieldset[^>]*disabled/)
  assert.match(html,/index, follow, max-image-preview:large/)
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)[1]
  assert.equal(new URL(canonical).pathname,localePath(lang.code))
  assert.equal((html.match(/<link rel="alternate" hreflang=/g)||[]).length,6)
  assert.ok(html.includes('tel:+972547577371'));assert.ok(html.includes('https://t.me/IGideonI'))
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  const page=data['@graph'].find(n=>n['@type']==='WebPage');assert.equal(page.inLanguage,lang.code);assert.equal(page.description,t.description)
  const business=data['@graph'].find(n=>n['@type']==='HVACBusiness');assert.equal(business.name,company.name);assert.deepEqual(business.hasOfferCatalog.itemListElement.map(o=>o.price),[250,450,600]);assert.ok(business.hasOfferCatalog.itemListElement.every(o=>o.itemOffered.name===t.serviceOptions[0]))
  assert.deepEqual(business.areaServed.map(city=>city.name),company.serviceArea)
  for(const city of t.cities)assert.ok(html.includes(city))
  assert.ok(html.includes(t.brandDescriptor.replaceAll('&','&amp;')))
  assert.ok(html.includes(sceneCopy[lang.code].speaker))
  assert.ok(html.includes('quiet-apartment-open.webp'))
  assert.ok(!html.includes('class="service-area-map"'))
  const faqSchema=data['@graph'].find(n=>n['@type']==='FAQPage').mainEntity
  assert.equal(faqSchema.length,9)
  assert.deepEqual(faqSchema.map(faq=>[faq.name,faq.acceptedAnswer.text]),t.faqs.map(faq=>[faq.question,faq.answer]))
  assert.match(html,/<meta property="og:image" content="https:\/\/[^\"]+\/images\/social-cover.jpg"/)
  assert.match(html,/<meta name="twitter:card" content="summary_large_image"/)
  const services=data['@graph'].filter(n=>n['@type']==='Service');assert.equal(services.length,3)
  assert.ok(services.some(s=>s['@id'].endsWith('#service-refrigerant')))
  for(const service of services)assert.ok(html.includes(`id="${new URL(service.url).hash.slice(1)}"`))
  assert.ok(html.includes('https://wa.me/972547577371'))
  for(const match of html.matchAll(/href="#([^\"]+)"/g))assert.ok(html.includes(`id="${match[1]}"`))
  for(const match of html.matchAll(/(?:src|href)="(\/(?:assets|fonts|images)\/[^\"?#]+)"/g))await access(`dist${match[1]}`)
 }
})
test('sitemap exposes all language pages and robots allows indexing',async()=>{
 const sitemap=await readFile('dist/sitemap.xml','utf8'),robots=await readFile('dist/robots.txt','utf8')
 assert.equal((sitemap.match(/<url>/g)||[]).length,5)
 assert.match(robots,/Allow: \//)
 for(const lang of languages)assert.ok(sitemap.includes(`hreflang="${lang.code}"`))
})
