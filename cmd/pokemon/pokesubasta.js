import { loadDB, saveDB, senderCanon, learnLid, getUser } from '../../lib/poke.js'

export const handler = {}
handler.name = 'pokesubasta'
handler.alias = ['subasta', 'subastapoke', 'auction']
handler.category = 'pokemon'

if(!globalThis.pokeAuctions) globalThis.pokeAuctions = {}
if(!globalThis.pokeTimers) globalThis.pokeTimers = {}

const RANDOM_POOL = [
 { id: 1012, name: 'Poltchageist', peso: '1.1 kg', altura: '0.1 m', tipo: 'Planta / Fantasma', rare: 'Común', valor: 62 },
 { id: 25, name: 'Pikachu', peso: '6.0 kg', altura: '0.4 m', tipo: 'Eléctrico', rare: 'Raro', valor: 150 },
 { id: 1, name: 'Bulbasaur', peso: '6.9 kg', altura: '0.7 m', tipo: 'Planta / Veneno', rare: 'Común', valor: 50 },
 { id: 4, name: 'Charmander', peso: '8.5 kg', altura: '0.6 m', tipo: 'Fuego', rare: 'Común', valor: 55 },
 { id: 7, name: 'Squirtle', peso: '9.0 kg', altura: '0.5 m', tipo: 'Agua', rare: 'Común', valor: 52 },
 { id: 94, name: 'Gengar', peso: '40.5 kg', altura: '1.5 m', tipo: 'Fantasma / Veneno', rare: 'Épico', valor: 400 },
 { id: 150, name: 'Mewtwo', peso: '122.0 kg', altura: '2.0 m', tipo: 'Psíquico', rare: 'Legendario', valor: 1000 },
 { id: 143, name: 'Snorlax', peso: '460.0 kg', altura: '2.1 m', tipo: 'Normal', rare: 'Épico', valor: 350 },
 { id: 130, name: 'Gyarados', peso: '235.0 kg', altura: '6.5 m', tipo: 'Agua / Volador', rare: 'Épico', valor: 380 },
 { id: 133, name: 'Eevee', peso: '6.5 kg', altura: '0.3 m', tipo: 'Normal', rare: 'Raro', valor: 120 },
]

function getNum(v, m){
 let s = String(v || '').split(':')[0].split('@')[0].replace(/\D/g, '')
 if(s) return s
 const raw = m?.key?.participant || m?.key?.remoteJid || ''
 const s2 = String(raw).split(':')[0].split('@')[0].replace(/\D/g, '')
 if(s2) return s2
 const alt = m?.key?.participantAlt || ''
 const s3 = String(alt).split(':')[0].split('@')[0].replace(/\D/g, '')
 return s3 || ''
}

