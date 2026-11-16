import config from '../../config.js'
export const handler={}
handler.name='test'
handler.exec=async(sock,m)=>{
m.reply("Funciona! Variables: " + typeof args + " | " + typeof text + " | " + typeof q)
}
export default handler
