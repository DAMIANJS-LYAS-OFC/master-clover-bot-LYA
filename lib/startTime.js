import fs from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'db', 'bot_start.json')

export function getBotStartTime(){
 try{
 const dir = path.dirname(FILE)
 if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
 // Si ya existe, NO lo pisamos, ese es el chiste
 if(fs.existsSync(FILE)){
 const j = JSON.parse(fs.readFileSync(FILE, 'utf8'))
 if(j.start) return new Date(j.start)
 }
 // Primera vez que se prende el bot en la vida
 const now = new Date()
 fs.writeFileSync(FILE, JSON.stringify({ start: now.toISOString() }, null, 2))
 return now
 }catch{
 return new Date(Date.now() - process.uptime()*1000)
 }
}

export function getBotUptimeMs(){
 return Date.now() - getBotStartTime().getTime()
}

export function resetBotStartTime(){
 try{ if(fs.existsSync(FILE)) fs.unlinkSync(FILE) }catch{}
 return getBotStartTime()
}
