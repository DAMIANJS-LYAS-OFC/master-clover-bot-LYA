import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'test'
handler.alias = ['testdoc', 'testbanner']
handler.category = 'info'

handler.exec = async (sock, m, args) => {
  const chat = m.key.remoteJid

  let num = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.replace(/\D/g, '') || ''
  num = String(num).replace(/\D/g, '')

  const botName =
    sock.subConfig?.botName ||
    sock.subConfig?.name ||
    sock.principalConfig?.botName ||
    sock.principalConfig?.name ||
    global.botName ||
    'Bot'

  const dbDir = path.join(process.cwd(), 'db')
  const posibles = [
    sock.subConfig?.banner,
    sock.principalConfig?.banner,
    path.join(dbDir, `banner_${num}.jpg`),
    path.join(dbDir, 'banner_main.jpg')
  ]

  let bannerPath = null
  for (const p of posibles) {
    if (!p) continue
    if (String(p).startsWith('http')) continue
    const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
    if (fs.existsSync(full)) {
      bannerPath = full
      break
    }
  }

  if (!bannerPath && fs.existsSync(dbDir)) {
    const files = fs.readdirSync(dbDir).filter(f => f.startsWith('banner_'))
    if (files.length) bannerPath = path.join(dbDir, files[0])
  }

  if (!bannerPath) {
    return sock.sendMessage(chat, { text: '❌ No hay banner guardado' }, { quoted: m })
  }

  try {
    // Documento = los bytes originales de la foto, SIN alterar su calidad ni dimensiones.
    const original = fs.readFileSync(bannerPath)

    // Creamos SOLO una miniatura separada para la vista previa del documento.
    // "inside" no recorta ni cambia el encuadre original.
    const preview = await sharp(original)
      .rotate()
      .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer({ resolveWithObject: true })

    // Nombre y MIME acordes con el formato REAL de la imagen original.
    const metadata = await sharp(original).metadata()
    const formatos = {
      jpeg: ['jpg', 'image/jpeg'],
      png: ['png', 'image/png'],
      webp: ['webp', 'image/webp'],
      gif: ['gif', 'image/gif'],
      avif: ['avif', 'image/avif'],
      tiff: ['tiff', 'image/tiff']
    }
    const [extension, mimetype] = formatos[metadata.format] || [
      path.extname(bannerPath).slice(1).toLowerCase() || 'bin',
      'application/octet-stream'
    ]

    return await sock.sendMessage(chat, {
      document: original, // Foto original intacta; no se reemplaza ni se comprime.
      fileName: `${String(botName).replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'}.${extension}`,
      mimetype,
      jpegThumbnail: preview.data.toString('base64'),
      thumbnailWidth: preview.info.width,
      thumbnailHeight: preview.info.height,
      caption: 'Test funcionando'
    }, { quoted: m })
  } catch (e) {
    console.error('[test] Error al enviar el banner como documento:', e)
    return sock.sendMessage(chat, { text: `❌ Error: ${e.message}` }, { quoted: m })
  }
}

export default handler