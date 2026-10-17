const params = new URLSearchParams(location.search);
const server = params.get("server") || window.__SERVER_URL__ || undefined;
const socket = io(server, { transports: ["websocket", "polling"] });
const $ = (id) => document.getElementById(id),
  home = $("home"),
  lobby = $("lobby"),
  game = $("game"),
  canvas = $("canvas"),
  ctx = canvas.getContext("2d");
let room = null,
  me = null,
  lastState = null;
const renderPlayers = new Map();
const keys = { up: false, down: false, left: false, right: false };
function show(el) {
  [home, lobby, game].forEach((x) => x.classList.add("hidden"));
  el.classList.remove("hidden");
}
function name() {
  return $("name").value.trim() || "Jogador";
}
function invite() {
  return `${location.origin}${location.pathname}?room=${room.code}${server ? `&server=${encodeURIComponent(server)}` : ""}`;
}
function copyInvite() {
  navigator.clipboard.writeText(invite()).then(() => {
    const b = document.activeElement,
      old = b.textContent;
    b.textContent = "Link copiado!";
    setTimeout(() => (b.textContent = old), 1200);
  });
}
$("copy").onclick = copyInvite;
$("copyGame").onclick = copyInvite;
$("create").onclick = () =>
  socket.emit("createRoom", { name: name() }, joinReply);
$("join").onclick = () =>
  socket.emit("joinRoom", { name: name(), code: $("code").value }, joinReply);
