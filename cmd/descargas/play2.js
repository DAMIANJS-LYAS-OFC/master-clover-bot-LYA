import yts from 'yt-search'
import config from '../../config.js'
import { prepareWAMessageMedia } from 'baileys'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
export const handler = {}
handler.name = 'play2'
handler.alias = ['ytmp4','mp4','ytvideo','video','playv','playvideo']
handler.category = 'descargas'
const YOSOYYO_API = 'https://api-yosoyyo-api-ofc.onrender.com/api/youtube'
const YOSOYYO_KEY = 'yosoyyo_sk_rwbuo0cs'
const NEOXR_API = 'https://api.neoxr.eu/api/youtube'
const NEOXR_KEY = 'russellxz'
const BASE_URL = 'https://cnv.cx'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
const SERVERS = [{name:'y2meta-uk',origin:'https://iframe.y2meta-uk.com',referer:'https://iframe.y2meta-uk.com/'},{name:'mp3yt',origin:'https://mp3yt.is',referer:'https://mp3yt.is/'}]
const MAX = 100*1024*1024, RETRIES = 2, VUELTAS = 2, DELAY = 1200
function cleanId(v){return String(v||'').split('@')[0].split(':')[0].replace(/\D/g,'')}
function getBotNum(s){return cleanId(s?.principalNumber||s?.subNumber||s?.user?.id?.split(':')[0]||'')}
function getBotName(s,n){
 if(s.principalConfig?.name) return s.principalConfig.name
 if(s.subConfig?.name) return s.subConfig.name
 for(let p of [path.join(process.cwd(),'principals',n,'config.json'),path.join(process.cwd(),'subbots',n,'config.json'),path.join(process.cwd(),'jadiBots',n,'config.json')]){
 if(fs.existsSync(p)){try{let j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.name) return j.name}catch{}}
 }
 return 'Master Clover'
}
async function sendIconDoc(sock,jid,m,txt,mentions=[]){
 try{
 let num=getBotNum(sock),botName=getBotName(sock,num),dir=path.join(process.cwd(),'db','icon')
 const pos=[sock.subConfig?.icon,sock.principalConfig?.icon,path.join(dir,num+'.jpg'),path.join(dir,num+'.png'),path.join(dir,num+'.webp'),path.join(dir,'main.jpg')]
 let icon=null
 for(const p of pos){if(!p||String(p).startsWith('http'))continue;const f=path.isAbsolute(p)?p:path.join(process.cwd(),p);if(fs.existsSync(f)){icon=f;break}}
 if(!icon&&fs.existsSync(dir)){const f=fs.readdirSync(dir).filter(x=>/\.(jpg|jpeg|png|webp)$/i.test(x));if(f.length)icon=path.join(dir,f[0])}
 if(!icon) return sock.sendMessage(jid,{text:txt,mentions},{quoted:m})
 const orig=fs.readFileSync(icon)
 const prev=await sharp(orig).rotate().resize(160,160,{fit:'inside',withoutEnlargement:true}).jpeg({quality:65}).toBuffer({resolveWithObject:true})
 const meta=await sharp(orig).metadata()
 const fmt={jpeg:['jpg','image/jpeg'],png:['png','image/png'],webp:['webp','image/webp'],gif:['gif','image/gif'],avif:['avif','image/avif'],tiff:['tiff','image/tiff']}
 let name=String(botName).replace(/[\\/:*?"<>|\r\n]/g,'').trim()||'Bot'
 const ext=fmt[meta.format]||[path.extname(icon).slice(1).toLowerCase()||'jpg','image/jpeg']
 return sock.sendMessage(jid,{document:orig,fileName:name+'.'+ext[0],mimetype:ext[1],jpegThumbnail:prev.data.toString('base64'),thumbnailWidth:prev.info.width,thumbnailHeight:prev.info.height,caption:txt,mentions},{quoted:m})
 }catch{return sock.sendMessage(jid,{text:txt,mentions},{quoted:m})}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function retry(fn){
 let last=null
 for(let i=1;i<=RETRIES;i++){try{return await fn()}catch(e){last=e;if(i<RETRIES)await sleep(DELAY)}}
 throw last
}
async function buscar(q){
 let last=null
 for(let i=1;i<=3;i++){
 try{
 const s=await yts(q)
 if(s.videos.length) return s.videos[0]
 throw new Error('Sin resultados')
 }catch(e){last=e;await sleep(1000*i)}
 }
 throw last
}
function headersFor(s){return{'Accept':'*/*','Origin':s.origin,'Referer':s.referer,'User-Agent':UA,'Cache-Control':'no-cache'}}
function getId(v){
 try{
 const u=new URL(String(v).trim()),h=u.hostname.toLowerCase().replace(/^www\./,'');let id=''
 if(h==='youtu.be')id=u.pathname.split('/')[1]
 else if(h==='youtube.com'||h.endsWith('.youtube.com')){if(u.pathname==='/watch')id=u.searchParams.get('v');else{const p=u.pathname.split('/');if(['shorts','embed','live','v'].includes(p[1]))id=p[2]}}
 return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null
 }catch{return null}
}
async function fetchT(url,opt={},ms=20000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal,redirect:'follow'})}finally{clearTimeout(t)}}
async function readJson(res,label){
 const txt=await res.text();let d;try{d=JSON.parse(txt)}catch{throw new Error(label+': respuesta inválida')}
 if(!res.ok||d?.error===true)throw new Error(label+': '+(d?.errorMsg||d?.message||`HTTP ${res.status}`));return d
}
async function freshKey(s,url){
 const id=getId(url);if(!id)throw new Error('ID inválido')
 const r=await fetchT(`${BASE_URL}/v2/sanity/key?id=${id}`,{method:'GET',headers:headersFor(s)},10000)
 const d=await readJson(r,s.name);if(!d.key)throw new Error('key no disponible');return d.key
}
async function convServer(s,url){
 const key=await freshKey(s,url)
 const r=await fetchT(`${BASE_URL}/v2/converter`,{method:'POST',headers:{...headersFor(s),'Content-Type':'application/x-www-form-urlencoded',key},body:new URLSearchParams({link:url,format:'mp4',audioBitrate:'128',videoQuality:'720',filenameStyle:'pretty',vCodec:'h264'}).toString()},40000)
 const d=await readJson(r,s.name+' converter');if(!d?.url)throw new Error('no devolvió URL');return d
}
async function cnv(url){try{return await Promise.any(SERVERS.map(s=>convServer(s,url)))}catch(e){throw new Error(e.errors?.map(x=>x.message).join(' | ')||'Conversores fallaron')}}
async function dlVideo(url,ref='https://www.youtube.com/'){
 const atts=[{'User-Agent':UA,'Accept':'video/*,application/octet-stream,*/*','Referer':ref,'Origin':'https://www.youtube.com'},{'User-Agent':UA,'Accept':'*/*','Referer':'https://m.youtube.com/'},{'User-Agent':UA,'Accept':'*/*'}]
 let last=null
 for(const h of atts){
 try{
 const c=new AbortController(),t=setTimeout(()=>c.abort(),180000)
 try{
 const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:h})
 if(r.status===403){last=new Error('HTTP 403');continue}
 if(!r.ok)throw new Error('HTTP '+r.status)
 const ct=(r.headers.get('content-type')||'').toLowerCase()
 if(ct.includes('text/html')||ct.includes('application/json'))throw new Error('No devolvió video')
 const len=Number(r.headers.get('content-length')||0);if(len>MAX)throw new Error('Video grande')
 const ch=[];let tot=0;for await(const x of r.body){const d=Buffer.from(x);tot+=d.length;if(tot>MAX)throw new Error('Video grande');ch.push(d)}
 const buf=Buffer.concat(ch);if(buf.length<1000)throw new Error('Video vacío')
 const ini=buf.subarray(0,200).toString('utf8').toLowerCase();if(ini.includes('<!doctype')||ini.includes('<html'))throw new Error('Devolvió HTML')
 return{buffer:buf,contentType:ct}
 }finally{clearTimeout(t)}
 }catch(e){last=e}
 }
 throw last||new Error('Error descargando video')
}
function fmtVideo(buf){
 if(buf.subarray(4,8).toString()==='ftyp')return{ext:'mp4',mimetype:'video/mp4'}
 if(buf.subarray(0,4).toString('hex')==='1a45dfa3')return{ext:'webm',mimetype:'video/webm'}
 throw new Error('Archivo no es video')
}
function findUrl(o){
 if(!o||typeof o!=='object')return null
 for(const k of ['download','url','video','link','dl','mp4']){if(typeof o[k]==='string'&&o[k].startsWith('http'))return o[k]}
 for(const v of Object.values(o)){if(v&&typeof v==='object'){const f=findUrl(v);if(f)return f}}
 return null
}
async function yosoyyo(q){
 const r=await fetchT(`${YOSOYYO_API}?q=${encodeURIComponent(q)}&apiKey=${YOSOYYO_KEY}`,{method:'GET',headers:{'User-Agent':UA,'Accept':'application/json'}},30000)
 const ct=(r.headers.get('content-type')||'').toLowerCase()
 if(ct.includes('video')||ct.includes('octet-stream')){const b=Buffer.from(await r.arrayBuffer());if(b.length<1000)throw new Error('Video vacío');return{buffer:b,...fmtVideo(b)}}
 const d=await readJson(r,'Yosoyyo'),u=findUrl(d);if(!u)throw new Error('Sin link')
 let ref='https://www.youtube.com/';try{ref=new URL(u).origin+'/'}catch{}
 const a=await dlVideo(u,ref);return{buffer:a.buffer,...fmtVideo(a.buffer)}
}
async function neoxr(url){
 const p=new URLSearchParams({url,type:'video',quality:'720p',apikey:NEOXR_KEY})
 const r=await fetchT(`${NEOXR_API}?${p}`,{method:'GET',headers:{'User-Agent':UA,'Accept':'application/json, video/*, */*'}},45000)
 const ct=(r.headers.get('content-type')||'').toLowerCase();if(!r.ok)throw new Error('NeoXR HTTP '+r.status)
 if(ct.includes('video/')||ct.includes('octet-stream')){const ch=[];let tot=0;for await(const x of r.body){const d=Buffer.from(x);tot+=d.length;if(tot>MAX)throw new Error('Video grande');ch.push(d)}const b=Buffer.concat(ch);if(b.length<1000)throw new Error('Vacío');return{buffer:b,...fmtVideo(b)}}
 const d=await readJson(r,'NeoXR');if(d?.status===false||d?.success===false||d?.error===true)throw new Error(d?.message||'NeoXR falló')
 const u=findUrl(d?.data||d?.result||d);if(!u)throw new Error('Sin link')
 const host=new URL(u).hostname.toLowerCase();if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be')throw new Error('Sin link directo')
 let ref='https://www.youtube.com/';try{ref=new URL(u).origin+'/'}catch{}
 const a=await dlVideo(u,ref);return{buffer:a.buffer,...fmtVideo(a.buffer)}
}
async function cnvVideo(url){
 const r=await cnv(url);if(!r?.url)throw new Error('Sin enlace')
 let a;try{a=await dlVideo(r.url)}catch(e){if(!r.url.includes('/tunnel?'))throw e;a=await dlVideo(r.url.replace('/tunnel?','/tunnel/?'))}
 return{buffer:a.buffer,...fmtVideo(a.buffer)}
}
async function getVideo(url,q,sock,from,m){
 let last=null
 const apis=[{fn:()=>yosoyyo(q)},{fn:()=>cnvVideo(url)},{fn:()=>neoxr(url)}]
 for(let v=1;v<=VUELTAS;v++){
 for(const a of apis){try{return await retry(a.fn)}catch(e){last=e;continue}}
 if(v<VUELTAS)await sock.sendMessage(from,{text:`🔄 *Vuelta ${v} falló, intentando de nuevo...*`},{quoted:m})
 }
 throw new Error(`Todas fallaron. Último: ${last?.message}`)
}
handler.exec=async(sock,m)=>{
 const from=m.key.remoteJid,body=m.message?.conversation||m.message?.extendedTextMessage?.text||''
 const prefix=body.trim().charAt(0)||'.',q=body.trim().split(/ +/).slice(1).join(' ').trim()
 if(!q)return sendIconDoc(sock,from,m,`❀ Por favor, ingresa un nombre o link.\n*ejemplo ${prefix}play2 hola remix*`)
 try{
 let url=q,video={}
 if(!q.startsWith('http')){video=await buscar(q);url=video.url}
 else{try{video=await buscar(q)}catch{video={}}}
 const title=video.title||q,channel=video.author?.name||'YouTube',duration=video.timestamp||'N/A',views=video.views?.toLocaleString()||'N/A',ago=video.ago||'N/A',thumb=video.thumbnail||video.image
 const txt=`(✿˶ᵔᵕᵔ˶)\nֺ ˳ּ𑁍 ׁ🍦 〫࣫〇ׁ┄ *YT DOWNLOAD*┄〇ׁ🍦˳ּ𑁍 ׁ ׅ\n━ׁ┉ׅ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ˳ּ𑁍 ─ׁ┉ׅ─ׁ─ׁ┉ׅ─ׁ─ׅ┉ׁ━ִ\n> ⏤͟͟͞͞🍓 Título: ${title}\n> ׄ⏤͟͟͞͞🍓 Vistas: ${views}\n> ׄ⏤͟͟͞͞🍓 Duración: ${duration}\n> ׄ⏤͟͟͞͞🍓 Publicado: ${ago}\n> ׄ⏤͟͟͞͞🍓 Enlace: ${url}\n> ׄ⏤͟͟͞͞🍓 Canal: ${channel}\n(✿˶ᵔᵕᵔ˶)っ _Espera un momento ya te lo preparo..._`
 const canalId=config.canalId||config.channelId||config.newsletterJid||'',canalNombre=config.canalNombre||config.channelName||config.newsletterName||config.canal||''
 let linkPreview=null
 if(thumb){
 try{
 if(sock.waUploadToServer){
 const {imageMessage}=await prepareWAMessageMedia({image:{url:thumb}},{upload:sock.waUploadToServer,mediaTypeOverride:'thumbnail-link'})
 linkPreview={'canonical-url':url,'matched-text':url,title:`🍃 Descargando: ${title}`,description:`${channel} • ${duration} • ${views} vistas`,jpegThumbnail:imageMessage?.jpegThumbnail?Buffer.from(imageMessage.jpegThumbnail):undefined,highQualityThumbnail:imageMessage||undefined}
 }
 }catch{}
 }
 const ctx={isForwarded:true,forwardedNewsletterMessageInfo:{newsletterJid:canalId,serverMessageId:'0',newsletterName:canalNombre}}
 await sock.sendMessage(from,{text:txt,linkPreview:linkPreview||undefined,contextInfo:ctx},{quoted:m})
 const vid=await getVideo(url,q,sock,from,m)
 const safe=title.replace(/[\\/:*?"<>|]/g,'').slice(0,100)
 await sock.sendMessage(from,{video:vid.buffer,mimetype:vid.mimetype,fileName:`${safe}.${vid.ext}`,caption:`🎬 ${title}`,contextInfo:ctx},{quoted:m})
 }catch(e){await sock.sendMessage(from,{text:`❌ Error: ${e.message}`},{quoted:m})}
}
export default handler
