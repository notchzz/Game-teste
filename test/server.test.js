const test = require("node:test");
const assert = require("node:assert/strict");
const {
  server,
  rooms,
  makeMap,
  blocked,
  collectPowerups,
  TILE,
  SPEED,
} = require("../server");
const { io } = require("socket.io-client");
let url;
test.before(async () => {
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());
function connect() {
  return io(url, { transports: ["websocket"], forceNew: true });
}
function emit(s, event, data) {
  return new Promise((r) => s.emit(event, data, r));
}
test("mapa tem bordas e pilares sólidos", () => {
  const m = makeMap();
  assert(m.walls.has("0,0"));
  assert(m.walls.has("2,2"));
  assert(!m.walls.has("1,1"));
});
test("jogador sai da própria bomba, mas não consegue entrar novamente", () => {
  const p = { id: "ana" };
  const r = {
    walls: new Set(),
    crates: new Set(),
    bombs: [{ gx: 1, gy: 1, owner: "ana", ownerEscaped: false }],
  };
  assert.equal(blocked(r, 2 * TILE - 14, TILE * 1.5, p), false);
  r.bombs[0].ownerEscaped = true;
  assert.equal(blocked(r, 2 * TILE - 14, TILE * 1.5, p), true);
});
test("coleta buffs de velocidade, alcance e capacidade", () => {
  const p = {
    x: TILE * 1.5,
    y: TILE * 1.5,
    speed: SPEED,
    range: 2,
    maxBombs: 1,
  };
  const r = {
    powerups: [
      { gx: 1, gy: 1, type: "speed" },
      { gx: 1, gy: 1, type: "range" },
      { gx: 1, gy: 1, type: "bomb" },
    ],
  };
  collectPowerups(r, p);
  collectPowerups(r, p);
  collectPowerups(r, p);
  assert.deepEqual(
    { speed: p.speed, range: p.range, maxBombs: p.maxBombs },
    { speed: SPEED + 28, range: 3, maxBombs: 2 },
  );
  assert.equal(r.powerups.length, 0);
});
test("cria sala privada, permite entrada e inicia com dois jogadores", async () => {
  const a = connect(),
    b = connect();
  await Promise.all([
    new Promise((r) => a.on("connect", r)),
    new Promise((r) => b.on("connect", r)),
  ]);
  const made = await emit(a, "createRoom", { name: "Ana" });
  assert.equal(made.ok, true);
  assert.match(made.code, /^[A-Z2-9]{5}$/);
  const joined = await emit(b, "joinRoom", { name: "Beto", code: made.code });
  assert.equal(joined.ok, true);
  a.emit("startGame");
  await new Promise((r) => setTimeout(r, 80));
  const room = rooms.get(made.code);
  assert.equal(room.phase, "playing");
  assert.equal(room.players.size, 2);
  a.disconnect();
  b.disconnect();
});
