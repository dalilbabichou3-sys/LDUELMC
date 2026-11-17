'use strict';
/*
 * Duel_Me: بوت دويل واحد.
 * - يقبل آخر طلب دويل وصله بكتابة:  /duel accept اسم_اللاعب
 * - يلعب: كريستال + أنكور، سبير ميس (ويند شارج + مايس)، سورد، UHC (لافا + ماء + كسر الشيلد)
 * - بعد ما يقتل أو يُقتل يوقف الهجوم، ولا يضرب إلا من ضربه (يدافع عن نفسه)
 * - في عالم اللوبي (اسمه lhub) ما يضرب أبداً إلا إذا قبل دويل. وفي أي عالم ثاني يضرب. غيّر الاسم بـ LOBBY_WORLD
 * - لما ينضرب يترك الحركة لحظة ليتأثر بالـ knockback ولا يثبت في مكانه
 * - بدون هاكات: مدى ضرب 3 بلوكات، لازم يكون ناظراً للخصم، ولا يضرب من خلف الحيط.
 * التشغيل: npm install  ثم  npm start
 * اختياري (Environment في Render): MC_HOST و MC_PORT و BOT_NAME
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const { WebSocketServer } = require('ws');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const v3 = require('vec3');
const Vec3 = v3.Vec3 || v3;

const PAGE = "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>بوت الدويل</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=Reem+Kufi:wght@600&display=swap\" rel=\"stylesheet\">\n<style>\n  :root { --dirt: #4a3322; --panel: #c6c6c6; --ink: #373737; --ok: #55ff55; --warn: #ffaa00; --err: #ff5555; color-scheme: light; }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; min-height: 100%; }\n  body {\n    font-family: \"IBM Plex Sans Arabic\", system-ui, sans-serif;\n    color: var(--ink);\n    background-color: var(--dirt);\n    background-image:\n      linear-gradient(45deg, rgba(0,0,0,.16) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.16) 75%),\n      linear-gradient(45deg, rgba(255,255,255,.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.04) 75%);\n    background-size: 32px 32px;\n    background-position: 0 0, 16px 16px;\n    padding: max(20px, env(safe-area-inset-top)) 14px max(24px, env(safe-area-inset-bottom));\n    display: flex; justify-content: center;\n  }\n  main {\n    width: 100%; max-width: 560px; margin: auto 0;\n    background: var(--panel); padding: 22px 20px 20px;\n    box-shadow: inset 4px 4px 0 #fff, inset -4px -4px 0 #555, 0 0 0 4px #000, 0 10px 0 4px rgba(0,0,0,.35);\n  }\n  h1 {\n    font-family: \"Reem Kufi\", \"IBM Plex Sans Arabic\", sans-serif; font-weight: 600;\n    font-size: clamp(26px, 7vw, 36px); line-height: 1.2; margin: 0 0 6px; text-shadow: 2px 2px 0 #eee;\n  }\n  .lead { margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #4a4a4a; }\n  .info { display: grid; gap: 10px; margin: 0 0 6px; }\n  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #1a1a1a; box-shadow: inset 0 0 0 2px #8b8b8b; padding: 12px; color: #fff; }\n  .row span:first-child { color: #aaa; font-size: 14px; }\n  .row b { direction: ltr; unicode-bidi: plaintext; font-size: 16px; font-weight: 600; word-break: break-all; }\n  .status { display: flex; align-items: center; gap: 10px; margin: 20px 0 8px; font-weight: 600; font-size: 16px; }\n  .pip { width: 14px; height: 14px; background: #777; box-shadow: 0 0 0 2px #000; flex: none; }\n  .pip.connecting { background: #e8b339; animation: blink 1s steps(2) infinite; }\n  .pip.online { background: #55c52e; }\n  @keyframes blink { 50% { opacity: .25; } }\n  @media (prefers-reduced-motion: reduce) { .pip.connecting { animation: none; } }\n  #console {\n    height: 200px; overflow-y: auto; background: #000; color: #ddd;\n    font: 13px/1.6 ui-monospace, Menlo, Consolas, monospace; padding: 10px 12px; box-shadow: 0 0 0 2px #8b8b8b;\n  }\n  #console div { unicode-bidi: plaintext; text-align: start; word-break: break-word; }\n  .l-ok { color: var(--ok); } .l-warn { color: var(--warn); } .l-err { color: var(--err); } .l-info { color: #aaa; }\n  .empty { color: #777; }\n  .foot { margin: 16px 0 0; font-size: 13px; line-height: 1.7; color: #555; }\n</style>\n</head>\n<body>\n<main>\n  <h1>بوت الدويل</h1>\n  <p class=\"lead\">أرسل له طلب /duel داخل السيرفر وسيقبله تلقائياً ويقاتلك.</p>\n\n  <div class=\"info\">\n    <div class=\"row\"><span>السيرفر</span><b id=\"host\">...</b></div>\n    <div class=\"row\"><span>اسم البوت</span><b id=\"name\">...</b></div>\n  </div>\n\n  <div class=\"status\"><span id=\"pip\" class=\"pip\"></span><span id=\"statusText\">جارٍ الاتصال بالموقع...</span></div>\n  <div id=\"console\" aria-live=\"polite\"><div class=\"empty\">سجل الحالة سيظهر هنا.</div></div>\n  <p class=\"foot\">هذه الصفحة للمتابعة فقط، والبوت يعمل من الخادم حتى لو أغلقتها. آخر شخص يرسل طلباً هو الذي يُقبل.</p>\n</main>\n\n<script>\n// اتركه فارغاً إذا كان server.js هو الذي يعرض هذه الصفحة. غيّره فقط لو رفعت الصفحة في مكان آخر.\nconst BACKEND_URL = '';\n\nconst $ = (id) => document.getElementById(id);\nconst labels = { offline: 'البوت غير متصل، جارٍ إعادة المحاولة...', connecting: 'جارٍ دخول البوت...', online: 'البوت داخل السيرفر' };\n\nfunction addLog(text, level) {\n  const con = $('console');\n  const first = con.firstElementChild;\n  if (first && first.classList.contains('empty')) con.innerHTML = '';\n  const d = document.createElement('div');\n  d.className = 'l-' + (level || 'info');\n  d.textContent = text;\n  con.appendChild(d);\n  while (con.children.length > 100) con.removeChild(con.firstChild);\n  con.scrollTop = con.scrollHeight;\n}\n\nfunction wsUrl() {\n  let u = BACKEND_URL.trim();\n  if (!u && /^https?:/.test(location.origin)) u = location.origin;\n  return u.replace(/^http/i, 'ws');\n}\n\nfunction connect() {\n  const url = wsUrl();\n  if (!url) { $('statusText').textContent = 'ضع عنوان الخادم في BACKEND_URL'; return; }\n  const ws = new WebSocket(url);\n  ws.onmessage = (e) => {\n    let m; try { m = JSON.parse(e.data); } catch (err) { return; }\n    if (m.type === 'status') {\n      $('host').textContent = m.host;\n      $('name').textContent = m.name;\n      $('pip').className = 'pip ' + (m.state === 'offline' ? '' : m.state);\n      $('statusText').textContent = labels[m.state] || m.state;\n    } else if (m.type === 'log') {\n      addLog(m.text, m.level);\n    }\n  };\n  ws.onclose = () => {\n    $('pip').className = 'pip';\n    $('statusText').textContent = 'جارٍ إعادة الاتصال بالموقع...';\n    setTimeout(connect, 3000);\n  };\n  ws.onerror = () => {};\n}\nconnect();\n</script>\n</body>\n</html>\n";

const WEB_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.MC_HOST || 'lhubx.funserver.top';
const MC_PORT = Number(process.env.MC_PORT || 25565);
const NAME = process.env.BOT_NAME || 'Duel_Me';
const LOBBY_WORLD = (process.env.LOBBY_WORLD || 'lhub').toLowerCase();

let bot = null;
let state = 'offline';
let starting = false;
let reconnectTimer = null;
let attempts = 0;
let upSince = 0;
let lastKick = '';
let afk = null;
let combat = null;
let inDuel = false;
const logs = [];
const clients = new Set();

const statusMsg = () => ({ type: 'status', state, name: NAME, host: HOST });
function broadcast(obj) {
  const t = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === 1) c.send(t);
}
function log(text, level = 'info') {
  const e = { type: 'log', text, level };
  logs.push(e);
  if (logs.length > 80) logs.shift();
  broadcast(e);
}
function setState(s) { state = s; broadcast(statusMsg()); }
function reasonText(r) {
  let t = typeof r === 'string' ? r : JSON.stringify(r);
  return String(t).slice(0, 300);
}

// ======================= أدوات =======================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
function withTimeout(p, ms) {
  return Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
const TIERS = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden', 'copper'];
function tierRank(n) { const i = TIERS.findIndex((t) => n.startsWith(t)); return i < 0 ? 99 : i; }
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function rayBox(o, d, min, max, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  for (const ax of ['x', 'y', 'z']) {
    if (Math.abs(d[ax]) < 1e-9) {
      if (o[ax] < min[ax] || o[ax] > max[ax]) return false;
    } else {
      let t1 = (min[ax] - o[ax]) / d[ax];
      let t2 = (max[ax] - o[ax]) / d[ax];
      if (t1 > t2) { const x = t1; t1 = t2; t2 = x; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

// ======================= القتال =======================
function initCombat(b) {
  let duel = null;
  let busy = false;
  let nextAttack = 0;
  let strafeDir = 0;
  let strafeUntil = 0;
  let followId = null;
  let eating = false;
  let smash = { phase: 'idle', since: 0, readyAt: 0, peak: 0 };
  let lastAxeHit = 0, lavaReadyAt = 0, waterReadyAt = 0, waterPlacedAt = 0;
  let crystalActAt = 0, placeAt = 0, totemCheckAt = 0;
  let jit = { x: 0, y: 0, z: 0, until: 0 };
  let reachSince = 0, anchorReadyAt = 0, kbUntil = 0;
  let acceptTimer = null;
  let lastAccept = { name: '', at: 0 };

  const items = () => b.inventory.items();
  const find = (pred) => items().find((i) => pred(i.name));
  const heldName = () => (b.heldItem ? b.heldItem.name : '');
  const eye = () => b.entity.position.offset(0, 1.62, 0);

  async function equip(item, dest) {
    if (!item) return false;
    dest = dest || 'hand';
    if (dest === 'hand' && b.heldItem && b.heldItem.type === item.type) return true;
    try { await withTimeout(b.equip(item, dest), 800); return true; } catch (e) { return false; }
  }

  // ---------- تصويب بشري (دوران محدود السرعة) ----------
  function aimErr(pt) {
    const d = pt.minus(eye());
    const yaw = Math.atan2(-d.x, -d.z);
    const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    const dy = wrap(yaw - b.entity.yaw);
    const dp = pitch - b.entity.pitch;
    return { dy, dp, err: Math.hypot(dy, dp) };
  }
  function aimStep(pt, maxStep) {
    const a = aimErr(pt);
    if (a.err < 1e-4) return 0;
    const k = Math.min(1, maxStep / a.err);
    let np = b.entity.pitch + a.dp * k;
    np = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, np));
    Promise.resolve(b.look(b.entity.yaw + a.dy * k, np, true)).catch(() => {});
    return a.err * (1 - k);
  }
  async function aimUntil(pt, ms, tol) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const left = aimStep(pt, 0.6);
      if (left < (tol || 0.08)) return true;
      await sleep(50);
    }
    return false;
  }
  function viewDir() {
    const y = b.entity.yaw;
    const p = b.entity.pitch;
    return new Vec3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }
  function lookHits(pos, hw, h, maxDist) {
    const pad = 0.1;
    return rayBox(eye(), viewDir(),
      { x: pos.x - hw - pad, y: pos.y - pad, z: pos.z - hw - pad },
      { x: pos.x + hw + pad, y: pos.y + h + pad, z: pos.z + hw + pad }, maxDist);
  }
  function aimPoint(t) {
    const now = Date.now();
    if (now > jit.until) jit = { x: rnd(-0.12, 0.12), y: rnd(-0.15, 0.15), z: rnd(-0.12, 0.12), until: now + 500 };
    return t.position.offset(jit.x, (t.height || 1.8) * 0.6 + jit.y, jit.z);
  }
  function faceTarget(t) { aimStep(aimPoint(t), 0.26); }

  // ---------- حركة ----------
  function clearMove() {
    for (const c of ['forward', 'back', 'left', 'right', 'sprint', 'jump']) b.setControlState(c, false);
  }
  function follow(t) {
    if (followId !== t.id) {
      clearMove();
      b.pathfinder.setGoal(new goals.GoalFollow(t, 2), true);
      followId = t.id;
    }
  }
  function unfollow() {
    if (followId !== null) { b.pathfinder.setGoal(null); followId = null; }
  }
  function strafe() {
    const now = Date.now();
    if (now > strafeUntil) {
      const r = Math.random();
      strafeDir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
      strafeUntil = now + rnd(500, 1300);
    }
    b.setControlState('left', strafeDir === -1);
    b.setControlState('right', strafeDir === 1);
  }
  function meleeMove(t, dist) {
    if (dist > 4.8) { follow(t); return; }
    unfollow();
    faceTarget(t);
    b.setControlState('sprint', dist > 3);
    b.setControlState('forward', dist > 2.4);
    b.setControlState('back', dist < 1.3);
    strafe();
    if (b.entity.onGround && Math.random() < 0.015) {
      b.setControlState('jump', true);
      setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 120);
    }
  }
  function ringMove(t, dist, near, far) {
    if (dist > far + 1.5) { follow(t); return; }
    unfollow();
    faceTarget(t);
    b.setControlState('sprint', false);
    b.setControlState('forward', dist > far);
    b.setControlState('back', dist < near);
    strafe();
  }

  // ---------- رؤية ومدى ----------
  function reachDist(t) {
    const e = eye();
    const hw = 0.3;
    const cx = Math.max(t.position.x - hw, Math.min(e.x, t.position.x + hw));
    const cy = Math.max(t.position.y, Math.min(e.y, t.position.y + (t.height || 1.8)));
    const cz = Math.max(t.position.z - hw, Math.min(e.z, t.position.z + hw));
    return Math.sqrt((e.x - cx) ** 2 + (e.y - cy) ** 2 + (e.z - cz) ** 2);
  }
  function clearLine(from, to) {
    const d = to.minus(from);
    const len = d.norm();
    if (len < 0.5) return true;
    const steps = Math.ceil(len / 0.25);
    for (let i = 1; i < steps; i++) {
      const p = from.plus(d.scaled(i / steps));
      const blk = b.blockAt(p);
      if (blk && blk.boundingBox === 'block') return false;
    }
    return true;
  }
  function canSee(t) {
    const e = eye();
    const h = t.height || 1.8;
    return clearLine(e, t.position.offset(0, h * 0.6, 0)) || clearLine(e, t.position.offset(0, h * 0.9, 0));
  }

  // ---------- أسلحة ----------
  function best(suffix) {
    return items().filter((i) => i.name.endsWith(suffix)).sort((a, c) => tierRank(a.name) - tierRank(c.name))[0];
  }
  function pickMelee(t) {
    const sw = best('_sword');
    const ax = best('_axe');
    const sp = best('_spear');
    const off = t.equipment && t.equipment[1];
    const shield = off && off.name === 'shield';
    if (shield && ax && Date.now() - lastAxeHit > 4500) return ax; // الفأس يكسر الشيلد
    return sw || sp || ax || null;
  }
  function cooldownFor(n) {
    if (n.endsWith('_axe')) return 1050;
    if (n === 'mace') return 1700;
    if (n.endsWith('_spear')) return 750;
    if (n.endsWith('_sword')) return 650;
    return 550;
  }
  function tryHit(t) {
    const now = Date.now();
    const rd = reachDist(t);
    if (rd > 3.4) { reachSince = 0; return false; }
    if (rd > 3.0) return false; // مدى 3 بلوكات فقط
    if (reachSince === 0) reachSince = now + rnd(220, 420); // زمن رد فعل بشري
    if (now < reachSince || now < nextAttack) return false;
    if (!canSee(t)) return false; // لا ضرب من خلف الحيط
    if (!lookHits(t.position, 0.3, t.height || 1.8, 3.1)) return false; // لازم يكون ناظراً للخصم
    if (Math.random() < 0.2) { nextAttack = now + rnd(150, 400); return false; } // مستوى عادي: يخطئ أحياناً
    const hn = heldName();
    b.attack(t);
    if (hn.endsWith('_axe')) lastAxeHit = now;
    nextAttack = now + cooldownFor(hn) + rnd(80, 350);
    return true;
  }

  // ---------- أكل وتوتم ----------
  async function ensureTotem(force) {
    const now = Date.now();
    if (!force && now < totemCheckAt) return false;
    totemCheckAt = now + 250;
    const off = b.inventory.slots[45];
    if (off && off.name === 'totem_of_undying') return false;
    const t = find((n) => n === 'totem_of_undying');
    if (!t) return false;
    return await equip(t, 'off-hand');
  }

  let evadeSide = 1, evadeUntil = 0;
  function evade() {
    const now = Date.now();
    if (now < kbUntil) { clearMove(); return; }
    const t = getTarget();
    if (t) faceTarget(t);
    if (now > evadeUntil) { evadeSide = Math.random() < 0.5 ? -1 : 1; evadeUntil = now + rnd(600, 1100); }
    const d = t ? b.entity.position.distanceTo(t.position) : 99;
    b.setControlState('back', d < 7);
    b.setControlState('forward', false);
    b.setControlState('sprint', false);
    b.setControlState('left', evadeSide === -1);
    b.setControlState('right', evadeSide === 1);
    if (b.entity.onGround && Math.random() < 0.04) {
      b.setControlState('jump', true);
      setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 120);
    }
  }
  async function maybeEat(dist) {
    if (b.health > 10) return false;
    if (dist < 2.8 && b.health > 5) return false;
    const f = find((n) => n === 'golden_apple' || n === 'enchanted_golden_apple');
    if (!f) return false;
    eating = true;
    unfollow(); clearMove();
    await ensureTotem(true); // التوتم أولاً ثم الأكل
    const mv = setInterval(() => { try { evade(); } catch (e) {} }, 100); // يمشي وهو ياكل
    try { await equip(f); await withTimeout(b.consume(), 3500); } catch (e) {}
    clearInterval(mv);
    clearMove();
    eating = false;
    return true;
  }

  // ---------- أمان من اللافا والنار (UHC) ----------
  function onFire() {
    const m = b.entity.metadata && b.entity.metadata[0];
    return typeof m === 'number' && (m & 1) === 1;
  }
  function lavaNear() {
    const p = b.entity.position.floored();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const blk = b.blockAt(p.offset(dx, dy, dz));
      if (blk && blk.name === 'lava') return true;
    }
    return false;
  }
  const downPoint = () => eye().offset(0, -5, 0);
  async function lavaSafety() {
    const water = find((n) => n === 'water_bucket');
    const bucket = find((n) => n === 'bucket');
    if (!water && !bucket) return false;
    const now = Date.now();
    const fire = onFire();
    const near = water ? lavaNear() : false;
    if (water && (fire || near || b.entity.isInLava) && now >= waterReadyAt) {
      unfollow(); clearMove();
      await equip(water);
      await aimUntil(downPoint(), 500, 0.1);
      b.activateItem(); // ماء تحت رجليه
      waterReadyAt = now + 2500;
      waterPlacedAt = now;
      return true;
    }
    if (waterPlacedAt && now - waterPlacedAt > 2200 && !fire && !lavaNear() && bucket) {
      await equip(bucket);
      await aimUntil(downPoint(), 500, 0.1);
      b.activateItem(); // يرجّع الماء
      waterPlacedAt = 0;
      return true;
    }
    return false;
  }

  // ---------- أنماط القتال ----------
  async function swordFight(t, dist) {
    await equip(pickMelee(t));
    meleeMove(t, dist);
    tryHit(t);
  }

  async function uhcFight(t, dist) {
    const now = Date.now();
    const lava = find((n) => n === 'lava_bucket');
    if (lava && now >= lavaReadyAt && dist >= 2.5 && dist <= 4.5 && canSee(t)) {
      unfollow(); clearMove();
      await equip(lava);
      const ok = await aimUntil(t.position.offset(0, 0.05, 0), 600, 0.1);
      if (ok) {
        b.activateItem(); // يحط لافا عند رجلين الخصم
        lavaReadyAt = now + rnd(6000, 9000);
      }
      return;
    }
    await swordFight(t, dist);
  }

  async function launch(t, mace, wind) {
    unfollow(); clearMove();
    await equip(wind);
    await aimUntil(downPoint(), 500, 0.1);
    b.setControlState('jump', true);
    await sleep(100);
    b.activateItem(); // ويند شارج تحت رجليه ليقفز
    await sleep(60);
    b.setControlState('jump', false);
    b.setControlState('forward', true);
    b.setControlState('sprint', true);
    smash = { phase: 'air', since: Date.now(), readyAt: 0, peak: b.entity.position.y };
    await sleep(120);
    await equip(mace);
  }

  async function maceFight(t, dist) {
    const now = Date.now();
    const mace = find((n) => n === 'mace');
    const wind = find((n) => n === 'wind_charge');
    if (smash.phase === 'air') {
      smash.peak = Math.max(smash.peak, b.entity.position.y);
      faceTarget(t);
      b.setControlState('forward', true);
      b.setControlState('sprint', true);
      if ((b.entity.onGround && now - smash.since > 400) || now - smash.since > 3500) {
        smash = { phase: 'idle', since: 0, readyAt: now + 2200, peak: 0 };
        clearMove();
        return;
      }
      const fell = smash.peak - b.entity.position.y;
      if (b.entity.velocity.y < -0.25 && fell >= 1.5 && now >= nextAttack
          && reachDist(t) <= 3.0 && canSee(t) && lookHits(t.position, 0.3, t.height || 1.8, 3.1)) {
        if (heldName() !== 'mace') await equip(mace);
        b.attack(t);
        nextAttack = now + 1700;
      }
      return;
    }
    if (mace && wind && b.entity.onGround && dist >= 3.5 && dist <= 9 && now >= smash.readyAt && canSee(t)) {
      await launch(t, mace, wind);
      return;
    }
    await equip(pickMelee(t) || mace);
    meleeMove(t, dist);
    tryHit(t);
  }

  // ---------- كريستال ----------
  const isAir = (p) => { const k = b.blockAt(p); return !!k && (k.name === 'air' || k.name === 'cave_air' || k.name === 'void_air'); };
  function nearestCrystal(t) {
    let bestE = null, bd = 99;
    for (const id in b.entities) {
      const e = b.entities[id];
      if (!e || e.name !== 'end_crystal') continue;
      const d = e.position.distanceTo(t.position);
      if (d <= 6 && d < bd) { bestE = e; bd = d; }
    }
    return bestE;
  }
  function crystalDist(cr) {
    const e = eye();
    const p = cr.position;
    const cx = Math.max(p.x - 1, Math.min(e.x, p.x + 1));
    const cy = Math.max(p.y, Math.min(e.y, p.y + 2));
    const cz = Math.max(p.z - 1, Math.min(e.z, p.z + 1));
    return Math.sqrt((e.x - cx) ** 2 + (e.y - cy) ** 2 + (e.z - cz) ** 2);
  }
  function breakCrystal(cr) {
    if (crystalDist(cr) > 3.0) return false; // مدى التفاعل مع الكائنات 3 بلوكات
    if (b.health < 8 && b.entity.position.distanceTo(cr.position) < 4.5) return false;
    const c = cr.position.offset(0, 1, 0);
    if (!clearLine(eye(), c)) return false;
    aimStep(c, 0.6);
    if (!lookHits(cr.position, 1.0, 2.0, 3.1)) return false;
    b.attack(cr);
    return true;
  }
  async function placeNear(t) {
    const bx = Math.floor(t.position.x);
    const bz = Math.floor(t.position.z);
    const fy = Math.floor(t.position.y + 0.01);
    const offs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]
      .sort(() => Math.random() - 0.5);
    const e = eye();
    const crystal = find((n) => n === 'end_crystal');
    if (crystal) {
      for (const y of [fy, fy - 1]) {
        for (const [dx, dz] of offs) {
          const gp = new Vec3(bx + dx, y, bz + dz);
          const g = b.blockAt(gp);
          if (!g || (g.name !== 'obsidian' && g.name !== 'bedrock')) continue;
          if (!isAir(gp.offset(0, 1, 0)) || !isAir(gp.offset(0, 2, 0))) continue;
          if (e.distanceTo(gp.offset(0.5, 1, 0.5)) > 4.5) continue;
          await equip(crystal);
          if (!(await aimUntil(gp.offset(0.5, 0.98, 0.5), 600, 0.1))) return false;
          Promise.resolve(b.activateBlock(g, new Vec3(0, 1, 0))).catch(() => {});
          return true;
        }
      }
    }
    const obs = find((n) => n === 'obsidian');
    if (!obs) return false;
    for (const [dx, dz] of offs) {
      const gp = new Vec3(bx + dx, fy - 1, bz + dz);
      const g = b.blockAt(gp);
      if (!g || g.boundingBox !== 'block' || g.name === 'obsidian' || g.name === 'bedrock') continue;
      if (!isAir(gp.offset(0, 1, 0)) || !isAir(gp.offset(0, 2, 0)) || !isAir(gp.offset(0, 3, 0))) continue;
      if (e.distanceTo(gp.offset(0.5, 1, 0.5)) > 4.5) continue;
      await equip(obs);
      if (!(await aimUntil(gp.offset(0.5, 0.98, 0.5), 600, 0.1))) return false;
      await withTimeout(b.placeBlock(g, new Vec3(0, 1, 0)), 600).catch(() => {});
      return true;
    }
    return false;
  }

  // أنكور: يحط الأنكور، يشحنه بقطعة جلوستون وحدة، ثم يضغط رايت كليك عليه مرة ثانية ليتفجر
  async function anchorCombo(t) {
    const bx = Math.floor(t.position.x);
    const bz = Math.floor(t.position.z);
    const fy = Math.floor(t.position.y + 0.01);
    const offs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].sort(() => Math.random() - 0.5);
    const e = eye();
    let spot = null;
    for (const [dx, dz] of offs) {
      const gp = new Vec3(bx + dx, fy - 1, bz + dz);
      const g = b.blockAt(gp);
      if (!g || g.boundingBox !== 'block' || g.name === 'respawn_anchor') continue;
      if (!isAir(gp.offset(0, 1, 0)) || !isAir(gp.offset(0, 2, 0))) continue;
      if (e.distanceTo(gp.offset(0.5, 1, 0.5)) > 4.5) continue;
      spot = g;
      break;
    }
    if (!spot) return false;
    unfollow(); clearMove();
    await equip(find((n) => n === 'respawn_anchor'));
    if (!(await aimUntil(spot.position.offset(0.5, 0.98, 0.5), 600, 0.1))) return false;
    await withTimeout(b.placeBlock(spot, new Vec3(0, 1, 0)), 700).catch(() => {});
    const apos = spot.position.offset(0, 1, 0);
    let ab = b.blockAt(apos);
    if (!ab || ab.name !== 'respawn_anchor') return false;
    const center = apos.offset(0.5, 0.9, 0.5);
    // 1) شحن بجلوستون واحدة
    await equip(find((n) => n === 'glowstone'));
    await aimUntil(center, 500, 0.1);
    ab = b.blockAt(apos) || ab;
    Promise.resolve(b.activateBlock(ab, new Vec3(0, 1, 0))).catch(() => {});
    await sleep(rnd(180, 320));
    // 2) رايت كليك ثاني بغير الجلوستون ليفجّره، بشرط الخصم قريب والبوت آمن
    const off = b.inventory.slots[45];
    const hasTotem = !!(off && off.name === 'totem_of_undying');
    const td = t.position.distanceTo(apos);
    const myd = b.entity.position.distanceTo(apos);
    if (td <= 5 && (myd >= 3 || hasTotem) && (b.health >= 12 || hasTotem)) {
      const sw = best('_sword');
      if (sw) await equip(sw); else { try { await b.unequip('hand'); } catch (e) {} }
      await aimUntil(center, 500, 0.1);
      ab = b.blockAt(apos);
      if (ab && ab.name === 'respawn_anchor') {
        Promise.resolve(b.activateBlock(ab, new Vec3(0, 1, 0))).catch(() => {});
      }
    }
    return true;
  }

  async function crystalFight(t, dist) {
    const now = Date.now();
    if (now >= crystalActAt) {
      const cr = nearestCrystal(t);
      if (cr && breakCrystal(cr)) {
        crystalActAt = now + rnd(130, 230);
        ringMove(t, dist, 3.5, 5);
        return;
      }
    }
    if (dist <= 3.1) {
      await equip(pickMelee(t));
      meleeMove(t, dist);
      tryHit(t);
      return;
    }
    ringMove(t, dist, 3.5, 5);
    const anchor = find((n) => n === 'respawn_anchor');
    const glow = find((n) => n === 'glowstone');
    if (anchor && glow && now >= anchorReadyAt && dist <= 7 && b.health >= 10) {
      anchorReadyAt = now + rnd(7000, 11000);
      if (await anchorCombo(t)) return;
    }
    if (now >= placeAt) {
      placeAt = now + rnd(300, 560);
      await placeNear(t);
    }
  }

  // ---------- الحلقة الرئيسية ----------
  // ---------- العالم: في اللوبي ما يضرب ----------
  function worldNames() {
    const g = b.game || {};
    const out = [];
    for (const v of [g.worldName, g.dimension, g.dimensionName]) {
      if (typeof v === 'string' && v) out.push(v.toLowerCase());
    }
    return out;
  }
  const inLobby = () => worldNames().some((w) => w.includes(LOBBY_WORLD));
  let lastWorld = null;
  function checkWorld() {
    const w = worldNames().join(' / ');
    if (w === lastWorld) return;
    lastWorld = w;
    log('العالم الحالي: ' + (w || 'غير معروف') + (inLobby() ? ' (لوبي، لا ضرب)' : ''), 'info');
    if (inLobby() && duel && duel.retaliate) endDuel('دخل اللوبي، تم إلغاء الدفاع');
  }

  function detectMode() {
    if (find((n) => n === 'mace')) return 'spearmace';
    if (find((n) => n === 'end_crystal' || n === 'respawn_anchor')) return 'crystal';
    if (find((n) => n === 'lava_bucket')) return 'uhc';
    return 'sword';
  }

  function getTarget() {
    if (!duel) return null;
    const want = duel.name.toLowerCase();
    for (const k of Object.keys(b.players)) {
      if (k.toLowerCase() === want) return b.players[k].entity || null;
    }
    return null;
  }

  function endDuel(reason) {
    if (!duel) return;
    duel = null;
    inDuel = false;
    smash = { phase: 'idle', since: 0, readyAt: 0, peak: 0 };
    unfollow(); clearMove();
    log(reason, 'info');
  }

  async function fight() {
    const now = Date.now();
    if (duel.retaliate && now - duel.lastHit > 25000) { endDuel('هدأت الأمور، البوت يوقف الدفاع'); return; }
    const t = getTarget();
    if (!t) {
      if (now - duel.lastSeen > 12000) endDuel('انتهى الدويل (الخصم غير موجود)');
      return;
    }
    duel.lastSeen = now;
    if (now - duel.since > 6 * 60e3) { endDuel('انتهى الوقت'); return; }
    const dist = b.entity.position.distanceTo(t.position);
    if (dist > 48) return;
    if (await ensureTotem()) return; // لو انكسر التوتم يلبس غيره فوراً قبل أي شيء
    if (await lavaSafety()) return;
    if (await maybeEat(dist)) return;
    const mode = detectMode();
    if (mode === 'spearmace') await maceFight(t, dist);
    else if (mode === 'crystal') await crystalFight(t, dist);
    else if (mode === 'uhc') await uhcFight(t, dist);
    else await swordFight(t, dist);
  }

  async function tick() {
    if (busy || !duel || eating) return;
    if (inLobby()) {
      // اللوبي: لا ضرب إلا إذا في دويل مقبول لسه ما انتهى
      if (duel.retaliate || duel.sawArena || Date.now() - duel.since > 120000) {
        endDuel('البوت في اللوبي، تم إلغاء نظام الضرب');
        return;
      }
    } else {
      duel.sawArena = true; // صار في عالم الدويل
    }
    if (Date.now() < kbUntil) { // انضرب: يترك الحركة لحظة ليتأثر بالـ knockback
      unfollow(); clearMove();
      const tg = getTarget();
      if (tg) faceTarget(tg);
      return;
    }
    busy = true;
    try { await fight(); } catch (e) {} finally { busy = false; }
  }

  // ---------- طلبات الدويل ----------
  const BAD = /accepted|started|won |lost|cancel|expire|declin|ended|finished|victory|winner/i;
  const REQ = /challeng|request|invit|sent you|duel you|has sent|wants? to duel/i;

  function findPlayerName(msg) {
    const tokens = msg.match(/[A-Za-z0-9_]{3,16}/g) || [];
    const names = Object.keys(b.players);
    for (const tk of tokens) {
      if (tk.toLowerCase() === b.username.toLowerCase()) continue;
      const hit = names.find((n) => n.toLowerCase() === tk.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  function onChat(jsonMsg, position) {
    if (position === 'game_info') return;
    let text = '';
    let raw = '';
    try { text = jsonMsg.toString(); } catch (e) {}
    try { raw = JSON.stringify(jsonMsg.json || jsonMsg); } catch (e) {}
    if (duel && !duel.retaliate && text.toLowerCase().includes(duel.name.toLowerCase())
        && /won|winner|victory|defeated|slain|killed|died/i.test(text)) {
      endDuel('انتهى الدويل، تم إلغاء نظام الضرب');
      return;
    }
    const hasDuel = /duel/i.test(text) || /\/duel\s+accept/i.test(raw);
    if (!hasDuel) return;
    log('رسالة دويل: ' + text.slice(0, 160), 'info');

    let name = null;
    const m = text.match(/\/duel\s+accept\s+([A-Za-z0-9_]{3,16})/i) || raw.match(/\/duel\s+accept\s+([A-Za-z0-9_]{3,16})/i);
    if (m) name = m[1];
    else {
      if (BAD.test(text) || !REQ.test(text)) return;
      name = findPlayerName(text);
    }
    if (!name || name.toLowerCase() === b.username.toLowerCase()) return;
    clearTimeout(acceptTimer);
    acceptTimer = setTimeout(() => {
      const now = Date.now();
      if (lastAccept.name === name && now - lastAccept.at < 2500) return;
      lastAccept = { name, at: now };
      b.chat('/duel accept ' + name); // آخر شخص أرسل طلباً هو اللي يُقبل
      duel = { name, since: now, lastSeen: now };
      inDuel = true;
      log('كتب البوت: /duel accept ' + name, 'ok');
    }, 700);
  }

  b.on('message', onChat);
  b.on('death', () => endDuel('مات البوت، تم إلغاء نظام الضرب'));
  b.on('entityDead', (e) => {
    if (duel && e && e.type === 'player' && e.username && e.username.toLowerCase() === duel.name.toLowerCase()) {
      endDuel('الخصم مات، تم إلغاء نظام الضرب');
    }
  });
  let lastHurtAt = 0;
  let lastHealth = b.health || 20;

  // لو الـ knockback ما انطبق من المكتبة، نطبّقه نحن بنفس قوة اللعبة (مرة وحدة بدون تكرار)
  function checkKnockback() {
    const t = getTarget();
    if (!t || !b.entity) return;
    const p0 = b.entity.position.clone();
    setTimeout(() => {
      try {
        if (!b.entity || !duel) return;
        const away = b.entity.position.minus(t.position);
        const n = Math.hypot(away.x, away.z) || 1;
        const ax = away.x / n, az = away.z / n;
        const moved = (b.entity.position.x - p0.x) * ax + (b.entity.position.z - p0.z) * az;
        if (moved < 0.25) {
          b.entity.velocity.x += ax * 0.4;
          b.entity.velocity.z += az * 0.4;
          if (b.entity.onGround) b.entity.velocity.y = Math.max(b.entity.velocity.y, 0.36);
        }
      } catch (e) {}
    }, 220);
  }

  function onHurt() {
    const now = Date.now();
    if (now - lastHurtAt < 120) return;
    lastHurtAt = now;
    if (!b.entity || onFire() || b.entity.isInLava) return; // النار واللافا مو ضربة لاعب
    if (duel) {
      if (duel.retaliate) duel.lastHit = now;
      kbUntil = now + rnd(320, 480); // يترك الحركة ليرجع لورا مثل أي لاعب
      unfollow(); clearMove();
      checkKnockback();
      return;
    }
    if (inLobby()) return; // في اللوبي ما يرد على أحد
    // ما في دويل: يرد فقط على اللي ضربه (أقرب لاعب)
    let near = null, nd = 5;
    for (const k of Object.keys(b.players)) {
      const p = b.players[k];
      if (!p.entity || p.username === b.username) continue;
      const d = b.entity.position.distanceTo(p.entity.position);
      if (d < nd) { near = p; nd = d; }
    }
    if (near) {
      duel = { name: near.username, since: now, lastSeen: now, lastHit: now, retaliate: true };
      inDuel = true;
      kbUntil = now + rnd(320, 480);
      unfollow(); clearMove();
      checkKnockback();
      log('ضربه ' + near.username + '، البوت يدافع عن نفسه', 'warn');
    }
  }
  b.on('entityHurt', (e) => { if (e && b.entity && e.id === b.entity.id) onHurt(); });
  b.on('health', () => {
    if (b.health < lastHealth) onHurt(); // احتياط: لو حدث الضربة ما وصل نكتشفها من نزول الصحة
    lastHealth = b.health;
  });
  try {
    b._client.on('entity_status', (p) => {
      if (b.entity && p.entityId === b.entity.id && p.entityStatus === 35) totemCheckAt = 0; // انكسر التوتم
    });
  } catch (e) {}
  const timer = setInterval(tick, 50);
  const wtimer = setInterval(checkWorld, 500);
  return {
    stop() { clearInterval(timer); clearInterval(wtimer); clearTimeout(acceptTimer); inDuel = false; }
  };
}

// ======================= الاتصال =======================
function antiAfk(b) {
  if (inDuel) return;
  try {
    b.setControlState('jump', true);
    setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 300);
  } catch (e) {}
}

function cleanup() {
  clearInterval(afk);
  afk = null;
  if (combat) { combat.stop(); combat = null; }
  if (bot) {
    const b = bot;
    bot = null;
    try { b.removeAllListeners(); b.on('error', () => {}); b.end(); } catch (e) {}
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const dup = /another location|already|logged in|same name|duplicate|already online/i.test(lastKick);
  let delay = Math.min(90000, 6000 + attempts * 6000);
  if (dup) {
    delay = 90000;
    log('يوجد بوت آخر بنفس الاسم شغال (نسخة قديمة على Render؟). أوقف النسخة الثانية.', 'warn');
  }
  log('إعادة المحاولة بعد ' + Math.round(delay / 1000) + ' ثانية...', 'info');
  reconnectTimer = setTimeout(() => { reconnectTimer = null; startBot(); }, delay);
}

async function startBot() {
  if (bot || starting || reconnectTimer) return;
  starting = true;
  try {
    setState('connecting');
    let host = HOST;
    let port = MC_PORT;
    if (!net.isIP(host) && port === 25565) {
      try {
        const srv = await dns.resolveSrv('_minecraft._tcp.' + host);
        if (srv.length) { host = srv[0].name; port = srv[0].port; }
      } catch (e) { /* لا يوجد SRV */ }
    }
    log('جارٍ الدخول إلى ' + HOST + ' ...');
    lastKick = '';
    const b = mineflayer.createBot({
      host, port, fakeHost: HOST, username: NAME,
      auth: 'offline', hideErrors: true, checkTimeoutInterval: 90000
    });
    bot = b;
    b.loadPlugin(pathfinder);
    b.once('login', () => log('تم الاتصال، جارٍ تحميل العالم...', 'ok'));
    b.once('spawn', () => {
      upSince = Date.now();
      try {
        const mv = new Movements(b);
        mv.canDig = false;
        mv.allow1by1towers = false;
        mv.scafoldingBlocks = [];
        b.pathfinder.setMovements(mv);
      } catch (e) { log('تعذر تجهيز التنقل: ' + e.message, 'err'); }
      combat = initCombat(b);
      setState('online');
      log('البوت ' + NAME + ' جاهز، أرسل له /duel', 'ok');
      afk = setInterval(() => antiAfk(b), 40000);
    });
    b.on('kicked', (r) => { lastKick = reasonText(r); log('تم طرد البوت: ' + lastKick, 'err'); });
    b.on('error', (e) => log('خطأ: ' + (e && e.message ? e.message : e), 'err'));
    b.once('end', (why) => {
      if (bot !== b) return;
      const lived = upSince ? Date.now() - upSince : 0;
      attempts = lived > 60000 ? 0 : attempts + 1; // لو ثبت دقيقة نصفّر العداد
      upSince = 0;
      cleanup();
      setState('offline');
      log('انقطع الاتصال بالسيرفر' + (why ? ' (' + String(why).slice(0, 80) + ')' : ''), 'warn');
      scheduleReconnect();
    });
  } catch (e) {
    cleanup();
    attempts++;
    setState('offline');
    log('تعذر تشغيل البوت: ' + (e && e.message ? e.message : e), 'err');
    scheduleReconnect();
  } finally {
    starting = false;
  }
}

const server = http.createServer((req, res) => {
  startBot();
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK ' + state);
    return;
  }
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(err ? PAGE : data); // الصفحة من index.html، ولو مفقود تُستخدم النسخة المدمجة
  });
});

const wss = new WebSocketServer({ server, maxPayload: 1024 });
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => {});
  ws.send(JSON.stringify(statusMsg()));
  logs.forEach((e) => ws.send(JSON.stringify(e)));
  startBot();
});

setInterval(() => {
  wss.clients.forEach((c) => {
    if (!c.isAlive) { c.terminate(); return; }
    c.isAlive = false;
    try { c.ping(); } catch (e) {}
  });
}, 30000);

process.on('uncaughtException', (e) => console.error('uncaught:', e && e.message));
process.on('unhandledRejection', (e) => console.error('unhandled:', e && e.message));

server.listen(WEB_PORT, () => {
  console.log('listening on :' + WEB_PORT);
  startBot();
});