$("start").onclick = () => socket.emit("startGame");
$("restart").onclick = () => socket.emit("restartGame");
function joinReply(res) {
  if (!res.ok) {
    $("error").textContent = res.error;
    return;
  }
  room = { code: res.code };
  history.replaceState(
    null,
    "",
    `?room=${res.code}${server ? `&server=${encodeURIComponent(server)}` : ""}`,
  );
  $("error").textContent = "";
  show(lobby);
}
socket.on("connect", () => {
  me = socket.id;
  const c = params.get("room");
  if (c && !room) {
    $("code").value = c.toUpperCase();
  }
});
socket.on("room", (r) => {
  room = r;
  $("roomCode").textContent = $("gameCode").textContent = r.code;
  const list = r.players
    .map(
      (p) =>
        `<li><i class="dot" style="background:${p.color}"></i>${escapeHtml(p.name)}${p.id === r.hostId ? " (dono)" : ""}</li>`,
    )
    .join("");
  $("lobbyPlayers").innerHTML = $("players").innerHTML = list;
  const host = r.hostId === socket.id;
  $("start").classList.toggle("hidden", !host);
  $("start").disabled = r.players.length < 2;
  $("lobbyHint").textContent =
    r.players.length < 2
      ? "Convide pelo menos mais uma pessoa."
      : host
        ? "Tudo pronto. Você pode começar."
        : "Aguardando o dono começar.";
  if (r.phase === "lobby") show(lobby);
  if (r.phase === "playing") {
    show(game);
    $("touch").classList.remove("hidden");
    $("result").classList.add("hidden");
  }
  if (r.phase === "finished") {
    show(game);
    $("winner").textContent =
      r.winner === "Empate" ? "Empate explosivo!" : `${r.winner} venceu!`;
    $("restart").classList.toggle("hidden", !host);
    $("result").classList.remove("hidden");
  }
});
socket.on("state", (s) => {
  lastState = s;
  const mine = s.players.find((p) => p.id === socket.id);
  if (mine)
    $("myStats").innerHTML =
      `<div class="stat"><b>${mine.maxBombs}</b>bombas</div><div class="stat"><b>${mine.range}</b>alcance</div><div class="stat"><b>${Math.round((mine.speed / 185) * 100)}%</b>veloc.</div>`;
  $("players").innerHTML = s.players
    .map(
      (p) =>
        `<li style="opacity:${p.alive ? 1 : 0.45}"><i class="dot" style="background:${p.color}"></i>${escapeHtml(p.name)}${p.id === s.hostId ? " (dono)" : ""}${p.alive ? "" : " — eliminado"}</li>`,
    )
    .join("");
  if (s.phase === "finished") {
    $("winner").textContent =
      s.winner === "Empate" ? "Empate explosivo!" : `${s.winner} venceu!`;
    $("restart").classList.toggle("hidden", s.hostId !== socket.id);
    $("result").classList.remove("hidden");
  }
});
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function draw(s, now = performance.now()) {
  const T = s.tile;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#26345c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#334879" : "#304370";
      ctx.fillRect(x * T, y * T, T, T);
    }
  for (const v of s.walls) {
    const [x, y] = v.split(",").map(Number);
    ctx.fillStyle = "#9aa6bd";
    ctx.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
    ctx.fillStyle = "#c5ccda";
    ctx.fillRect(x * T + 7, y * T + 7, T - 14, 9);
  }
  for (const v of s.crates) {
    const [x, y] = v.split(",").map(Number);
    ctx.fillStyle = "#d48a2d";
    ctx.fillRect(x * T + 4, y * T + 4, T - 8, T - 8);
    ctx.strokeStyle = "#7b431d";
    ctx.lineWidth = 5;
    ctx.strokeRect(x * T + 7, y * T + 7, T - 14, T - 14);
    ctx.beginPath();
    ctx.moveTo(x * T + 9, y * T + 9);
    ctx.lineTo((x + 1) * T - 9, (y + 1) * T - 9);
    ctx.stroke();
    ctx.fillStyle = "#eda84a";
    ctx.fillRect(x * T + 10, y * T + 10, T - 20, 4);
  }
  for (const u of s.powerups || []) {
    const cx = (u.gx + 0.5) * T,
      cy = (u.gy + 0.5) * T,
      pulse = 1 + Math.sin(now / 180 + u.gx) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle =
      u.type === "speed"
        ? "#52ddc4"
        : u.type === "range"
          ? "#ff8f3d"
          : "#ffd23f";
    ctx.strokeStyle = "#11162f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#11162f";
    ctx.font = "900 15px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      u.type === "speed" ? "B" : u.type === "range" ? "R" : "+",
      0,
      1,
    );
    ctx.restore();
  }
  for (const f of s.fires) {
    const cx = (f.gx + 0.5) * T,
      cy = (f.gy + 0.5) * T;
    const flicker = 0.88 + Math.sin(now / 45 + f.gx * 2 + f.gy) * 0.1;
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(cx, cy, T * 0.45 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5d3d";
    ctx.beginPath();
    ctx.arc(cx, cy, T * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of s.bombs) {
    const cx = (b.gx + 0.5) * T,
      cy = (b.gy + 0.5) * T;
    const remaining = Math.max(0, b.at - Date.now());
    const pulse = 1 + Math.sin(now / Math.max(55, remaining / 8)) * 0.09;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#10131e";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#596078";
    ctx.beginPath();
    ctx.arc(-5, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.quadraticCurveTo(18, -24, 20, -14);
    ctx.stroke();
    ctx.restore();
  }
  for (const p of s.players) {
    if (!p.alive) continue;
    const rp = renderPlayers.get(p.id) || { x: p.x, y: p.y };
    rp.x += (p.x - rp.x) * 0.38;
    rp.y += (p.y - rp.y) * 0.38;
    renderPlayers.set(p.id, rp);
    const bob = p.moving ? Math.sin(now / 75) * 2 : 0;
    const foot = p.moving ? Math.sin(now / 75) * 3 : 0;
    const x = rp.x,
      y = rp.y + bob;
    ctx.fillStyle = "#0b1025aa";
    ctx.beginPath();
    ctx.ellipse(x, y + 15, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#11162f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 9);
    ctx.lineTo(x - 8 - foot, y + 16);
    ctx.moveTo(x + 7, y + 9);
    ctx.lineTo(x + 8 + foot, y + 16);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(x - 15, y - 15, 30, 29, 11);
    ctx.fill();
    ctx.strokeStyle = "#11162f";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#eaf6ff";
    ctx.strokeStyle = "#11162f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const visorX = p.dir === "left" ? x - 9 : p.dir === "right" ? x - 1 : x - 9;
    ctx.roundRect(visorX, y - 9, 18, 9, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.fillRect(x - 13, y - 15, 26, 5);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(p.name, x, y - 22);
  }
}
function frame(now) {
  if (lastState) draw(lastState, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const keyMap = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
addEventListener("keydown", (e) => {
  if (keyMap[e.code]) {
    e.preventDefault();
    keys[keyMap[e.code]] = true;
    socket.emit("input", keys);
  }
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    socket.emit("bomb");
  }
});
addEventListener("keyup", (e) => {
  if (keyMap[e.code]) {
    keys[keyMap[e.code]] = false;
    socket.emit("input", keys);
  }
});
document.querySelectorAll("[data-key]").forEach((b) => {
  const k = b.dataset.key;
  for (const ev of ["pointerdown", "pointerenter"])
    b.addEventListener(ev, (e) => {
      if (ev === "pointerenter" && e.buttons !== 1) return;
      e.preventDefault();
      keys[k] = true;
      socket.emit("input", keys);
    });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"])
    b.addEventListener(ev, (e) => {
      e.preventDefault();
      keys[k] = false;
      socket.emit("input", keys);
    });
});
$("touchBomb").onpointerdown = (e) => {
  e.preventDefault();
  socket.emit("bomb");
};
