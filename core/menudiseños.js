export const PREWEB_LINK = 'https://locos-y-asociados-cdn.onrender.com'
export const PREWEB_BANNER = 'https://raw.githubusercontent.com/starlyn-chann/Mistic-star/main/tourl/1791658575065-D6ufbDFJC7Mv.jpg'
export function getPreweb(botName, banner){
 return {
 title: botName || 'MASTER CLOVER',
 body: `—͟͟͞͞© Powered by Damian OFC | ${botName || 'MASTER CLOVER'}`,
 sourceUrl: PREWEB_LINK,
 thumbnailUrl: banner || PREWEB_BANNER
 }
}
function toSmallCaps(str){
 const map = {a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ғ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'}
 return str.toLowerCase().split('').map(c=>map[c]||c).join('').toUpperCase()
}
function toFancy(str){ return str.toUpperCase() }
export const diseños = {
 normal: {
 name: 'normal', link: PREWEB_LINK,
 render: ({usermcn, botName, type, saludo, cmds, users, categories})=>{
 let bloques=''
 for(let [cat,list] of categories){
 let big = toFancy(cat)
 bloques+=`╭── ${big}\n${list.map(c=>`│๛ ${c.name}`).join('\n')}\n╰──────────────╯\n\n`
 }
 return `🔗 ${PREWEB_LINK}\n${usermcn} Bienvenido a mi menu de comandos Soy ${botName} ${type} Espero tengas una ${saludo}\n📦 Plugins ➤ ${cmds}\n👤 Usuarios ➤ ${users}\n▭▭▭▭▭▭▭▭\n THE LEGENCY EDITION\n▭▭▭▭▭▭\n\n${bloques}`.trim()
 }
 },
 pro: {
 name: 'pro', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories, prefix, uptime, hora, fecha})=>{
 let bloques=''
 for(let [cat,list] of categories){
 bloques+=`> ╭━━❑ *${toSmallCaps(cat)}* ❑\n${list.map(c=>`> | ◈ ${c.name}`).join('\n')}\n> ╰━━❏\n`
 }
 return `🔗 ${PREWEB_LINK}\n╭─◈ *ʟᴏᴄᴏꜱ • ʏ • ᴀꜱᴏᴄɪᴀᴅᴏꜱ • ʟʏᴀ*\n> ╭━━❑ *sᴛᴀᴛᴜs* ❑\n> | *ᴜsᴇʀ* : ${usermcn.trim()}\n> | *ᴛɪᴘᴏ* : ${type}\n> | *ʙᴏᴛ* : ${botName}\n> | *ᴄᴏᴍᴀɴᴅᴏꜱ* : ${cmds}\n> | *ᴍᴏᴅᴏ* : 🔓 \n> | *ᴅᴇᴠᴇʟᴏᴘᴇʀ* : ᴅᴀᴍɪᴀɴ.ᴊꜱ\n> | *ᴜᴘᴛɪᴍᴇ* : ${uptime || 'online'}\n> | *ʜᴏʀᴀ* : ${hora || ''}\n> ╰━━❏\n${bloques}╰─◈ _— \`ᴛᴏᴛᴀʟ ᴄᴏᴍᴀɴᴅᴏꜱ\` ${cmds} --_`.trim()
 }
 },
 cawai: {
 name: 'cawai', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories, prefix})=>{
 let p = prefix || '.'
 let bloques = ''
 for(let [cat, list] of categories){
 bloques += `- ꪆ ଘ៸៸᳐⦁⩊⦁៸៸᳐ଓ *\`${cat.toUpperCase()}\`* ᰨᰍ *;*\n`
 bloques += `> ✐ Comandos de ${cat.toLowerCase()}.\n\n`
 for(let c of list){
 let name = c.name || c.cmd || ''
 let alias = c.alias && c.alias.length ? ` › ${c.alias.map(a => `${p}${a}`).join(' › ')}` : ''
 let desc = c.description || c.desc || c.info || ''
 bloques += `❀ ᠀᠀ㅤ۟ ${p}${name}${alias} + _<mention>_\n`
 if(desc) bloques += `> ── 𑁪ㅤׅㅤ۫ _${desc}._\n`
 }
 bloques += `\n`
 }
 return `🔗 ${PREWEB_LINK}\n ── ˙ ¡𝐇ola!, soy ${botName} (${type}) .
✎ ᴀǫᴜɪ ᴛɪᴇɴᴇs ʟᴀ ʟɪsᴛᴀ ᴅᴇ ʟᴏs ᴄᴏᴍᴀɴᴅᴏs
︵𝆣᷼ ͡︵᷼𝆣 ᷼͡︵᷼𝆣 ᷼͡︵ ᅟິᅟᅟ︵𝆣᷼ ͡︵᷼𝆣 ᷼͡︵᷼𝆣 ᷼͡︵
- 𐫦ϟ │ 𝐄nlace:
⸺　${PREWEB_LINK}
- 𐫦ϟ │ 𝐃eveloper: 
⸺　𐚁ᴅᴀᴍɪᴀɴᴊs-ᴏғᴄ
ᅟᅟ︶͜︶͜︶ᅟᅟ֪ᅟ֪ᅟᅟ︶͜︶͜︶
> (⁠◠⁠‿⁠◕⁠) Conecta un subbot utilizando el comando: *${p}code + numero*
> ✐ Gracias por usar ${botName}
${bloques}`.trim()
 }
 },
 acuatico: {
 name: 'acuatico', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories})=>{
 let bloques=''
 for(let [cat,list] of categories){
 bloques+=`╭─ 🌊 ${cat.toUpperCase()}\n${list.map(c=>`│≋ ${c.name}`).join('\n')}\n╰──────────────╯\n\n`
 }
 return `🔗 ${PREWEB_LINK}\n${usermcn} / 🫧 ${botName} - Deep Sea Edition ⚓\n📦 Plugins » ${cmds} | 👤 Usuarios » ${users}\n\n${bloques}`.trim()
 }
 },
 marino: {
 name: 'marino', link: PREWEB_LINK,
 render: ({usermcn, botName, cmds, users, categories})=>{
 let bloques = ''
 for(let [cat, list] of categories){
 let cl = cat.toLowerCase()
 let ico = '𓆞'
 if(cl.includes('econom') || cl.includes('descarg') || cl.includes('subbot') || cl.includes('poke') || cl.includes('album')) ico = '𓆟'
 if(cl.includes('util') || cl.includes('owner') || cl.includes('gacha') || cl.includes('info') || cl.includes('intel') || cl.includes('nsfw')) ico = '𓆝'
 bloques += `╭─${ico} ༄✦ ${cat.toUpperCase()} ✦༄${ico}─╮\n`
 bloques += list.map(c=>`│ ${ico} 〄 ${c.name}`).join('\n')
 bloques += `\n╰──────────────────╯\n`
 }
 return `🔗 ${PREWEB_LINK}\n${usermcn} / 𝙈𝘼𝙎𝙏𝙀𝙍 𝘾𝙇𝙊𝙑𝙀𝙍 - 𝘽𝙇𝘼𝘾𝙆 𝙎𝙀𝘼 ⚓\nBienvenido a mi menú de comandos. Soy ${botName} 🐚🌊\n╭─── Navigating The Deep Ocean ───╮\n𓆉 PLUGINS : ${cmds}\n𓆝 USERS : ${users}\n𓆟 EDITION : LEGACY\n╰────────────────────────────────╯\n─── ⋆ 🌊 𓊝 𝑴𝑨𝑹𝑰𝑵𝑬 𝑴𝑬𝑵𝑼 𓊝 🌊 ⋆ ───\n${bloques}`.trim()
 }
 },
 nares: {
 name: 'nares', link: PREWEB_LINK,
 render: ({usermcn, botName, cmds, users, categories})=>{
 let bloques = ''
 for(let [cat, list] of categories){
 let cl = cat.toLowerCase()
 let ico = '𓆩𝕯𓆪'
 if(cl.includes('menu')) ico = '𓆩♰𓆪'
 if(cl.includes('econom') || cl.includes('descarg') || cl.includes('subbot') || cl.includes('poke') || cl.includes('album')) ico = '𓆩⚰️𓆪'
 if(cl.includes('util') || cl.includes('owner') || cl.includes('gacha') || cl.includes('info') || cl.includes('intel') || cl.includes('nsfw') || cl.includes('activar')) ico = '𓆩♰𓆪'
 if(cl.includes('grupo') || cl.includes('perfil') || cl.includes('juego') || cl.includes('mini')) ico = '𓆩𝕯𓆪'
 let catName = `𝕻𝕬𝕾𝕰𝕾 ${cat.toUpperCase()} 𝕻𝕬𝕾𝕰𝕾`
 bloques += `╭─${ico} ${catName} ${ico}─╮\n`
 bloques += list.map(c=>`│ ${ico} 𝕹 ${c.name}`).join('\n')
 bloques += `\n╰──────────────────────────╯\n`
 }
 return `🔗 ${PREWEB_LINK}\n> ${botName}\n~_Bienvenido a mi menú de comandos. Soy ${botName}_ 🦇⚰️\n╭─── 𝕬𝖜𝖆𝖐𝖊𝖓𝖎𝖓𝖌 𝕿𝖍𝖊 𝕯𝖆𝖗𝖐 𝕬𝖇𝖞𝖘𝖘 ───╮\n𓆩✟𓆪 PLUGINS : ${cmds}\n𓆩✟𓆪 USERS : ${users}\n𓆩✟𓆪 EDITION : 𝕲𝕺𝕿𝕳𝕴𝕮\n╰──────────────────────────────╯\n─── ⋆ 𝕷 𝕬 𝕽 𝕺 𝕾 𝕬 𝕸 𝕰 𝕹 𝖀 ⋆ ───\n${bloques}`.trim()
 }
 },
 astral: {
 name: 'astral', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories, hora, fecha, prefix})=>{
 let bloques=''
 for(let [cat,list] of categories){
 bloques+=`╠═ 🔧 ${cat.toUpperCase()} ══\n${list.map(c=>`║ ❀ ${prefix || '.'}${c.name}`).join('\n')}\n`
 }
 return `🔗 ${PREWEB_LINK}\n╔══════════════════╗\n║ *LOCOS Y ASOCIADOS*\n╠═══════════════════\n║ Hola ${usermcn} Soy ${botName}\n║ *Bienvenido a mi menu de comandos*\n║ Tipo: ${type} | Plugins: ${cmds}\n╠════════════════════\n${bloques}\n╚═══════════════╝`.trim()
 }
 },
 galactico: {
 name: 'galactico', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories})=>{
 let bloques=''
 for(let [cat,list] of categories){
 bloques+=`╭─ 🎮 ${cat} - Galactic\n${list.map(c=>`│ 乂 ${c.name}`).join('\n')}\n╰──────\n\n`
 }
 return `🔗 ${PREWEB_LINK}\n╭━━━━━━━━━━━━━━━━━╮\n┃ THE LEGENCY ┃\n╰━━━━━━━━━━━━━━━━━╯\n${usermcn.trim()} Bienvenido a ${botName} ${type}\nPlugins: ${cmds} | Usuarios: ${users}\n\n${bloques}`.trim()
 }
 },
 hallowen: {
 name: 'hallowen', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories})=>{
 let bloques=''
 for(let [cat,list] of categories){
 let big = toFancy(cat)
 bloques+=`┏━━━━━ ${big}\n${list.map(c=>` 🎃 ${c.name}`).join('\n')}\n┗━━━✦❘༻༺❘✦━━━┛\n\n`
 }
 return `🔗 ${PREWEB_LINK}\n◢◤◢◤✦ THE LEGENCY ✦◥◣◥◣\n EDITION HALLOWEN\n${usermcn} Bienvenido Soy ${botName} ${type}\nPlugins: ${cmds} | Usuarios: ${users}\n\n${bloques}`.trim()
 }
 },
 electro: {
 name: 'electro', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories})=>{
 let out = `🔗 ${PREWEB_LINK}\n█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█\n█ ${usermcn.trim()} Bienvenido █\n█ ${botName} ${type} █\n█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█\n\n`
 for(let [cat,list] of categories){
 out+=`█ ${cat}\n${list.map(c=>`█ ${c.name}`).join('\n')}\n█▄▄▄▄▄▄▄▄▄▄█\n\n`
 }
 return out.trim()
 }
 },
 simple: {
 name: 'simple', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories, prefix, uptime, level, exp})=>{
 let bloques=''
 for(let [cat,list] of categories){
 bloques+=`*${cat.toUpperCase()}* [${list.length}]\n${list.map(c=>`- ${prefix}${c.name}`).join('\n')}\n\n`
 }
 return `🔗 ${PREWEB_LINK}\nHola ${usermcn.trim()}! Soy *${botName}* ${type}\nComandos: ${cmds}\n\n${bloques}`.trim()
 }
 },
 naturaleza: {
 name: 'naturaleza', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories, prefix, uptime, hora, fecha})=>{
 let bloques = ''
 for(let [cat, list] of categories){
 bloques += `╭┈ࠢ͜┅ࠦ͜͜╾݊͜─ؕ͜─ׄ͜─֬͜─֟͜─֫͜─ׄ͜─ؕ͜─݊͜┈ࠦ͜┅ࠡ͜͜┈࠭͜͜۰۰͜۰─͜─ׄ֟፝͜─ׄ͜─ׄ͜\n`
 bloques += `> 🍃 Categoría: ${cat.toUpperCase()}\n`
 for(let c of list){
 let desc = c.description || c.desc || c.info || ''
 bloques += ` | ${prefix || '.'}${c.name}\n`
 if(desc) bloques += `> ${desc}\n`
 }
 bloques += `╰ׅ͜─֟͜─͜─ٞ͜─͜─๊͜─͜─๋͜─⃔═̶፝֟͜═̶⃔─๋͜─͜─͜─๊͜─๊͜─ٞ͜─͜─֟͜┈ࠢ͜╯ׅ\n\n`
 }
 return `🔗 ${PREWEB_LINK}\n> 🪴 ¡Hola! *${usermcn.trim()}*, Soy *${botName}*, Aquí tienes la lista de comandos. *ฅ⁠^⁠•⁠ﻌ⁠•⁠^⁠ฅ*
╭┈ࠢ͜┅ࠦ͜͜╾݊͜─ؕ͜─ׄ͜─֬͜─֟͜─֫͜─ׄ͜─ؕ͜─݊͜┈ࠦ͜┅ࠡ͜͜┈࠭͜͜۰۰͜۰
│🌱 *ᴅᴇᴠᴇʟᴏᴘᴇʀ ::* 𐚁ᴅᴀᴍɪᴀɴᴊs-ᴏғᴄ
│❀ *ᴛʏᴘᴇ ::* ${type}
│❀ *ᴠᴇʀsɪᴏɴ ::* naturaleza 🌱
│❒ *sʏsᴛᴇᴍ/ᴏᴘʀ ::* ${process.platform || 'linux'}
│❒ *ᴛɪᴍᴇ ::* ${hora || ''} - ${fecha || ''}
│❒ *ᴜsᴇʀs ::* ${users}
╰ׅ┈ࠢ͜─ׄ͜─ׄ֟፝͜─ׄ͜─ׄ͜╴ ⋱࣭ ᩴ ⋮֔ ᩴ ⋰╶͜─ׄ͜─ׄ֟፝͜─ׄ͜─ׄ͜┈ࠢ͜╯ׅ
> Vincula un *Subbot* con tu número utilizando *.code +numero*.
> CDN oficial: ${PREWEB_LINK}
> —͟͟͞͞★ LYA\` CLUB ★—͟͟͞͞
‧꒷︶꒷꒥꒷‧₊˚꒷︶꒷꒥꒷︶꒷˚₊‧꒷꒥꒷︶꒷‧
${bloques}`.trim()
 }
 },
 navidad: {
 name: 'navidad', link: PREWEB_LINK,
 render: ({usermcn, botName, type, cmds, users, categories, prefix, uptime, hora, fecha, saludo})=>{
 let bloques = ''
 for(let [cat, list] of categories){
 let cl = cat.toLowerCase()
 let ico = '🎄'
 if(cl.includes('admin') || cl.includes('grupo')) ico = '🛠️'
 if(cl.includes('descarg') || cl.includes('download')) ico = '🔔'
 if(cl.includes('juego') || cl.includes('mini') || cl.includes('diver') || cl.includes('activ')) ico = '🎮'
 if(cl.includes('ia') || cl.includes('herram') || cl.includes('util') || cl.includes('info')) ico = '🤖'
 if(cl.includes('menu') || cl.includes('general')) ico = '🎅'
 if(cl.includes('owner') || cl.includes('due')) ico = '👑'
 bloques += `🎁🎄━━━━━━━━❄️━━━━━━━━🎄🎁\n\n`
 bloques += `${ico} ${cat.toUpperCase()} ${ico}\n`
 bloques += list.map(c=>`🎅 ${prefix || '.'}${c.name}`).join('\n')
 bloques += `\n\n`
 }
 return `🔗 ${PREWEB_LINK}\n🎄✨🎅❄️🎁⛄🎄✨🎅❄️🎁⛄🎄✨
🎄🎅 M E N Ú N A V I D E Ñ O 🎅🎄
🎄✨🎅❄️🎁⛄🎄✨🎅❄️🎁⛄🎄✨
🎅 ¡HO HO HO! ${usermcn}
✨ Soy ${botName} ✨
🎁 ¡Bienvenido al taller de LYA! 🎁
⛄ ¿Te portaste bien este año? ⛄
❄️ Si no, igual te dejamos usar el bot ❄️
🕯️ ${saludo || ''}
╭─🎄─ INFO DEL BOT ─🎄─╮
│ ☘️ Nombre › ${botName}
│ 👑 Desarrollador › 𐚁ᴅᴀᴍɪᴀɴᴊs-ᴏғᴄ
│ 🤖 Tipo › ${type}
│ 📦 Comandos › ${cmds}
│ 👤 Usuarios › ${users}
│ 🔰 Prefijo › ${prefix || '.'}
│ 🌍 Modo › Público
│ ⚡ Uptime › ${uptime || '24/7'}
│ 🕒 Hora › ${hora || ''} - ${fecha || ''}
│ 🎄 Temporada › Navidad
╰─🎄───────────────🎄─╯
 ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸
> ⠟🎄 Puedes vincular un subbot con el comando ${prefix || '.'}code + numero
> ⠟ ⛄CDN: ${PREWEB_LINK}
> ⠟🌱 Evento navideño: (vacío aún)
 ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸
${bloques}🎁🎄━━━━━━━━❄️━━━━━━━━🎄🎁
🎄✨ ¡FELIZ NAVIDAD DE LYA! ✨🎄
☘️ ${botName} te desea una feliz estadía ☘️
🎅 Usa ${prefix || '.'}menu para ver esto de nuevo 🎅
🎁🎄❄️⛄🎅✨🎁🎄❄️⛄🎅✨`.trim()
 }
 }
}
export function getDiseño(name){ return diseños[name?.toLowerCase()] || diseños['normal'] }