function getImage(poke){
 if(!poke) return null
 if(poke.image || poke.img || poke.sprite || poke.foto) return poke.image || poke.img || poke.sprite || poke.foto
 if(poke.id) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${poke.id}.png`
 return null
}

function cleanMentions(...arr){
 const out = []
 for(const x of arr){
 if(!x || x === 'SYSTEM') continue
 const s = String(x)
 if(!s.includes('@')) continue
 if(s.startsWith('@')) continue
 out.push(s)
 }
 return [...new Set(out)]
}

function mentionFor(v, m){
 const num = getNum(v, m)
 if(num) return num + '@s.whatsapp.net'
 if(v && String(v).includes('@') && !String(v).startsWith('@')) return String(v)
 return null
}

function showUser(v, name, m){
 const n = (name || m?.pushName || '').trim()
 if(n) return n
 const num = getNum(v, m)
 if(num) return '@' + num
 return 'Alguien'
}

function completarPoke(poke){
 const p = { ...poke }
 p.name = p.name || p.nombre || '???'
 p.rare = p.rare || p.rareza || 'Común'
 p.tipo = p.tipo || p.type || '?'
 p.valor = p.valor ?? p.value ?? 50
 const base = p.valor || 100
 if(!p.hp) p.hp = Math.floor(40 + (base % 80) + Math.floor(Math.random()*20))
 if(!p.atk) p.atk = Math.floor(40 + (base % 70) + Math.floor(Math.random()*20))
 if(!p.def) p.def = Math.floor(35 + (base % 60) + Math.floor(Math.random()*20))
 if(!p.image) p.image = getImage(p)
 return p
}

function getPokes(user){
 return user.pokes || []
}

function randomPoke(){
 const p = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)]
 return completarPoke({ ...p, uid: 'rand-' + Date.now() + '-' + Math.floor(Math.random()*9999) })
}

function isRandomWord(w){
 if(!w) return false
 const s = w.toLowerCase().trim()
 return s === 'random' || s === 'ramdom' || s === 'ramdo' || s === 'rand' || s === 'radom' || s === 'randon' || s === 'aleatorio' || s === 'azar' || s.startsWith('ram') || s.startsWith('ran') || s.startsWith('rand')
}

async function sendFinal(sock, jid, img, caption, mentions){
 try{
 if(img) return await sock.sendMessage(jid, { image: { url: img }, caption, mentions })
 }catch(e){ console.log('[SUBASTA IMG FALLÓ]', e.message) }
 return await sock.sendMessage(jid, { text: caption, mentions })
}

function darPokemon(db, userJid, poke){
 const pokeFull = completarPoke(poke)
 const num = String(userJid || '').split(':')[0].split('@')[0].replace(/\D/g, '')
 try{
 const u = getUser(db, userJid)
 u.pokes = u.pokes || []
 if(!u.pokes.find(p => p.uid === pokeFull.uid)) u.pokes.push({ ...pokeFull })
 }catch(e){ console.log('[DAR POKEMON ERROR]', e.message) }
 const containers = []
 if(db.users) containers.push(db.users)
 if(db.pokeUsers) containers.push(db.pokeUsers)
 containers.push(db)
 for(const cont of containers){
 if(!cont || typeof cont !== 'object') continue
 for(const key of Object.keys(cont)){
 const val = cont[key]
 if(!val || typeof val !== 'object') continue
 if(!Array.isArray(val.pokes)) continue
 const keyNum = String(key).split(':')[0].split('@')[0].replace(/\D/g, '')
 if(num && keyNum && keyNum === num){
 val.pokes = val.pokes || []
 if(!val.pokes.find(p => p.uid === pokeFull.uid)) val.pokes.push({ ...pokeFull })
 }
 }
 }
 return pokeFull
}

export async function finalizar(sock, jid){
 try{
 const db = loadDB()
 const auc = db.auctions?.[jid] || globalThis.pokeAuctions[jid]
 if(!auc) return false
 if(db.auctions) delete db.auctions[jid]
 delete globalThis.pokeAuctions[jid]
 if(globalThis.pokeTimers[jid]){ clearTimeout(globalThis.pokeTimers[jid]); delete globalThis.pokeTimers[jid] }
 try{ saveDB(db) }catch{}
 const pokeName = auc.pokemon?.name || auc.pokemon?.nombre || '???'

 if(!auc.bidder){
 const msg = auc.isRandom
 ? `> ⏰ *SUBASTA TERMINADA*\n> ❌ Nadie ofertó por *${pokeName}*\n> El pokemon random se escapó...`
 : `> ⏰ *SUBASTA TERMINADA*\n> ❌ Nadie ofertó por *${pokeName}*\n> Se queda con su dueño ${showUser(auc.seller, auc.sellerName)}`
 await sock.sendMessage(jid, { text: msg, mentions: cleanMentions(mentionFor(auc.seller)) })
 return true
 }

 const db2 = loadDB()
 const img = getImage(auc.pokemon)
 const ganadorTxt = showUser(auc.bidder, auc.bidderName)

 if(auc.isRandom){
 const pokeFull = darPokemon(db2, auc.bidder, auc.pokemon)
 const buyer = getUser(db2, auc.bidder)
 buyer.pokeCoins = (buyer.pokeCoins || 0) - Number(auc.currentBid)
 if(db2.auctions) delete db2.auctions[jid]
 saveDB(db2)
 const caption = `> 🏆 *SUBASTA TERMINADA*\n> ❀ *${pokeFull.name}* (RANDOM) vendido!\n> *❏ 𝐼𝐷* : ${pokeFull.id}\n> *✰ 𝑁𝑜𝑚𝑏𝑟𝑒:* ${pokeFull.name}\n> *✵ 𝑇𝑖𝑝𝑜:* ${pokeFull.tipo}\n> *❍ 𝑅𝑎𝑟𝑒𝑧𝑎:* ${pokeFull.rare}\n> *❤️ 𝐻𝑃:* ${pokeFull.hp} | *⚔️ 𝐴𝑇𝐾:* ${pokeFull.atk} | *🛡️ 𝐷𝐸𝐹:* ${pokeFull.def}\n> *✾ 𝑣𝑎𝑙𝑜𝑟:* ${pokeFull.valor} PokeCoins\n> \n> 💰 Ganador: ${ganadorTxt} por *${auc.currentBid}* PokeCoins\n> 🎲 Era un pokemon random, nadie era el dueño\n> 📦 El pokemon ya está en tu colección, usá *.pokedex* para verlo`
 await sendFinal(sock, jid, img, caption, cleanMentions(mentionFor(auc.bidder)))
 return true
 }

 const seller = getUser(db2, auc.seller)
 const sellerPokes = getPokes(seller)
 const idx = sellerPokes.findIndex(p => (p.uid && p.uid === auc.pokemon.uid) || (p.id === auc.pokemon.id && (p.name || p.nombre) === pokeName))
 if(idx !== -1) sellerPokes.splice(idx, 1)
 else {
 const buyer2 = getUser(db2, auc.bidder)
 buyer2.pokeCoins = (buyer2.pokeCoins || 0) + Number(auc.currentBid)
 saveDB(db2)
 await sock.sendMessage(jid, { text: `> ❌ La subasta se canceló, el vendedor ya no tiene ese pokemon.\n> Se te devolvieron ${auc.currentBid} PokeCoins` , mentions: cleanMentions(mentionFor(auc.bidder)) })
 return true
 }
 const pokeFull = completarPoke(auc.pokemon)
 darPokemon(db2, auc.bidder, pokeFull)
 const buyer3 = getUser(db2, auc.bidder)
 buyer3.pokeCoins = (buyer3.pokeCoins || 0) - Number(auc.currentBid)
 seller.pokeCoins = (seller.pokeCoins || 0) + Number(auc.currentBid)
 if(db2.auctions) delete db2.auctions[jid]
 saveDB(db2)
 const vendedorTxt = showUser(auc.seller, auc.sellerName)
 const caption2 = `> 🏆 *SUBASTA TERMINADA*\n> ❀ *${pokeFull.name}* vendido!\n> *❏ 𝐼𝐷* : ${pokeFull.id}\n> *✵ 𝑇𝑖𝑝𝑜:* ${pokeFull.tipo || '?'}\n> *❍ 𝑅𝑎𝑟𝑒𝑧𝑎:* ${pokeFull.rare || '?'}\n> *❤️ 𝐻𝑃:* ${pokeFull.hp} | *⚔️ 𝐴𝑇𝐾:* ${pokeFull.atk} | *🛡️ 𝐷𝐸𝐹:* ${pokeFull.def}\n> *✾ 𝑣𝑎𝑙𝑜𝑟:* ${pokeFull.valor || auc.currentBid} PokeCoins\n> \n> 💰 Ganador: ${ganadorTxt} por *${auc.currentBid}* PokeCoins\n> 💸 Vendedor: ${vendedorTxt} +${auc.currentBid} PokeCoins\n> 📦 Usá *.pokedex* para verlo`
 await sendFinal(sock, jid, img, caption2, cleanMentions(mentionFor(auc.bidder), mentionFor(auc.seller)))
 return true
 }catch(e){
 console.log('[SUBASTA FINALIZAR ERROR]', e)
 try{ await sock.sendMessage(jid, { text: `> ❌ Error al terminar subasta: ${e.message}` }) }catch{}
 return false
 }
}

async function checkExpired(sock, jid){
 const db = loadDB()
 const auc = db.auctions?.[jid] || globalThis.pokeAuctions?.[jid]
 if(auc && auc.endsAt && Date.now() >= auc.endsAt){
 await finalizar(sock, jid)
 return true
 }
 return false
}

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 try{
 learnLid(m)
 const me = senderCanon(m)
 if(await checkExpired(sock, jid)){
 return sock.sendMessage(jid, { text: `> ✅ Esa subasta ya terminó, mirá arriba quien ganó.\n> Podés empezar otra con *.pokesubasta ramdom 100*` }, { quoted: m })
 }
 const db = loadDB()
 if(!db.auctions) db.auctions = {}
 const user = getUser(db, me)
 const myName = m?.pushName || ''

 if(args[0]?.toLowerCase() === 'ver'){
 const auc = db.auctions[jid] || globalThis.pokeAuctions[jid]
 if(!auc) return sock.sendMessage(jid, { text: `> ❌ No hay subasta activa.\n> Usa *.pokesubasta ramdom <precio>*` }, { quoted: m })
 const left = Math.max(0, Math.ceil((auc.endsAt - Date.now())/1000))
 const vendedorTxt = auc.isRandom ? '🎲 Sistema (Random)' : showUser(auc.seller, auc.sellerName)
 const postorTxt = auc.bidder ? showUser(auc.bidder, auc.bidderName) : 'Nadie todavía'
 const pname = auc.pokemon?.name || auc.pokemon?.nombre || '???'
 return sock.sendMessage(jid, { text: `> 🏷️ *SUBASTA ACTIVA*\n> ❀ *${pname}* (ID: ${auc.pokemon.id}) ${auc.isRandom ? '(RANDOM)' : ''}\n> 💰 Oferta actual: *${auc.currentBid}* PokeCoins\n> 👤 Mayor postor: ${postorTxt}\n> 👤 Vendedor: ${vendedorTxt}\n> ⏰ Quedan: *${left}s*\n> \n> Ofertá con *.pokeofrecer <monto>*` , mentions: cleanMentions(mentionFor(auc.bidder), mentionFor(auc.seller)) }, { quoted: m })
 }

 if(args[0]?.toLowerCase() === 'cancelar' || args[0]?.toLowerCase() === 'cancel'){
 const auc = db.auctions[jid]
 if(!auc) return sock.sendMessage(jid, { text: `> ❌ No hay subasta para cancelar.` }, { quoted: m })
 if(auc.isRandom) return sock.sendMessage(jid, { text: `> ❌ No se puede cancelar una subasta random.` }, { quoted: m })
 if(auc.seller !== me) return sock.sendMessage(jid, { text: `> ❌ Solo el vendedor puede cancelarla.` }, { quoted: m })
 if(auc.bidder) return sock.sendMessage(jid, { text: `> ❌ Ya hay ofertas, no se puede cancelar.` }, { quoted: m })
 delete db.auctions[jid]
 delete globalThis.pokeAuctions[jid]
 if(globalThis.pokeTimers[jid]){ clearTimeout(globalThis.pokeTimers[jid]); delete globalThis.pokeTimers[jid] }
 saveDB(db)
 return sock.sendMessage(jid, { text: `> ✅ Subasta de *${auc.pokemon?.name || auc.pokemon?.nombre}* cancelada.` }, { quoted: m })
 }

 if(db.auctions[jid] || globalThis.pokeAuctions[jid]) return sock.sendMessage(jid, { text: `> ❌ Ya hay una subasta activa.\n> Usa *.pokesubasta ver* o *.pokeofrecer <monto>*` }, { quoted: m })

 if(!args[0]) {
 const pokes = getPokes(user)
 const lista = pokes.map((p,i)=> `${i+1}. ${p.name || p.nombre} (ID:${p.id}) - ${p.rare || p.rareza || ''}`).join('\n') || 'No tenés pokemons'
 return sock.sendMessage(jid, { text: `> 🏷️ *POKESUBASTA*\n> Tus pokemons:\n${lista}\n\n*2 MODOS:*\n> 1️⃣ Tuyo: *.pokesubasta <nombre> <precio>*\n> Ej: *.pokesubasta Poltchageist 100*\n> 2️⃣ Random: *.pokesubasta ramdom <precio>*\n> Ej: *.pokesubasta ramdom 100*` }, { quoted: m })
 }

 if(isRandomWord(args[0])){
 const poke = randomPoke()
 let precio = parseInt(args[1])
 if(isNaN(precio)) precio = poke.valor
 if(precio < 1) precio = 1
 const endsAt = Date.now() + 60000
 const auc = { seller: 'SYSTEM', sellerName: 'Sistema', isRandom: true, pokemon: poke, startPrice: precio, currentBid: precio, bidder: null, bidderName: '', endsAt, jid }
 db.auctions[jid] = auc
 globalThis.pokeAuctions[jid] = auc
 saveDB(db)
 if(globalThis.pokeTimers[jid]) clearTimeout(globalThis.pokeTimers[jid])
 globalThis.pokeTimers[jid] = setTimeout(()=> finalizar(sock, jid), 60000)
 const caption = `> 🏷️ *¡NUEVA SUBASTA RANDOM!*\n> ❀ Te salio *(${poke.name})* en subasta\n> *❏ 𝐼𝐷* : ${poke.id}\n> *✰ 𝑁𝑜𝑚𝑏𝑟𝑒:* ${poke.name}\n> *❖ 𝑃𝑒𝑠𝑜:* ${poke.peso}\n> *✧ 𝐴𝑙𝑡𝑢𝑟𝑎:* ${poke.altura}\n> *✵ 𝑇𝑖𝑝𝑜:* ${poke.tipo}\n> *❍ 𝑅𝑎𝑟𝑒𝑧𝑎:* ${poke.rare}\n> *❤️ 𝐻𝑃:* ${poke.hp} | *⚔️ 𝐴𝑇𝐾:* ${poke.atk} | *🛡️ 𝐷𝐸𝐹:* ${poke.def}\n> *✾ 𝑣𝑎𝑙𝑜𝑟:* ${poke.valor} PokeCoins\n> \n> 🎲 Es un pokemon random, NO es tuyo ni de nadie\n> 👤 Lo puso en subasta: ${showUser(me, myName, m)}\n> 💰 Precio inicial: *${precio}* PokeCoins\n> ⏰ Tiempo: *60s*\n> \n> Ofertá con *.pokeofrecer <monto>*`
 const img = getImage(poke)
 if(img){
 try{ return sock.sendMessage(jid, { image: { url: img }, caption, mentions: cleanMentions(mentionFor(me, m)) }, { quoted: m }) }catch{}
 }
 return sock.sendMessage(jid, { text: caption, mentions: cleanMentions(mentionFor(me, m)) }, { quoted: m })
 }

 const pokes = getPokes(user)
 if(!pokes.length) return sock.sendMessage(jid, { text: `> ❌ No tenés pokemons para subastar.\n> Probá con *.pokesubasta ramdom 100*` }, { quoted: m })
 let precio = parseInt(args[args.length-1])
 let query = args.join(' ')
 if(isNaN(precio)){ precio = 50 } else { query = args.slice(0, -1).join(' ') }
 if(precio < 1) precio = 1
 let poke = null
 const idxNum = parseInt(query)
 if(!isNaN(idxNum) && pokes[idxNum-1]) poke = pokes[idxNum-1]
 if(!poke) poke = pokes.find(p => String(p.id) === query)
 if(!poke) poke = pokes.find(p => (p.name || p.nombre)?.toLowerCase() === query.toLowerCase())
 if(!poke) poke = pokes.find(p => (p.name || p.nombre)?.toLowerCase().includes(query.toLowerCase()))
 if(!poke) return sock.sendMessage(jid, { text: `> ❌ No encontré ese pokemon en tu colección.\n> Usa *.pokesubasta* para ver tu lista.` }, { quoted: m })
 const endsAt = Date.now() + 60000
 const auc = { seller: me, sellerName: myName, isRandom: false, pokemon: completarPoke(poke), startPrice: precio, currentBid: precio, bidder: null, bidderName: '', endsAt, jid }
 db.auctions[jid] = auc
 globalThis.pokeAuctions[jid] = auc
 saveDB(db)
 if(globalThis.pokeTimers[jid]) clearTimeout(globalThis.pokeTimers[jid])
 globalThis.pokeTimers[jid] = setTimeout(()=> finalizar(sock, jid), 60000)
 const pname = poke.name || poke.nombre
 const caption = `> 🏷️ *¡NUEVA SUBASTA!*\n> ❀ Te salio *(${pname})* en subasta\n> *❏ 𝐼𝐷* : ${poke.id}\n> *✰ 𝑁𝑜𝑚𝑏𝑟𝑒:* ${pname}\n> *✵ 𝑇𝑖𝑝𝑜:* ${poke.tipo || '?'}\n> *❍ 𝑅𝑎𝑟𝑒𝑧𝑎:* ${poke.rare || poke.rareza || '?'}\n> *❤️ 𝐻𝑃:* ${poke.hp || '?'} | *⚔️ 𝐴𝑇𝐾:* ${poke.atk || '?'} | *🛡️ 𝐷𝐸𝐹:* ${poke.def || '?'}\n> *✾ 𝑣𝑎𝑙𝑜𝑟:* ${poke.valor || precio} PokeCoins\n> \n> 👤 Vendedor: ${showUser(me, myName, m)}\n> 💰 Precio inicial: *${precio}* PokeCoins\n> ⏰ Tiempo: *60s*\n> \n> Ofertá con *.pokeofrecer <monto>*`
 const img = getImage(poke)
 if(img){
 try{ return sock.sendMessage(jid, { image: { url: img }, caption, mentions: cleanMentions(mentionFor(me, m)) }, { quoted: m }) }catch{}
 }
 await sock.sendMessage(jid, { text: caption, mentions: cleanMentions(mentionFor(me, m)) }, { quoted: m })
 }catch(e){
 console.log('[POKESUBASTA ERROR]', e)
 try{ await sock.sendMessage(jid, { text: `> ❌ Error en subasta: ${e.message}` }, { quoted: m }) }catch{}
 }
}

export default handler
