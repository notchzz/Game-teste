const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const TILE = 48, COLS = 15, ROWS = 11;
const SPEED = 185, PLAYER_SIZE = 30, BOMB_FUSE = 1800, FIRE_TIME = 550;
const COLORS = ['#ff5d73', '#39d98a', '#54a7ff', '#ffd23f', '#ad7bff', '#ff8f3d'];
const SPAWNS = [[1,1],[13,9],[13,1],[1,9],[7,1],[7,9]];
const rooms = new Map();

function cleanName(value) { return String(value || 'Jogador').trim().slice(0, 16) || 'Jogador'; }
function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({length: 5}, () => chars[Math.floor(Math.random()*chars.length)]).join(''); } while (rooms.has(code));
  return code;
}
function key(x,y) { return `${x},${y}`; }
function makeMap() {
  const walls = new Set(), crates = new Set();
  const safe = new Set();
  for (const [sx,sy] of SPAWNS) [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => safe.add(key(sx+dx,sy+dy)));
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
    if (x===0 || y===0 || x===COLS-1 || y===ROWS-1 || (x%2===0 && y%2===0)) walls.add(key(x,y));
    else if (!safe.has(key(x,y)) && ((x*17+y*31)%10)<6) crates.add(key(x,y));
  }
  return {walls, crates};
}
function publicRoom(r) {
  return { code:r.code, hostId:r.hostId, phase:r.phase, winner:r.winner, players:[...r.players.values()].map(p => ({id:p.id,name:p.name,color:p.color,x:p.x,y:p.y,alive:p.alive})), walls:[...r.walls], crates:[...r.crates], bombs:r.bombs, fires:r.fires, cols:COLS, rows:ROWS, tile:TILE };
}
function roomSummary(r) { return {code:r.code, hostId:r.hostId, phase:r.phase, winner:r.winner, players:[...r.players.values()].map(({id,name,color,alive})=>({id,name,color,alive}))}; }
function broadcastLobby(r) { io.to(r.code).emit('room', roomSummary(r)); }
function newRoom(code, hostId) { const m=makeMap(); return {code,hostId,phase:'lobby',winner:null,players:new Map(),walls:m.walls,crates:m.crates,bombs:[],fires:[]}; }
function addPlayer(r, socket, name) {
  const n=r.players.size, [gx,gy]=SPAWNS[n];
  r.players.set(socket.id,{id:socket.id,name:cleanName(name),color:COLORS[n],x:(gx+.5)*TILE,y:(gy+.5)*TILE,alive:true,keys:{},bombReady:true});
  socket.join(r.code); socket.data.roomCode=r.code;
}
function resetMatch(r) {
  const m=makeMap(); r.walls=m.walls; r.crates=m.crates; r.bombs=[]; r.fires=[]; r.winner=null; r.phase='playing';
  [...r.players.values()].forEach((p,i)=>{ const [x,y]=SPAWNS[i]; Object.assign(p,{x:(x+.5)*TILE,y:(y+.5)*TILE,alive:true,keys:{},bombReady:true}); });
}
function blocked(r,x,y,ignoreBomb=false) {
  const half=PLAYER_SIZE/2;
  for (const [px,py] of [[x-half,y-half],[x+half,y-half],[x-half,y+half],[x+half,y+half]]) {
    const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE), k=key(gx,gy);
    if (r.walls.has(k)||r.crates.has(k)||(!ignoreBomb && r.bombs.some(b=>b.gx===gx&&b.gy===gy))) return true;
  }
  return false;
}
function explode(r,bomb,now) {
  if (!r.bombs.includes(bomb)) return;
  r.bombs.splice(r.bombs.indexOf(bomb),1);
  const cells=[[bomb.gx,bomb.gy]];
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) for(let n=1;n<=2;n++) {
    const x=bomb.gx+dx*n,y=bomb.gy+dy*n,k=key(x,y);
    if(r.walls.has(k)) break;
    cells.push([x,y]);
    if(r.crates.has(k)){ r.crates.delete(k); break; }
  }
  for(const [gx,gy] of cells) {
    r.fires.push({gx,gy,until:now+FIRE_TIME});
    const chained=r.bombs.find(b=>b.gx===gx&&b.gy===gy); if(chained) explode(r,chained,now);
  }
}
function finishIfNeeded(r) {
  if(r.phase!=='playing') return;
  const alive=[...r.players.values()].filter(p=>p.alive);
  if(alive.length<=1 && r.players.size>=2){ r.phase='finished'; r.winner=alive[0]?.name || 'Empate'; broadcastLobby(r); }
}

