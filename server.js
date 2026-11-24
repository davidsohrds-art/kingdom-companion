'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const port=Number(process.env.PORT||8080), host=process.env.HOST||'0.0.0.0', data=process.env.DATA_FILE||path.join(__dirname,'data','rooms.json');
fs.mkdirSync(path.dirname(data),{recursive:true});
let rooms={};try{rooms=JSON.parse(fs.readFileSync(data,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const rate=new Map();const kinds=['chat','events','news','agreements','tasks'];const room=n=>{const r=rooms[n]??={};for(const k of [...kinds,'reports'])r[k]??=[];return r};
function save(){const temp=data+'.tmp';fs.writeFileSync(temp,JSON.stringify(rooms,null,2));fs.renameSync(temp,data);}
function reply(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function clean(s,max){return typeof s==='string'?s.trim().slice(0,max):'';}
function publicItem({owner,votes,claim,attendance,...rest},who){return {...rest,mine:owner===who,...(votes?{votes:Object.values(votes),myVote:votes[who]?.choice||null}:{}),...(claim?{claim:{name:claim.name,alliance:claim.alliance,mine:claim.owner===who}}:{}),...(attendance?{attendance:Object.values(attendance),myAttendance:attendance[who]?.choice||null}:{})};}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',b=>{s+=b;if(s.length>12000){reject(new Error('Zu groß'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(s));}catch{reject(new Error('Ungültige Daten'));}});req.on('error',reject);});}
const files={'/':'index.html','/index.html':'index.html'};
const security=require('./security')(data,reply,body);
http.createServer(async(req,res)=>{try{
const u=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
if(req.method==='GET'&&u.pathname==='/healthz')return reply(res,200,{ok:true});
if(req.method==='GET'&&files[u.pathname]){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'public',files[u.pathname])));}
if(await security.route(req,res,u))return;
const m=u.pathname.match(/^\/api\/rooms\/([1-9][0-9]{0,7})(?:\/(chat|events|news|agreements|tasks|action|report))?$/);if(!m)return reply(res,404,{error:'Nicht gefunden'});
const [,n,kind]=m;const user=security.auth(req);if(!user)return reply(res,401,{error:'Bitte anmelden'});if(user.kingdom!==n)return reply(res,403,{error:'Falsches Königreich'});const owner=user.id;
if(req.method==='GET'&&!kind){const r=rooms[n]||{};return reply(res,200,Object.fromEntries(kinds.map(k=>[k,(r[k]||[]).map(x=>publicItem(x,owner))])));}
if(!['POST','DELETE'].includes(req.method)||!kind)return reply(res,405,{error:'Methode nicht erlaubt'});
const key=req.socket.remoteAddress, now=Date.now(), prev=(rate.get(key)||[]).filter(t=>now-t<60000);if(prev.length>=60)return reply(res,429,{error:'Zu viele Anfragen. Bitte kurz warten.'});prev.push(now);rate.set(key,prev);if(rate.size>5000)for(const [k,v] of rate)if(v.at(-1)<now-60000)rate.delete(k);
const b=await body(req);b.name=user.name;b.alliance=user.alliance;const r=room(n);
if(req.method==='DELETE'&&kinds.includes(kind)){const i=r[kind].findIndex(x=>x.id===b.id&&x.owner===owner);if(i<0)return reply(res,403,{error:'Nur eigene Beiträge können gelöscht werden.'});r[kind].splice(i,1);save();return reply(res,200,{ok:true});}
if(req.method!=='POST')return reply(res,405,{error:'Methode nicht erlaubt'});
if(kind==='action'){
 const {kind:k,id,action}=b;if(!['agreements','tasks','events'].includes(k))return reply(res,400,{error:'Unbekannte Aktion'});
 const x=r[k].find(i=>i.id===id);if(!x)return reply(res,404,{error:'Eintrag fehlt'});
 const name=clean(b.name,30),alliance=clean(b.alliance,12);if(!name)return reply(res,400,{error:'Spielername fehlt'});
 const identity={name,alliance};
 if(k==='agreements'&&action==='vote'&&!x.closed&&['yes','no','abstain'].includes(b.choice)){x.votes??={};if(!x.votes[owner]&&Object.keys(x.votes).length>=500)return reply(res,409,{error:'Abstimmung voll'});x.votes[owner]={...identity,choice:b.choice};}
 else if(k==='agreements'&&action==='close'&&x.owner===owner&&!x.closed){x.closed=true;}
 else if(k==='events'&&action==='rsvp'&&new Date(x.date)>new Date()&&['yes','no','maybe'].includes(b.choice)){x.attendance??={};if(!x.attendance[owner]&&Object.keys(x.attendance).length>=500)return reply(res,409,{error:'Teilnehmerliste voll'});x.attendance[owner]={...identity,choice:b.choice};}
 else if(k==='tasks'&&action==='claim'&&!x.done&&!x.claim){x.claim={...identity,owner};}
 else if(k==='tasks'&&action==='release'&&!x.done&&x.claim?.owner===owner){delete x.claim;}
 else if(k==='tasks'&&action==='done'&&!x.done&&(x.owner===owner||x.claim?.owner===owner)){x.done=true;}
 else return reply(res,409,{error:'Aktion nicht möglich oder bereits erledigt'});
 save();return reply(res,200,publicItem(x,owner));}
if(kind==='report'){if(!kinds.includes(b.kind)||!r[b.kind].some(x=>x.id===b.id))return reply(res,400,{error:'Beitrag nicht gefunden'});if(!r.reports.some(x=>x.target===b.id&&x.owner===owner)){r.reports.push({target:b.id,kind:b.kind,reason:clean(b.reason,250),owner,at:new Date().toISOString()});r.reports=r.reports.slice(-500);save();}return reply(res,200,{ok:true});}
const name=clean(b.name,30),alliance=clean(b.alliance,12),message=clean(b.message,kind==='chat'?500:1500),title=clean(b.title,80);if(!name||(!message&&kind!=='events')||(kind!=='chat'&&!title))return reply(res,400,{error:'Bitte Pflichtfelder ausfüllen.'});
const item={id:crypto.randomUUID(),owner,name,alliance,message,title,at:new Date().toISOString()};
if(kind==='agreements'){item.category=['NAP','Diplomatie','Burg','KvK','Allianz','Sonstiges'].includes(b.category)?b.category:'Sonstiges';item.parties=clean(b.parties,120);item.votes={};item.closed=false;}
if(kind==='tasks'){item.role=clean(b.role,60);item.done=false;const d=new Date(b.date);if(!Number.isFinite(d.getTime()))return reply(res,400,{error:'Ungültige Frist'});item.date=d.toISOString();}
if(kind==='events'){item.attendance={};const d=new Date(b.date);if(!Number.isFinite(d.getTime()))return reply(res,400,{error:'Ungültiger Termin'});item.date=d.toISOString();item.status=b.status==='confirmed'?'confirmed':'planned';}
r[kind].push(item);r[kind]=r[kind].slice(-(kind==='chat'?300:150));save();return reply(res,201,publicItem(item,owner));
}catch(e){console.error(e.message);if(!res.headersSent)reply(res,400,{error:'Anfrage konnte nicht verarbeitet werden.'});}}).listen(port,host,()=>console.log(`Kingdom Companion: http://localhost:${port}`));
