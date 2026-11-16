export const handler = {}
handler.name = 'test2'
handler.alias = ['test2']
handler.category = 'utiles'
handler.owner = false
handler.admin = false
handler.botAdmin = false
handler.cooldown = 3

handler.exec = async (...args) => {
  let sock, m
  if (args[0]?.key) { m = args[0]; sock = args[1]?.conn || global.conn }
  else { sock = args[0]; m = args[1] }

  let jid = m.key.remoteJid
  let url = 'https://locos-y-asociados-cdn.onrender.com/i/PM2vw.png'

  return await sock.sendMessage(jid, {
    image: { url: url },
    caption: `si funciona ${url}`
  }, { quoted: m })
}

export default handler