const app=express(); app.use(express.static(path.join(__dirname,'public'))); app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true,methods:['GET','POST']}});

io.on('connection',socket=>{
  socket.on('createRoom',({name}={},reply=()=>{})=>{ const code=roomCode(),r=newRoom(code,socket.id); rooms.set(code,r); addPlayer(r,socket,name); reply({ok:true,code}); broadcastLobby(r); });
  socket.on('joinRoom',({name,code}={},reply=()=>{})=>{ code=String(code||'').toUpperCase().trim(); const r=rooms.get(code); if(!r)return reply({ok:false,error:'Sala não encontrada.'}); if(r.phase!=='lobby')return reply({ok:false,error:'A partida já começou.'}); if(r.players.size>=6)return reply({ok:false,error:'A sala está cheia.'}); addPlayer(r,socket,name); reply({ok:true,code}); broadcastLobby(r); });
  socket.on('startGame',()=>{ const r=rooms.get(socket.data.roomCode); if(!r||r.hostId!==socket.id||r.players.size<2)return; resetMatch(r); broadcastLobby(r); });
  socket.on('restartGame',()=>{ const r=rooms.get(socket.data.roomCode); if(!r||r.hostId!==socket.id||r.phase!=='finished')return; resetMatch(r); broadcastLobby(r); });
  socket.on('input',keys=>{ const r=rooms.get(socket.data.roomCode),p=r?.players.get(socket.id); if(p)p.keys={up:!!keys.up,down:!!keys.down,left:!!keys.left,right:!!keys.right}; });
  socket.on('bomb',()=>{ const r=rooms.get(socket.data.roomCode),p=r?.players.get(socket.id); if(!r||r.phase!=='playing'||!p?.alive||!p.bombReady)return; const gx=Math.floor(p.x/TILE),gy=Math.floor(p.y/TILE); if(r.bombs.some(b=>b.gx===gx&&b.gy===gy))return; r.bombs.push({gx,gy,owner:p.id,at:Date.now()+BOMB_FUSE}); p.bombReady=false; setTimeout(()=>{ if(r.players.has(p.id))p.bombReady=true; },700); });
  socket.on('disconnect',()=>{ const r=rooms.get(socket.data.roomCode); if(!r)return; r.players.delete(socket.id); if(!r.players.size){rooms.delete(r.code);return;} if(r.hostId===socket.id)r.hostId=r.players.keys().next().value; finishIfNeeded(r); broadcastLobby(r); });
});

let last=Date.now();
const gameLoop=setInterval(()=>{
  const now=Date.now(),dt=Math.min((now-last)/1000,.05); last=now;
  for(const r of rooms.values()) if(r.phase==='playing') {
    for(const p of r.players.values()) if(p.alive) {
      let dx=(p.keys.right?1:0)-(p.keys.left?1:0),dy=(p.keys.down?1:0)-(p.keys.up?1:0); if(dx&&dy){dx*=.707;dy*=.707;}
      const nx=p.x+dx*SPEED*dt,ny=p.y+dy*SPEED*dt;
      if(!blocked(r,nx,p.y))p.x=nx; if(!blocked(r,p.x,ny))p.y=ny;
    }
    [...r.bombs].filter(b=>b.at<=now).forEach(b=>explode(r,b,now));
    r.fires=r.fires.filter(f=>f.until>now);
    for(const p of r.players.values()) if(p.alive && r.fires.some(f=>Math.floor(p.x/TILE)===f.gx&&Math.floor(p.y/TILE)===f.gy))p.alive=false;
    finishIfNeeded(r); io.to(r.code).emit('state',publicRoom(r));
  }
},1000/30);
gameLoop.unref();

if(require.main===module) server.listen(PORT,()=>console.log(`Bomb Arena em http://localhost:${PORT}`));
module.exports={server,rooms,makeMap};
