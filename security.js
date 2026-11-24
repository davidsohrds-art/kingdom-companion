'use strict';
const crypto=require('node:crypto'),fs=require('node:fs');
module.exports=function security(file,reply,body){
 const dbFile=file+'.accounts';let db={users:{},sessions:{},groups:{}};try{db=JSON.parse(fs.readFileSync(dbFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const save=()=>{fs.writeFileSync(dbFile+'.tmp',JSON.stringify(db),{mode:0o600});fs.renameSync(dbFile+'.tmp',dbFile)};
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');const secret=()=>crypto.randomBytes(32).toString('hex');const trim=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
 const safeUser=u=>({kingdom:u.kingdom,name:u.name,alliance:u.alliance});
 const auth=req=>{const t=req.headers['x-player-token'];if(typeof t!=='string'||! /^[a-f0-9]{64}$/.test(t))return null;const s=db.sessions[hash(t)];return s&&s.exp>Date.now()?db.users[s.uid]||null:null};
 const attempts=new Map();function allowed(req){const key=req.socket.remoteAddress,now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);let a=attempts.get(key);if(!a){a={until:now+60000,count:0};attempts.set(key,a)}return ++a.count<=20}
 const err=(res,status,error)=>reply(res,status,{error});
 function session(u){for(const [k,s] of Object.entries(db.sessions))if(s.exp<Date.now())delete db.sessions[k];const token=secret();db.sessions[hash(token)]={uid:u.id,exp:Date.now()+7*86400000};save();return {token,profile:safeUser(u)}}
 function groupView(g,u){return {id:g.id,name:g.name,tag:g.tag,leader:g.leader===u.id,members:Object.entries(g.members).map(([id,role])=>({id,name:db.users[id]?.name||'Gelöscht',role})),items:g.items.map(({owner,...x})=>({...x,mine:owner===u.id})),...(g.leader===u.id?{invite:g.invite}:{})}}
 async function route(req,res,u){const p=u.pathname;if(!p.startsWith('/api/account')&&!p.startsWith('/api/team'))return false;
 if(!['POST','GET'].includes(req.method)){err(res,405,'Methode nicht erlaubt');return true}
 const action=p.split('/').at(-1);const b=req.method==='POST'?await body(req):{};
 if(p==='/api/account/register'||p==='/api/account/login'){
  if(req.method!=='POST'||!allowed(req)){err(res,429,'Zu viele Anmeldeversuche');return true}
  const name=trim(b.name,30),kingdom=String(b.kingdom||''),pass=b.password;const uid=hash(kingdom+'|'+name.toLowerCase());
  if(!name||! /^[1-9]\d{0,7}$/.test(kingdom)||typeof pass!=='string'||pass.length<10||pass.length>128){err(res,400,'Server, Name und Passwort (10–128 Zeichen) erforderlich');return true}
  let user=db.users[uid];if(action==='register'){if(user){err(res,409,'Spielername auf diesem Server bereits registriert');return true}const salt=secret();user=db.users[uid]={id:uid,name,kingdom,alliance:trim(b.alliance,12),salt,password:crypto.scryptSync(pass,salt,64).toString('hex')};}
  else {const derived=crypto.scryptSync(pass,user?.salt||'invalid-salt',64);if(!user||!crypto.timingSafeEqual(derived,Buffer.from(user.password,'hex'))){err(res,401,'Anmeldedaten ungültig');return true}}
  reply(res,200,session(user));return true;
 }
 if(req.method==='POST'&&!allowed(req)){err(res,429,'Zu viele Anfragen');return true}
 const user=auth(req);if(!user){err(res,401,'Bitte anmelden');return true}
 if(p==='/api/account/me'&&req.method==='GET'){reply(res,200,{profile:safeUser(user)});return true}
 if(p==='/api/account/logout'&&req.method==='POST'){delete db.sessions[hash(req.headers['x-player-token'])];save();reply(res,200,{ok:true});return true}
 if(p==='/api/team/list'&&req.method==='GET'){reply(res,200,{groups:Object.values(db.groups).filter(g=>g.kingdom===user.kingdom&&Object.hasOwn(g.members,user.id)).map(g=>groupView(g,user))});return true}
 if(req.method!=='POST'){err(res,405,'Methode nicht erlaubt');return true}
 if(p==='/api/team/create'){const name=trim(b.name,60),tag=trim(b.tag,12);if(!name||!tag){err(res,400,'Name und Kürzel erforderlich');return true}if(Object.values(db.groups).some(g=>g.kingdom===user.kingdom&&g.tag.toLowerCase()===tag.toLowerCase())){err(res,409,'Kürzel bereits vergeben');return true}const id=crypto.randomUUID();db.groups[id]={id,name,tag,kingdom:user.kingdom,leader:user.id,members:{[user.id]:'Leitung'},invite:secret(),items:[]};save();reply(res,201,groupView(db.groups[id],user));return true}
 if(p==='/api/team/join'){const g=Object.values(db.groups).find(g=>g.kingdom===user.kingdom&&g.invite===b.invite);if(!g){err(res,404,'Einladung ungültig');return true}g.members[user.id]??='Mitglied';save();reply(res,200,groupView(g,user));return true}
 const g=typeof b.group==='string'&&Object.hasOwn(db.groups,b.group)?db.groups[b.group]:null;if(!g||g.kingdom!==user.kingdom||!Object.hasOwn(g.members,user.id)){err(res,403,'Kein Zugriff auf diese Allianz');return true}
 if(p==='/api/team/rotate'&&g.leader===user.id){g.invite=secret()}
 else if(p==='/api/team/remove'&&g.leader===user.id&&b.member!==user.id&&Object.hasOwn(g.members,b.member)){delete g.members[b.member];g.invite=secret()}
 else if(p==='/api/team/post'){
  const type=b.type,title=trim(b.title,80),message=trim(b.message,1500);if(!['chat','plan','marker','report','eventscore'].includes(type)||!message||!title){err(res,400,'Ungültiger Beitrag');return true}
  const item={id:crypto.randomUUID(),owner:user.id,author:user.name,type,title,message,at:new Date().toISOString()};
  if(type==='marker'){if(!Number.isInteger(b.x)||!Number.isInteger(b.y)||b.x<0||b.y<0||b.x>9999||b.y>9999){err(res,400,'Koordinaten 0–9999 erforderlich');return true}item.x=b.x;item.y=b.y;item.category=['Festung','Burg','Allianz','Treffpunkt','Sonstiges'].includes(b.category)?b.category:'Sonstiges'}
  if(type==='report'){for(const key of ['own','enemy','lost']){if(!Number.isSafeInteger(b[key])||b[key]<0){err(res,400,'Ungültige Truppenwerte');return true}item[key]=b[key]}if(item.lost>item.own){err(res,400,'Verluste übersteigen eigene Truppen');return true}}
  if(type==='plan'){const d=new Date(b.date);if(!Number.isFinite(d.getTime())){err(res,400,'Ungültige Zeit');return true}item.date=d.toISOString();item.done=false}
  if(type==='eventscore'){if(!['bear1','bear2','viking','castle','kvk','sword','champ','mobil','duel','hog'].includes(b.event)||typeof b.round!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.round)||!Number.isFinite(Date.parse(b.round))||new Date(b.round).toISOString().slice(0,10)!==b.round||!Number.isSafeInteger(b.score)||b.score<0){err(res,400,'Ungültiges Event-Ergebnis');return true}item.event=b.event;item.round=b.round;item.score=b.score;g.items=g.items.filter(x=>!(x.type===type&&x.owner===user.id&&x.event===item.event&&x.round===item.round));}
  g.items.push(item);g.items=g.items.slice(-500);
 }else if(p==='/api/team/delete'||p==='/api/team/done'){const i=g.items.findIndex(x=>x.id===b.id);if(i<0||(g.items[i].owner!==user.id&&g.leader!==user.id)){err(res,403,'Keine Berechtigung');return true}if(action==='delete')g.items.splice(i,1);else if(g.items[i].type==='plan')g.items[i].done=!g.items[i].done;else{err(res,400,'Kein Plan');return true}}
 else{err(res,403,'Aktion nicht erlaubt');return true}
 save();reply(res,200,groupView(g,user));return true;
 }
 return {auth,route};
};
