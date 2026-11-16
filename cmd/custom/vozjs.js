import config from '../../config.js'
export const handler={}
handler.name='vozjs'
handler.exec=async(sock,m)=>{
(o agrégalo en tu manejador de comandos oficial)
const fetch = require("node-fetch");

let handler = async (m, { conn, text, usedPrefix, command }) => {
 if (!text) return m.reply(`⚠️ Uso incorrecto.\n\nEjemplo:\n*${usedPrefix + command} mickey Hola muchachos*`);

 // Separar el personaje y el texto
 const partes = text.trim().split(" ");
 const personaje = partes[0].toLowerCase();
 const mensaje = partes.slice(1).join(" ");

 if (!mensaje) return m.reply("⚠️ ¡Te faltó escribir el texto que dirá el personaje!");

 // Diccionario de tokens de voz de FakeYou
 const modelos = {
 "mickey": "TM:7wbtjhfdy230",
 "bart": "TM:4e226258101c",
 "homero": "TM:9a115147091b",
 "bobesponja": "TM:3c226258102f",
 "goku": "TM:eb226258102a",
 "vegeta": "TM:2c226258105h",
 "badbunny": "TM:9k226258108l",
 "daddyyankee": "TM:4m226258109m",
 "loquendo": "TM:5v226258116u"
 };

 const modelToken = modelos[personaje];
 if (!modelToken) {
 const disponibles = Object.keys(modelos).join(", ");
 return m.reply(`❌ Personaje no encontrado.\n\n*Disponibles:* ${disponibles}`);
 }

 await m.reply("🎙️ Generando audio con IA, espera un momento...");

 try {
 // 1. Petición para crear el trabajo de inferencia en FakeYou
 const res = await fetch("https://api.fakeyou.com/tts/inference", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 tts_model_token: modelToken,
 uuid_idempotency_token: require("crypto").randomUUID(),
 inference_text: mensaje
 })
 });

 const data = await res.json();
 if (!data.success) return m.reply("❌ Error al conectar con la API de FakeYou.");

 const jobToken = data.inference_job_token;
 let audioUrl = null;

 // 2. Bucle de espera para consultar el estado del audio
 for (let i = 0; i < 20; i++) {
 await new Promise(resolve => setTimeout(resolve, 3000)); // Espera 3 segundos por intento
 const check = await fetch(`https://api.fakeyou.com/tts/job/${jobToken}`);
 const jobData = await check.json();

 if (jobData.state && jobData.state.status === "complete_success") {
 audioUrl = `https://storage.googleapis.com/vocodes-public${jobData.state.maybe_public_bucket_wav_path}`;
 break;
 } else if (jobData.state && (jobData.state.status === "failed" || jobData.state.status === "dead")) {
 break;
 }
 }

 if (!audioUrl) return m.reply("❌ El servidor tardó demasiado procesando el audio.");

 // 3. Enviar el resultado como nota de voz (PTT)
 await conn.sendMessage(m.chat, { 
 audio: { url: audioUrl }, 
 mimetype: "audio/mp4", 
 ptt: true 
 }, { quoted: m });

 } catch (e) {
 m.reply(`❌ Error crítico en el comando: ${e.message}`);
 }
};

handler.help = ['voz [personaje] [texto]'];
handler.tags = ['tools', 'ai'];
handler.command = /^(voz|fv|fakeyou)$/i;

module.exports = handler;
}
export default handler
