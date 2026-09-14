import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {normalizePhone,makeRequest,whatsappUrl,sendLead,validateLead} from '../src/lib.js'
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
  assert.ok(copy.speaker)
  assert.equal(copy.quotes[0],copy.lines.resigned)
  assert.equal(new Set(copy.quotes).size,4)
 }
})

test('Israeli mobile numbers normalize to E.164 and invalid phones fail',()=>{
 assert.equal(normalizePhone('052-446-4677'),'+972524464677')
 assert.equal(normalizePhone('+972 (55) 770 7506'),'+972557707506')
 for(const phone of ['123','054123456','0441234567','+9720541234567','<script>',''])assert.equal(normalizePhone(phone),null)
})
test('callback messages include contact details and attribution without removed service fields',()=>{
 for(const {code} of languages){
  const t=contentFor(code)
  const values={name:'  Test  ',phone:'0541234567',note:'Call after 17:00',city:'Old city',type:'wall',service:'cleaning',quantity:2}
  const message=makeRequest(values,{utm_source:'instagram',utm_campaign:'summer'},code)
  assert.deepEqual(validateLead(values,code),{})
  assert.ok(message.includes(t.requestHello))
  assert.ok(message.includes(`${t.name}: Test`))
  assert.ok(message.includes(`${t.phone}: +972541234567`))
  assert.ok(message.includes(`${t.note}: Call after 17:00`))
  assert.ok(message.includes('instagram / summer'))
  assert.ok(!/Old city|450|₪/.test(message))
  assert.ok(!message.includes(t.serviceOptions[0]))
  assert.equal(makeRequest({}, {}, code),t.requestHello)
  assert.ok(makeRequest({name:'Test'}, {}, code).includes(`${t.name}: Test`))
  assert.throws(()=>makeRequest({phone:'123'}, {}, code))
 }
})
test('WhatsApp does not use the original placeholder destinations',()=>{
 if(!company.whatsapp)assert.equal(whatsappUrl('test'),'')
 else{const url=new URL(whatsappUrl('Hello & + ?'));assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/'+company.whatsapp.replace(/\D/g,''));assert.equal(url.searchParams.get('text'),'Hello & + ?')}
})
const lead={name:'Test',phone:'0541234567',note:'Test only'}
test('validation identifies each invalid field in every language and blocks transport',async()=>{
 for(const {code} of languages){
  assert.deepEqual(validateLead(lead,code),{})
  const invalid={...lead,name:'  ',phone:'123',note:'x'.repeat(301)}
  const errors=validateLead(invalid,code),t=contentFor(code)
  assert.deepEqual(Object.keys(errors),['name','phone','note'])
  assert.equal(errors.phone,t.invalidPhone);assert.equal(errors.name,t.validation.name);assert.equal(errors.note,t.validation.note)
  assert.deepEqual(validateLead({...lead,name:'x'.repeat(81)},code),{name:t.validation.name})
  assert.deepEqual(validateLead({name:'Test',phone:lead.phone},code),{})
  assert.deepEqual(validateLead({...lead,phone:'123'},code),{phone:t.invalidPhone})
  let sent=false
  await assert.rejects(sendLead(invalid,{locale:code,fetcher:async()=>{sent=true;return {ok:true}}}),e=>{
   assert.deepEqual(e.fieldErrors,errors);return true
  })
  assert.equal(sent,false)
 }
})
const submissionId = '45920260-0914-4abc-8def-123456789012'
const accepted = {status:202,json:async()=>({status:'accepted',id:submissionId})}
test('callback sends a minimal, idempotent request to the same-origin Cloudflare endpoint',async()=>{
 let called=0
 const result=await sendLead(lead,{id:submissionId,turnstileToken:'token',locale:'en',campaign:{utm_source:'test'},fetcher:async(url,options)=>{
  called++;assert.equal(url,'/api/leads');assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');
  const payload=JSON.parse(options.body)
  assert.equal(payload.phone,'+972541234567');assert.equal(payload.campaign.utm_source,'test');assert.equal(payload.name,'Test');assert.equal(payload.note,'Test only')
  assert.equal(payload.id,submissionId);assert.equal(payload.turnstileToken,'token')
  assert.deepEqual(Object.keys(payload).sort(),['id','locale','name','note','phone','campaign','website','turnstileToken'].sort())
  return accepted
 }})
 assert.equal(called,1);assert.equal(result.status,'accepted')
})
test('callback needs only a name and phone and never sends removed or arbitrary fields',async()=>{
 let called=0
 await sendLead({name:' Test ',phone:lead.phone,city:'Old city',type:'wall',quantity:3,service:'cleaning',extra:'ignored'},{id:submissionId,turnstileToken:'token',fetcher:async(url,options)=>{
  called++
  const payload=JSON.parse(options.body)
  assert.equal(payload.name,'Test');assert.equal(payload.note,'')
  for(const key of ['city','type','quantity','service','extra'])assert.ok(!(key in payload))
  return accepted
 }})
 assert.equal(called,1)
})
test('a successful HTTP response without durable acceptance is not a successful lead',async()=>{
 for(const reply of [{status:200,json:async()=>({})},{status:202,json:async()=>({status:'accepted',id:'wrong'})}])
  await assert.rejects(sendLead(lead,{id:submissionId,turnstileToken:'token',fetcher:async()=>reply}))
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
  const form=html.match(/<form[^>]*id="booking-form"[\s\S]*?<\/form>/)[0]
  assert.deepEqual([...form.matchAll(/<(?:input|textarea)[^>]*name="([^"]+)"/g)].map(match=>match[1]),['name','phone','note','_gotcha'])
  assert.ok(!/<select|estimate-row|quantity-control/.test(form))
  assert.match(form,/<input[^>]*name="name"[^>]*required/)
  assert.match(form,/<input[^>]*name="phone"[^>]*required/)
  assert.ok(!/<textarea[^>]*required/.test(form))
  assert.ok(html.includes(t.bulkPriceTitle));assert.ok(html.includes(t.bulkPriceText))
  assert.equal((html.match(/class="price-option"/g)||[]).length,3)
  assert.equal((html.match(/class="price-bulk"/g)||[]).length,1)

  assert.match(html,/index, follow, max-image-preview:large/)
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)[1]
  assert.equal(canonical,`https://zeez.co.il${localePath(lang.code)}`)
  for(const match of html.matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g))assert.equal(new URL(match[1]).origin,'https://zeez.co.il')
  for(const match of html.matchAll(/<meta property="og:(?:url|image|image:secure_url)" content="([^"]+)"/g))assert.equal(new URL(match[1]).origin,'https://zeez.co.il')
  assert.ok(!html.includes('mazganim-clean-air.gerasim459.workers.dev'))
  assert.equal((html.match(/<link rel="alternate" hreflang=/g)||[]).length,6)
  for(const phone of company.phones){assert.ok(html.includes(`tel:${phone.number}`));assert.ok(html.includes(phone.display))}
  assert.ok(html.includes('https://t.me/zeezair'))
  assert.ok(!html.includes('https://t.me/+972524464677'))
  assert.ok(!/547577371|054-757-7371|IGideonI/.test(html))
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  const page=data['@graph'].find(n=>n['@type']==='WebPage');assert.equal(page.inLanguage,lang.code);assert.equal(page.description,t.description)
  const business=data['@graph'].find(n=>n['@type']==='HVACBusiness');assert.equal(business.name,company.name);assert.deepEqual(business.hasOfferCatalog.itemListElement.map(o=>o.price),[250,450,600]);assert.ok(business.hasOfferCatalog.itemListElement.every(o=>o.itemOffered.name===t.serviceOptions[0]))
  assert.deepEqual(business.areaServed.map(city=>city.name),company.serviceArea)
  assert.deepEqual(business.telephone,['+972524464677','+972557707506'])
  assert.deepEqual(business.contactPoint.map(contact=>contact.telephone),business.telephone)
  for(const city of t.cities)assert.ok(html.includes(city))
  assert.ok(html.includes(t.brandDescriptor.replaceAll('&','&amp;')))
  assert.ok(html.includes(sceneCopy[lang.code].speaker))
  assert.ok(html.includes('quiet-apartment-sash.webp'))
  assert.ok(!html.includes('class="service-area-map"'))
  const faqSchema=data['@graph'].find(n=>n['@type']==='FAQPage').mainEntity
  assert.equal(faqSchema.length,9)
  assert.deepEqual(faqSchema.map(faq=>[faq.name,faq.acceptedAnswer.text]),t.faqs.map(faq=>[faq.question,faq.answer]))
  assert.match(html,/<meta property="og:image" content="https:\/\/[^\"]+\/images\/social-cover-contacts.jpg"/)
  assert.match(html,/<meta name="twitter:card" content="summary_large_image"/)
  const services=data['@graph'].filter(n=>n['@type']==='Service');assert.equal(services.length,3)
  assert.ok(services.some(s=>s['@id'].endsWith('#service-refrigerant')))
  for(const service of services)assert.ok(html.includes(`id="${new URL(service.url).hash.slice(1)}"`))
  assert.ok(html.includes('https://wa.me/972524464677'))
  for(const match of html.matchAll(/href="#([^\"]+)"/g))assert.ok(html.includes(`id="${match[1]}"`))
  for(const match of html.matchAll(/(?:src|href)="(\/(?:assets|fonts|images)\/[^\"?#]+)"/g))await access(`dist${match[1]}`)
 }
})
test('sitemap exposes all language pages and robots allows indexing',async()=>{
 const sitemap=await readFile('dist/sitemap.xml','utf8'),robots=await readFile('dist/robots.txt','utf8')
 assert.equal((sitemap.match(/<url>/g)||[]).length,5)
 assert.match(robots,/Allow: \//)
 assert.ok(robots.includes('Sitemap: https://zeez.co.il/sitemap.xml'))
 assert.ok(!sitemap.includes('workers.dev'))
 assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]),languages.map(l=>`https://zeez.co.il${localePath(l.code)}`))
 for(const lang of languages)assert.ok(sitemap.includes(`hreflang="${lang.code}"`))
})
