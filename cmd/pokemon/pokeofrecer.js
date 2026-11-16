import { loadDB, saveDB, senderCanon, learnLid, getUser } from '../../lib/poke.js'
import { finalizar } from './pokesubasta.js'

export const handler = {}
handler.name = 'pokeofrecer'
handler.alias = ['ofrecer', 'oferta', 'bid', 'puja']
handler.category = 'pokemon'

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

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 try{
 learnLid(m)
 const me = senderCanon(m)
 const db0 = loadDB()
 const auc0 = db0.auctions?.[jid] || globalThis.pokeAuctions?.[jid]
 if(auc0 && auc0.endsAt && Date.now() >= auc0.endsAt){
 await finalizar(sock, jid)
 return sock.sendMessage(jid, { text: `> ⏰ Esa subasta ya terminó, mirá arriba quien ganó.` }, { quoted: m })
 }

 const db = loadDB()
 if(!db.auctions) db.auctions = {}
 const auc = db.auctions[jid] || globalThis.pokeAuctions?.[jid]
 if(!auc) return sock.sendMessage(jid, { text: `> ❌ No hay ninguna subasta activa.\n> Empezá una con *.pokesubasta ramdom <precio>*` }, { quoted: m })

 const user = getUser(db, me)
 const monto = parseInt(args[0])
 const current = Number(auc.currentBid) || 0
 const pname = auc.pokemon?.name || auc.pokemon?.nombre || '???'

 if(!monto || isNaN(monto)) return sock.sendMessage(jid, { text: `> ❌ Uso: *.pokeofrecer <monto>*\n> Ej: *.pokeofrecer ${current + 10}*` }, { quoted: m })
 if(!auc.isRandom && auc.seller === me) return sock.sendMessage(jid, { text: `> ❌ No podés ofertar en tu propia subasta.` }, { quoted: m })
 if(auc.bidder === me) return sock.sendMessage(jid, { text: `> ❌ Ya sos el mayor postor con *${current}* PokeCoins.\n> Esperá que alguien te supere.` }, { quoted: m })
 if(monto <= current) return sock.sendMessage(jid, { text: `> ❌ Tu oferta tiene que ser mayor a *${current}* PokeCoins.\n> Probá con *.pokeofrecer ${current + 1}*` }, { quoted: m })
 if((user.pokeCoins || 0) < monto) return sock.sendMessage(jid, { text: `> ❌ No tenés suficientes PokeCoins.\n> Tenés *${user.pokeCoins || 0}* y querés ofertar *${monto}*` }, { quoted: m })

 auc.currentBid = monto
 auc.bidder = me
 auc.bidderName = m?.pushName || auc.bidderName || ''
 db.auctions[jid] = auc
 if(!globalThis.pokeAuctions) globalThis.pokeAuctions = {}
 globalThis.pokeAuctions[jid] = auc
 saveDB(db)

 const left = Math.max(0, Math.ceil((auc.endsAt - Date.now())/1000))
 const quien = showUser(me, m?.pushName, m)
 const text = `> 💰 *¡NUEVA OFERTA!*\n> 👤 ${quien} ofertó *${monto}* PokeCoins por *${pname}* ${auc.isRandom ? '(RANDOM)' : ''}\n> ⏰ Quedan *${left}s* para que termine\n> \n> Superalo con *.pokeofrecer ${monto + 10}*`
 await sock.sendMessage(jid, { text, mentions: cleanMentions(mentionFor(me, m)) }, { quoted: m })
 }catch(e){
 console.log('[POKEOFRECER ERROR]', e)
 try{ await sock.sendMessage(jid, { text: `> ❌ Error al ofertar: ${e.message}` }, { quoted: m }) }catch{}
 }
}

export default handler
