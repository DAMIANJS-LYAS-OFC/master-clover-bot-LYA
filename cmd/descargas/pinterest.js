export const handler = {}
handler.name = 'pinterest'
handler.alias = ['pin','pinteres']
handler.category = 'buscador'
handler.description = 'Busca imagenes en Pinterest'

const KEY = 'russellxz'
const BASE = 'https://api.neoxr.eu/api/pinterest'
const BASE_PIN = 'https://api.neoxr.eu/api/pin'

handler.exec = async (sock, m) => {
 const from = m.key.remoteJid
 const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
 const q = body.trim().split(/ +/).slice(1).join(' ').trim()
 
 if(!q) return sock.sendMessage(from, { text: '𐚁 Usa: .pin gatos' }, { quoted: m })
 
 try {
 const isLink = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:pinterest\.[a-z.]+|pin\.it)\//i.test(q)
 const url = isLink
  ? `${BASE_PIN}?url=${encodeURIComponent(q)}&apikey=${KEY}`
  : `${BASE}?q=${encodeURIComponent(q)}&apikey=${KEY}`

 const json = await fetch(url).then(r=>r.json())

 if(json.status === false || json.success === false) throw new Error('Sin resultados')

 const data = json.data || json.result
 const raw = Array.isArray(data) ? data : Array.isArray(data?.media) ? data.media : data ? [data] : []
 const list = raw.map(v => {
  if(typeof v === 'string') return { image: v }
  return v
 }).slice(0,5)

 if(!list.length) throw new Error('Sin resultados')

 await sock.sendMessage(from, { 
 text: `𐚁 *Pinterest Search*\n\n✐ Busqueda: ${q}\n🌀 Enviando ${list.length} imagenes` 
 }, { quoted: m })

 const medias = []

 for(let v of list){
  const imgUrl = v.imageProxy || v.image || v.url || v.download || v.video
  if(!imgUrl) continue

  const mediaUrl = typeof imgUrl === 'string' ? imgUrl : imgUrl.url
  if(!mediaUrl) continue

  const isVideo = v.type === 'video' || /\.mp4(?:\?|$)/i.test(mediaUrl)

  medias.push(
   isVideo
    ? { video: { url: mediaUrl } }
    : { image: { url: mediaUrl } }
  )
 }

 if(!medias.length) throw new Error('Sin archivos para enviar')

 if(medias.length === 1){
  await sock.sendMessage(from, medias[0], { quoted: m })
 } else {
  const expectedImageCount = medias.filter(v => v.image).length
  const expectedVideoCount = medias.filter(v => v.video).length

  const album = await sock.sendMessage(from, {
   album: {
    expectedImageCount,
    expectedVideoCount
   }
  }, { quoted: m })

  if(!album?.key) throw new Error('No se pudo crear el álbum')

  for(const media of medias){
   await sock.sendMessage(from, {
    ...media,
    albumParentKey: album.key
   })
  }
 }

 } catch(e){ 
 await sock.sendMessage(from, { text: `𐚁 Error: ${e.message}` }, { quoted: m }) 
 }
}