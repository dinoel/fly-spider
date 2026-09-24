// House flies and greenbottles for the simulator. Anatomy, gait and grooming come from an earlier
// single-fly prototype; here many live in one scene, each of its own size,
// and a fly can end up in the web: stuck, struggling, bitten, wrapped and eaten.
(function (Sim) {
  'use strict';
  const { DEG, TAU, rnd, pick, clamp, ease, n2, angDiff, approach, mirror, both } = Sim.U;
  const NS = 'http://www.w3.org/2000/svg', WEBZ = Sim.WEBZ;
  const BOX = 64;
  const WING_REST = 21;             // degrees each folded wing points out from the body axis
  const THR = 3.2, SETTLE = .8;     // how far a foot may lag behind before it steps: walking, standing

  /* Body units, origin in the middle of the thorax, head towards +x, the fly's right side towards +y.
     Paths mirrored by `mirror` use only M, L, C and Q. */
  const HEAD = 'M7.3-4.7C9-5.5 11-4.5 11.7-2.3C12-1 12 1 11.7 2.3C11 4.5 9 5.5 7.3 4.7C7.8 2.6 7.8-2.6 7.3-4.7Z';
  const EYE = 'M7.5-4.7C9.2-5.5 10.9-4.6 11.4-2.8C11.6-2.1 11.4-1.5 11-1.2C10-1 8.7-1.1 7.9-1.4C7.5-2.4 7.3-3.8 7.5-4.7Z';
  const THORAX = 'M6.9-3.6C7.1-1.5 7.1 1.5 6.9 3.6C6.2 4.9 4.5 5.4 2 5.5C-1 5.6-3.2 4.9-3.9 3.4C-4.3 1.4-4.3-1.4-3.9-3.4C-3.2-4.9-1-5.6 2-5.5C4.5-5.4 6.2-4.9 6.9-3.6Z';
  const STRIPES = 'M6.3-.9L-2.8-.8M6-2.7C3-2.9 0-3-3-2.6';
  const SCUTELLUM = 'M-3.7-2.7C-5.2-2.7-6.4-1.5-6.4 0C-6.4 1.5-5.2 2.7-3.7 2.7Z';
  const ABDOMEN = 'M-4.3-3.8C-5.8-5.3-8.5-5.6-10.8-5C-13.3-4.3-15.3-2.4-15.6 0C-15.3 2.4-13.3 4.3-10.8 5C-8.5 5.6-5.8 5.3-4.3 3.8C-3.9 1.3-3.9-1.3-4.3-3.8Z';
  const SEGMENTS = 'M-7.3-5.2C-6.7-2-6.7 2-7.3 5.2M-9.9-5.1C-9.3-2-9.3 2-9.9 5.1M-12.4-4.2C-11.9-1.6-11.9 1.6-12.4 4.2';
  const BRISTLES = 'M6.1-4.3L5.2-5.3M3.8-5.3L2.8-6.1M1.2-5.5L0-6.2M-1.6-5.2L-2.7-5.8M-3.4-4.1L-4.4-4.7' +
    'M4.6-1.8L3.9-1.8M2.4-1.8L1.7-1.8M.2-1.8L-.5-1.8M-6-1.2L-7.3-1.8M-6.3-.4L-7.6-.6M7.7-3.9L7-4.6' +
    'M-14.6-1.9L-15.7-2.4M-15.3-.7L-16.5-.8M-12.6-4L-13.4-4.9M-10-4.9L-10.6-5.9';
  const SHROUD = 'M13.2 0C13.2-4 9-6.8 2-7C-6-7.2-13.8-5.6-16.8-2.6C-18-1.1-18 1.1-16.8 2.6C-13.8 5.6-6 7.2 2 7C9 6.8 13.2 4 13.2 0Z';

  /* Wing units: u from the root to the tip, v towards the leading edge. The fourth vein bends
     sharply forward near the tip, which is what tells a Musca wing from others. */
  const WING = 'M0 .3C4 1.3 10 2.2 14.5 2.2C16.6 2.1 17.6 1 17.4-.4C17-2.3 14.5-3.9 11-4.3C7.5-4.6 4.5-4 2.8-2.8C2.2-2.4 1.8-1.6 1.2-1.9C.6-1.5.1-.7 0 .3Z';
  const COSTA = 'M.2.4C4 1.4 10 2.3 14.5 2.3C15.8 2.25 16.6 1.9 17 1.3';
  const VEINS = 'M.5.2C3 .9 5 1.3 6.8 1.7M.8 0C5 .6 10 1.4 14.2 2.1M1-.3C6-.2 12 .3 16.9 1.2' +
    'M1.2-.6C6-1.3 11-1.6 13.8-1.8Q15.3-1.8 15.9-.6L17.3.3M1.4-.9C5-2.2 9-3 12.2-4.1M1.3-1.1C2.5-2 3.5-2.6 4.6-3.3' +
    'M7.4-.2L7.6-1.4M11.3-1.62L11.7-3.8';
  const ROOT = [.5, 4.4], WL = 17.5;

  const fanPath = sg => {
    const at = deg => [ROOT[0] - Math.cos(deg * DEG) * WL, sg * (ROOT[1] + Math.sin(deg * DEG) * WL)].map(n2).join(' ');
    return `M${ROOT[0]} ${ROOT[1] * sg}L${at(15)}A${WL} ${WL} 0 0 ${sg > 0 ? 0 : 1} ${at(100)}Z`;
  };
  const fanGrad = (id, sg) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${ROOT[0]}" cy="${ROOT[1] * sg}" r="${WL}">
    <stop offset=".25" stop-color="#8a909a" stop-opacity=".04"/><stop offset=".8" stop-color="#8a909a" stop-opacity=".22"/>
    <stop offset=".97" stop-color="#8a909a" stop-opacity=".34"/><stop offset="1" stop-color="#8a909a" stop-opacity="0"/></radialGradient>`;
  Sim.flyDefs = `
    <radialGradient id="flyEye" cx=".62" cy=".4" r=".75"><stop offset="0" stop-color="#a64c34"/><stop offset=".5" stop-color="#6c2618"/><stop offset="1" stop-color="#33100a"/></radialGradient>
    <radialGradient id="flyThorax" cx=".6" cy=".5" r=".65"><stop offset="0" stop-color="#95958f"/><stop offset="1" stop-color="#474744"/></radialGradient>
    <radialGradient id="flyAbdomen" cx=".62" cy=".5" r=".62"><stop offset="0" stop-color="#a8966d"/><stop offset=".6" stop-color="#6e6047"/><stop offset="1" stop-color="#3a3226"/></radialGradient>
    <radialGradient id="flyThoraxG" cx=".6" cy=".42" r=".7"><stop offset="0" stop-color="#9ccf9c"/><stop offset=".45" stop-color="#3f8657"/><stop offset="1" stop-color="#173623"/></radialGradient>
    <radialGradient id="flyAbdomenG" cx=".6" cy=".4" r=".7"><stop offset="0" stop-color="#b3e2b6"/><stop offset=".35" stop-color="#48a078"/><stop offset=".75" stop-color="#23604a"/><stop offset="1" stop-color="#0f2a1e"/></radialGradient>
    <linearGradient id="flySheen"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".4" stop-color="#d8c6ff" stop-opacity=".17"/>
      <stop offset=".7" stop-color="#b6f4dc" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>
    <radialGradient id="flySilk" cx=".45" cy=".38" r=".7"><stop offset="0" stop-color="#fbfaf4"/><stop offset=".55" stop-color="#e8e4d8"/><stop offset="1" stop-color="#aea896"/></radialGradient>
    ${fanGrad('flyBeatL', -1)}${fanGrad('flyBeatR', 1)}`;
  // Mid-grey membrane darkens a light page and lightens a dark one; the white rim carries it on black.
  const wingMarkup = `<g class="fly-wing">
    <path d="${WING}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".7"/>
    <path d="${WING}" fill="#8a909a" fill-opacity=".28"/>
    <path d="${WING}" fill="url(#flySheen)"/>
    <path d="${WING}" fill="none" stroke="#1e1b18" stroke-opacity=".5" stroke-width=".22"/>
    <path d="${COSTA}" fill="none" stroke="#342418" stroke-opacity=".85" stroke-width=".42" stroke-linecap="round"/>
    <path d="${VEINS}" fill="none" stroke="#3c2a1c" stroke-opacity=".7" stroke-width=".26" stroke-linecap="round"/></g>`;
  const spots = [[-6, 2.9, .9, .7], [-8.5, 2.7, 1.1, .75], [-11.2, 2.3, 1, .7]]
    .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/><ellipse cx="${x}" cy="${-y}" rx="${rx}" ry="${ry}"/>`).join('');
  // Silk for a wrapped fly: a shroud that thickens, and strands across the body at random slants, laid on one by one.
  // Capture threads a stuck fly is tangled in, beaded with glue like the spiral they came from.
  const snareMarkup = () => {
    let d = '';
    for (let k = 0; k < 5; k++) {
      const a = rnd(-.9, .9) + (k % 2 ? Math.PI / 2 : 0), cx = rnd(-10, 8), cy = rnd(-4, 4), l = rnd(15, 22);
      d += `M${n2(cx - Math.cos(a) * l)} ${n2(cy - Math.sin(a) * l)}L${n2(cx + Math.cos(a) * l)} ${n2(cy + Math.sin(a) * l)}`;
    }
    return `<g class="fly-snare" display="none" fill="none" stroke="#f2f4ee" stroke-linecap="round"><path d="${d}" stroke-opacity=".42" stroke-width=".3"/>` +
      `<path d="${d}" stroke-opacity=".38" stroke-width=".85" stroke-dasharray=".01 2.2"/></g>`;
  };
  const silkMarkup = () => {
    let s = `<path class="fly-shroud" d="${SHROUD}" fill="url(#flySilk)" opacity="0"/>`;
    for (let k = 0; k < 44; k++) {
      const x = rnd(-15.5, 11.5), h = 6.6 * Math.sqrt(Math.max(0, 1 - ((x + 2) / 15.4) ** 2)) + .5, sl = rnd(-4.5, 4.5), bow = rnd(-1.2, 1.2);
      s += `<path class="fly-strand" d="M${n2(x + sl)} ${n2(-h)}Q${n2(x + bow)} 0 ${n2(x - sl)} ${n2(h)}" fill="none" stroke="#f7f5ee" ` +
        `stroke-width="${n2(rnd(.22, .55))}" stroke-opacity="${n2(rnd(.45, .9))}" display="none"/>`;
    }
    return s;
  };

  /* A house fly, or now and then a greenbottle, Lucilia, bigger and metallic, with no stripes on its back. */
  const KINDS = {
    house: { name: 'house fly', thorax: 'flyThorax', abdomen: 'flyAbdomen', scutellum: '#6a6964', stripes: .72, spots: .35, dark: [0, .32] },
    green: { name: 'greenbottle', thorax: 'flyThoraxG', abdomen: 'flyAbdomenG', scutellum: '#2c5c3e', stripes: .1, spots: 0, dark: [0, .18] },
  };

  Sim.makeFly = function (world, size, kind) {
    const K = KINDS[kind] || KINDS.house;
    const S = 7 * size * Sim.MM / 27, HALF = BOX * S / 2, pace = Math.sqrt(size);   // px per unit; the body is 27 units, 7 mm at size 1
    const metal = K === KINDS.green ? `<ellipse cx="1.5" cy="-2" rx="3.6" ry="1.6" fill="#e8fff0" fill-opacity=".28"/><ellipse cx="-9" cy="-2.2" rx="3.8" ry="1.7" fill="#e8fff0" fill-opacity=".26"/>` : '';
    const el = document.createElement('div');
    el.className = 'fly';
    el.style.width = el.style.height = `${BOX * S}px`;
    el.innerHTML = `<svg viewBox="${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}" focusable="false" shape-rendering="geometricPrecision">
    <g class="fly-body">
      <g class="fly-legs"></g>
      <path d="${ABDOMEN}" fill="url(#${K.abdomen})"/>
      <path d="${ABDOMEN}" fill="#17130e" fill-opacity="${n2(rnd(...K.dark))}"/>
      <path d="M-5.2 0L-14.3 0" stroke="#2a241b" stroke-opacity="${n2(K.spots * 1.6)}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="${SEGMENTS}" fill="none" stroke="#231c14" stroke-opacity=".45" stroke-width=".45"/>
      <g fill="#2a2218" fill-opacity="${K.spots}">${spots}</g>
      <g fill="#ece6d4" fill-opacity=".85" stroke="#6b5f45" stroke-opacity=".35" stroke-width=".2"><ellipse cx="-3.3" cy="-4.1" rx="2" ry="1.3"/><ellipse cx="-3.3" cy="4.1" rx="2" ry="1.3"/></g>
      <path d="${THORAX}" fill="url(#${K.thorax})"/>
      <path d="${both(STRIPES)}" fill="none" stroke="#1d1c1a" stroke-opacity="${K.stripes}" stroke-width=".85" stroke-linecap="round"/>
      <path d="${SCUTELLUM}" fill="${K.scutellum}"/>
      ${metal}
      <path d="${both(BRISTLES)}" fill="none" stroke="#11100f" stroke-opacity=".85" stroke-width=".26" stroke-linecap="round"/>
      <g class="fly-head">
        <path d="${HEAD}" fill="#2c2825"/>
        <path d="${EYE}" fill="url(#flyEye)"/><path d="${mirror(EYE)}" fill="url(#flyEye)"/>
        <path d="M7.9-1.4C8.7-1.1 10-1 11-1.2L11 1.2C10 1 8.7 1.1 7.9 1.4Z" fill="#241713"/>
        <path d="M11.4-2.6C11.9-1.6 12-.6 11.9 0C12 .6 11.9 1.6 11.4 2.6" fill="none" stroke="#d8cfae" stroke-opacity=".6" stroke-width=".45"/>
        <g fill="#c09a82" fill-opacity=".8"><circle cx="7.9" cy="0" r=".2"/><circle cx="8.4" cy="-.35" r=".2"/><circle cx="8.4" cy=".35" r=".2"/></g>
        <path d="M11.9-.5L12.7-.8M11.9.5L12.7.8" stroke="#5c3d24" stroke-width=".35" stroke-linecap="round"/>
        <g fill="#fff" fill-opacity=".3"><ellipse cx="10" cy="-3.7" rx="1" ry=".42" transform="rotate(-18 10 -3.7)"/><ellipse cx="10" cy="3.7" rx="1" ry=".42" transform="rotate(18 10 3.7)"/></g>
      </g>
      <path class="fly-fan" d="${fanPath(-1)}" fill="url(#flyBeatL)" opacity="0"/>
      <path class="fly-fan" d="${fanPath(1)}" fill="url(#flyBeatR)" opacity="0"/>
      ${wingMarkup}${wingMarkup}
      <g class="fly-over"></g>
      ${snareMarkup()}
      <g class="fly-silk">${silkMarkup()}</g>
    </g></svg>`;

    const q = s => el.querySelector(s);
    const bodyG = q('.fly-body'), headG = q('.fly-head'), underG = q('.fly-legs'), overG = q('.fly-over'), shroud = q('.fly-shroud'), snare = q('.fly-snare');
    const wingEls = el.querySelectorAll('.fly-wing'), fanEls = el.querySelectorAll('.fly-fan'), strands = [...el.querySelectorAll('.fly-strand')];

    /* Legs: hip under the thorax, resting foot, projected femur, tibia and tarsus, and the side the knee bends to. */
    const LEFT = [
      { hip: [5, -2.4], rest: [14, -8], len: [4.1, 3.9, 3.6], bend: -1 },
      { hip: [2, -3.4], rest: [1, -14.5], len: [4.2, 4, 4], bend: 1 },
      { hip: [-1, -3], rest: [-11.5, -14], len: [5.6, 5.6, 4.6], bend: 1 },
    ];
    const LEGS = [...LEFT, ...LEFT.map(l => ({ hip: [l.hip[0], -l.hip[1]], rest: [l.rest[0], -l.rest[1]], len: l.len, bend: -l.bend }))];
    const TRIPODS = [[0, 4, 2], [3, 1, 5]];   // left front, right middle, left hind step together
    const segment = (w, c) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', c); p.setAttribute('stroke-width', w); p.setAttribute('stroke-linecap', 'round');
      underG.appendChild(p);
      return p;
    };
    const legs = LEGS.map((g, i) => ({
      i, g, fe: segment(1.05, '#171513'), ti: segment(.72, '#1b1815'), ta: segment(.46, '#27221d'),
      mode: 'stance', w: [0, 0], loc: g.rest.slice(), from: null, jit: [0, 0], t: 0, dur: .08,
      fn: null, t0: 0, sFrom: null, ank: null, ankB: 0, over: false,
    }));

    /* Grooming: which legs leave the ground and where their feet go, in body units over time.
       A fourth and fifth value put the ankle somewhere else than straight behind the foot. */
    const wingStroke = (sg, deg, t) => {
      const p = (t % 460) / 460, u = p < .72 ? 7 + 6.5 * ease(p / .72) : 13.5 - 6.5 * ease((p - .72) / .28);
      const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
      const at = (uu, v) => [ROOT[0] - c * uu + s * v, sg * (ROOT[1] + s * uu + c * v)];
      return [...at(u, -.2), ...at(u - 4, 3)];
    };
    const GROOM = {
      front: { legs: [0, 3], ms: [1400, 3800], pos: (i, t) => { const s = i ? -1 : 1, r = Math.sin(t * .0327); return [14.3 + 1.5 * r * s, -s * (.8 + .3 * Math.cos(t * .0327))]; } },
      head: {
        legs: [0, 3], ms: [1200, 2800], over: true, head: t => Math.sin(t * .0205) * 7,
        pos: (i, t) => { const s = i ? 1 : -1, p = t * .0205 + (i ? Math.PI : 0), fx = 10.3 + 1.8 * Math.cos(p); return [fx, s * (2.8 + 1.4 * Math.sin(p)), fx + 1.6, s * 5.8]; },
      },
      hind: { legs: [2, 5], ms: [1200, 3200], pos: (i, t) => { const s = i === 2 ? 1 : -1, r = Math.sin(t * .029); return [-16 + 1.1 * r * s, -s * (1 + .25 * Math.cos(t * .029))]; } },
      wingL: { legs: [2], ms: [1300, 2600], over: true, wing: 0, pos: (i, t) => wingStroke(-1, P.wingL, t) },
      wingR: { legs: [5], ms: [1300, 2600], over: true, wing: 1, pos: (i, t) => wingStroke(1, P.wingR, t) },
    };
    const SEQS = [['front'], ['front', 'head', 'front'], ['head', 'front'], ['front', 'head'], ['hind'],
      ['hind', 'wingL', 'hind'], ['hind', 'wingR', 'wingL', 'hind'], ['front', 'head', 'front', 'hind']];

    const P = { x: 0, y: 0, a: 0, v: 0, w: 0, vT: 0, wT: 0, sway: 0, swayT: 0, head: 0, headT: 0, wingL: WING_REST, wingR: WING_REST, alt: 0, k: 1 };
    const seed = Math.random() * 100;
    let mode = 'still', until = 0, after = null, heading = 0, walkSpeed = 0, turnRate = 0;
    let twitchAt = 0, nudgeUntil = 0, lookUntil = 0, flickUntil = 0, waryUntil = 0;
    let seq = null, flight = null, lastTripod = 1, stillFor = 0;
    let depth = 0;                    // how far in front of the glass the fly hangs when it is not flying: the web's plane once it is caught
    let prey = null, fall = null, dead = false, alarmAt = 0, alarmFrom = null, landedAt = 0, filterKey = '', silkShown = -1;

    const drawn = () => P.a + P.sway * DEG;
    const toWorld = l => { const c = Math.cos(drawn()), s = Math.sin(drawn()); return [P.x + (l[0] * c - l[1] * s) * S, P.y + (l[0] * s + l[1] * c) * S]; };
    const toLocal = w => { const c = Math.cos(drawn()), s = Math.sin(drawn()), dx = (w[0] - P.x) / S, dy = (w[1] - P.y) / S; return [dx * c + dy * s, dy * c - dx * s]; };
    const inside = (x, y, m) => { const b = world.bounds; return x > b.x0 + m && x < b.x1 - m && y > b.y0 + m && y < b.y1 - m; };
    const strain = L => Math.hypot(L.loc[0] - L.g.rest[0], L.loc[1] - L.g.rest[1]);

    /* ── legs ── a planted foot stays where it is on the glass; the body walks over it until it lags too far */
    function lead(r) {
      const mx = P.v / S - P.w * r[1], my = P.w * r[0], m = Math.hypot(mx, my);
      if (m < .5) return [0, 0];
      const t = Math.min(.2, .85 * THR / m);
      return [mx * t, my * t];
    }
    function swing(L, jit, dur) { L.mode = 'swing'; L.t = 0; L.dur = dur; L.from = L.w.slice(); L.jit = jit; }
    function script(L, fn, over) { L.mode = 'script'; L.fn = fn; L.t0 = world.now; L.sFrom = L.loc.slice(); setOver(L, !!over); }
    function release(L) {
      if (L.mode !== 'script') return;
      L.ank = null; setOver(L, false); L.w = toWorld(L.loc);
      swing(L, [0, 0], .1);
    }
    function setOver(L, over) {
      if (L.over === over) return;
      L.over = over;
      const g = over ? overG : underG;
      g.appendChild(L.ti); g.appendChild(L.ta);
    }
    function stepLegs(dt, now) {
      for (const L of legs) {
        if (L.mode === 'stance') L.loc = toLocal(L.w);
        else if (L.mode === 'swing') {
          L.t = Math.min(1, L.t + dt / L.dur);
          const r = L.g.rest, ld = lead(r), tw = toWorld([r[0] + ld[0] + L.jit[0], r[1] + ld[1] + L.jit[1]]), e = ease(L.t);
          L.w = [L.from[0] + (tw[0] - L.from[0]) * e, L.from[1] + (tw[1] - L.from[1]) * e];
          L.loc = toLocal(L.w);
          if (L.t >= 1) L.mode = 'stance';
        } else {
          const p = L.fn(now), b = ease(Math.min(1, (now - L.t0) / 130));
          L.loc = [L.sFrom[0] + (p[0] - L.sFrom[0]) * b, L.sFrom[1] + (p[1] - L.sFrom[1]) * b];
          L.ank = p.length > 2 ? [p[2], p[3]] : null; L.ankB = b;
        }
      }
      if (mode === 'flight' || prey || legs.some(L => L.mode === 'swing')) return;
      const moving = Math.abs(P.v) > 4 || Math.abs(P.w) > .12;
      stillFor = moving ? 0 : stillFor + dt;
      const thr = moving ? THR : stillFor > .12 ? SETTLE : Infinity;
      for (const tp of [1 - lastTripod, lastTripod]) {
        const set = TRIPODS[tp].filter(i => legs[i].mode === 'stance');
        if (!set.length || Math.max(...set.map(i => strain(legs[i]))) <= thr) continue;
        lastTripod = tp;
        const dur = clamp(.1 - (Math.abs(P.v) / S + Math.abs(P.w) * 12) * .0011, .045, .1);
        for (const i of set) if (moving || strain(legs[i]) > SETTLE / 2) swing(legs[i], [rnd(-.3, .3), rnd(-.3, .3)], dur * rnd(.9, 1.1));
        if (moving) P.swayT = tp ? 1.3 : -1.3;
        return;
      }
    }
    function drawLeg(L) {
      const [hx, hy] = L.g.hip, [lf, lt, ls] = L.g.len;
      let [fx, fy] = L.loc;
      if (L.mode === 'swing') { const k = Math.sin(Math.PI * L.t) * .12; fx += (hx - fx) * k; fy += (hy - fy) * k; }
      const d = Math.hypot(fx - hx, fy - hy) || 1;
      let ax = fx - (fx - hx) / d * ls, ay = fy - (fy - hy) / d * ls;
      if (L.ank) { ax += (L.ank[0] - ax) * L.ankB; ay += (L.ank[1] - ay) * L.ankB; }
      const e = Math.hypot(ax - hx, ay - hy) || 1, vx = (ax - hx) / e, vy = (ay - hy) / e;
      const reach = clamp(e, Math.abs(lf - lt) + .4, lf + lt - .05);
      const along = (lf * lf - lt * lt + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, lf * lf - along * along)) * L.g.bend;
      const kx = hx + vx * along - vy * h, ky = hy + vy * along + vx * h, tx = hx + vx * reach, ty = hy + vy * reach;
      L.fe.setAttribute('d', `M${n2(hx)} ${n2(hy)}L${n2(kx)} ${n2(ky)}`);
      L.ti.setAttribute('d', `M${n2(kx)} ${n2(ky)}L${n2(tx)} ${n2(ty)}`);
      L.ta.setAttribute('d', `M${n2(tx)} ${n2(ty)}L${n2(fx)} ${n2(fy)}`);
    }

    /* ── behaviour ── still or crawling in fits and starts, sharp turns, grooming; flies off when something comes at it */
    function still(now, ms, then) { mode = 'still'; after = then || null; P.vT = P.wT = 0; until = now + (ms || rnd(1800, 7000)); twitchAt = now + rnd(500, 2200); }
    // On a window a fly mostly crawls, in fits and starts and mostly upwards, grooms, and only now and then takes off.
    function decide(now) {
      const r = Math.random();
      if (r < .06) return hop(now);
      if (r < .12) return roam(now);
      if (r < .55) return walk(now);
      if (r < .64) return turn(now, chooseHeading(), n => still(n, rnd(900, 3500)));
      if (r < .84) return groom(now, pick(SEQS));
      still(now);
    }
    function walk(now, flee, from) {
      const h = chooseHeading(flee, from);
      const go = n => { mode = 'walk'; heading = h; walkSpeed = (flee ? rnd(85, 120) : rnd(28, 62)) * pace; until = n + (flee ? rnd(450, 800) : rnd(500, 2600)); };
      if (Math.abs(angDiff(h, P.a)) > 35 * DEG) turn(now, h, go); else go(now);
    }
    function turn(now, h, then) { mode = 'turn'; heading = h; after = then; turnRate = rnd(3.5, 6.5); P.vT = rnd(0, 5); until = now + 1500; }
    function chooseHeading(flee, from) {
      const b = world.bounds, M = world.pointer, T = from || (M.on ? M : null);
      let best = P.a, top = -Infinity;
      for (let k = 0; k < 12; k++) {
        const h = P.a + (k ? rnd(-Math.PI, Math.PI) : 0), ex = P.x + Math.cos(h) * 120, ey = P.y + Math.sin(h) * 120;
        let s = Math.random() * .8 - Math.abs(angDiff(h, P.a)) * (flee ? .1 : .5);
        s -= (Math.max(0, b.x0 + 30 - ex) + Math.max(0, ex - b.x1 + 30) + Math.max(0, b.y0 + 30 - ey) + Math.max(0, ey - b.y1 + 30)) / 25;
        if (T) s -= Math.max(0, 280 - Math.hypot(ex - T.x, ey - T.y)) / (flee ? 30 : 70);
        s += world.light(ex, ey) * .5;
        s -= Math.sin(h) * .3;   // up the pane
        if (s > top) { top = s; best = h; }
      }
      return best;
    }
    function twitch(now) {
      twitchAt = now + rnd(700, 3200);
      const r = Math.random();
      if (r < .3) { P.wT = (Math.random() < .5 ? -1 : 1) * rnd(1.2, 2.4); nudgeUntil = now + rnd(60, 170); }
      else if (r < .5) { P.headT = rnd(-11, 11); lookUntil = now + rnd(400, 1800); }
      else if (r < .65) flickUntil = now + rnd(110, 170);
      else if (r < .85) { const L = pick(legs); if (L.mode === 'stance') swing(L, [rnd(-.5, .5), rnd(-.5, .5)], .09); }
      else groom(now, ['front'], true);
    }
    function groom(now, kinds, short, delay) {
      mode = 'groom'; P.vT = P.wT = 0;
      seq = { list: kinds.slice(), cur: null, t0: 0, end: 0, resume: now + (delay || 0), short };
    }
    function stopGroom() {
      if (seq && seq.cur) GROOM[seq.cur].legs.forEach(i => release(legs[i]));
      seq = null; P.headT = 0;
    }
    function groomStep(now) {
      const G = seq.cur && GROOM[seq.cur];
      if (G) {
        P.headT = G.head ? G.head(now - seq.t0) : 0;
        if (now > seq.end) { G.legs.forEach(i => release(legs[i])); seq.cur = null; seq.resume = now + rnd(120, 420); P.headT = 0; }
        return;
      }
      if (now < seq.resume) return;
      const kind = seq.list.shift();
      if (!kind) { seq = null; return still(now, rnd(1500, 6000)); }
      const K = GROOM[kind], t0 = now;
      seq.cur = kind; seq.t0 = now; seq.end = now + (seq.short ? rnd(350, 800) : rnd(K.ms[0], K.ms[1]));
      K.legs.forEach(i => script(legs[i], n => K.pos(i, n - t0), K.over));
    }

    /* ── flight ── flies make for the light, and the spider has built where the light is */
    function landing(hop) {
      const b = world.bounds, M = world.pointer;
      let best = null, top = -Infinity;
      for (let k = 0; k < 24; k++) {
        const x = rnd(b.x0 + 40, b.x1 - 40), y = rnd(b.y0 + 40, b.y1 - 40), dp = Math.hypot(x - P.x, y - P.y);
        if (dp < (hop ? 90 : 140) || (hop && dp > 380)) continue;
        const dm = M.on ? Math.hypot(x - M.x, y - M.y) : 700;
        if (dm < 200) continue;
        // Flies make for the light, and the spider has built where the light is; but most of the pane lies outside
        // the web, and a fly that comes down on the glass behind it has to fly through the silk to get there.
        const W = world.web, behind = Math.hypot(x - W.hub[0], y - W.hub[1]) < W.maxR;
        const s = Math.min(dm, 800) / 800 * .5 + world.light(x, y) * 1.6 + Math.random() * .9 - (behind ? .6 : 0);
        if (s > top) { top = s; best = [x, y]; }
      }
      return best || [clamp(P.x, b.x0 + 60, b.x1 - 60), clamp(P.y, b.y0 + 60, b.y1 - 60)];
    }
    const tuck = g => {
      const dx = g.rest[0] - g.hip[0], dy = g.rest[1] - g.hip[1];
      return [g.hip[0] + dx * .62 - 2.5, g.hip[1] + dy * .62, g.hip[0] + dx * .45, g.hip[1] + dy * .45];
    };
    function launch(now, dest, dir, zig, enter) {
      stopGroom(); after = null;
      const b = world.bounds, cx = x => clamp(x, b.x0 + 30, b.x1 - 30), cy = y => clamp(y, b.y0 + 30, b.y1 - 30);
      const first = [cx(P.x + dir[0] * rnd(50, 100) + rnd(-25, 25)), cy(P.y + dir[1] * rnd(50, 100) + rnd(-25, 25))], pts = [first];
      for (let k = 1; k <= zig; k++) {
        const t = k / (zig + 1), nx = first[1] - dest[1], ny = dest[0] - first[0], nl = Math.hypot(nx, ny) || 1, o = rnd(-150, 150);
        pts.push([cx(first[0] + (dest[0] - first[0]) * t + nx / nl * o), cy(first[1] + (dest[1] - first[1]) * t + ny / nl * o)]);
      }
      pts.push(dest);
      const alt0 = enter ? 1 : Math.max(P.alt, depth);
      flight = { pts, idx: 0, vx: dir[0] * 300, vy: dir[1] * 300, t0: now, down: false, enter: !!enter, alt0, pa: alt0, torn: false };
      mode = 'flight'; depth = 0; alarmAt = 0; P.v = P.w = P.vT = P.wT = 0; P.headT = 0;
      for (const L of legs) { const t = tuck(L.g); script(L, () => t, false); }
    }
    function takeoff(now, fx, fy) {
      if (mode === 'flight') return;
      const d = Math.hypot(P.x - fx, P.y - fy) || 1;
      launch(now, landing(false), [(P.x - fx) / d, (P.y - fy) / d], Math.floor(rnd(1, 4)));
    }
    function hop(now) { launch(now, landing(true), [Math.cos(P.a), Math.sin(P.a)], 1); }
    function roam(now) { const a = rnd(0, TAU); launch(now, landing(false), [Math.cos(a), Math.sin(a)], Math.floor(rnd(2, 5))); }
    function flightStep(now, dt) {
      const F = flight, b = world.bounds, [tx, ty] = F.pts[F.idx], last = F.idx === F.pts.length - 1;
      const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || .001;
      const top = 850 * (.8 + .2 * size), vmax = last ? Math.min(top, 40 + d * 5.5) : top;
      let ex = dx / d * vmax - F.vx, ey = dy / d * vmax - F.vy;
      const el = Math.hypot(ex, ey), acc = 6500 * dt;
      if (el > acc) { ex *= acc / el; ey *= acc / el; }
      F.vx += ex; F.vy += ey;
      const sp = Math.hypot(F.vx, F.vy) || 1;
      if (!last || d > 60) { const j = rnd(-1, 1) * 2400 * dt; F.vx -= F.vy / sp * j; F.vy += F.vx / sp * j; }
      P.x += F.vx * dt; P.y += F.vy * dt;
      const m = 8 + 30 * S;   // the whole fly, wing blur included, stays on the pane; it bounces off the edges
      if (F.enter) { if (inside(P.x, P.y, m)) F.enter = false; }
      else {
        if (P.x < b.x0 + m || P.x > b.x1 - m) { P.x = clamp(P.x, b.x0 + m, b.x1 - m); F.vx = (P.x < (b.x0 + b.x1) / 2 ? 1 : -1) * Math.abs(F.vx) * .6; }
        if (P.y < b.y0 + m || P.y > b.y1 - m) { P.y = clamp(P.y, b.y0 + m, b.y1 - m); F.vy = (P.y < (b.y0 + b.y1) / 2 ? 1 : -1) * Math.abs(F.vy) * .6; }
      }
      if (sp > 30) P.a += angDiff(Math.atan2(F.vy, F.vx), P.a) * Math.min(1, dt * 14);
      if (!last && d < 45) F.idx++;
      P.alt = clamp(F.alt0 + (now - F.t0) / 90, 0, 1);
      if (last) {
        P.alt = Math.min(P.alt, d / 70);
        if (d < 26 && !F.down) { F.down = true; for (const L of legs) script(L, () => L.g.rest, false); }
      }
      // Taking off from under the web or landing behind it means passing through it; flying past, only now and then.
      const crossed = (F.pa - WEBZ) * (P.alt - WEBZ) < 0;
      F.pa = P.alt;
      if (!F.torn && P.alt > .12 && world.web.catches(P.x, P.y, 2.5 + 3.5 * size)) {
        const p = crossed ? .6 : 1 - Math.exp(-sp * dt * .0006 * Math.sqrt(size));
        if (Math.random() < p) return hitWeb(now);
      }
      if (last && d < 1.5 && sp < 70) land(now);
    }
    function land(now) {
      flight = null; P.alt = 0; P.v = P.w = P.vT = P.wT = 0; landedAt = now;
      for (const L of legs) { L.mode = 'stance'; L.ank = null; setOver(L, false); L.w = toWorld(L.loc); }
      if (Math.random() < .6) groom(now, pick(SEQS), false, rnd(250, 700)); else still(now, rnd(1500, 5000));
    }

    /* ── caught ── */
    function hitWeb(now) {
      const web = world.web;
      if (size > 1.2 && Math.random() < (size - 1.15) * .9) {   // a heavy fly can go straight through
        web.tear(P.x, P.y, 6 * S, true); web.poke(P.x, P.y, 3 * size); web.event(P.x, P.y, 1, null);
        flight.torn = true; flight.vx *= .45; flight.vy *= .45;
        return world.emit('tore', self);
      }
      self.claimed = false;
      stick(now, 'stuck', [Math.random() < .7, Math.random() < .35]);
      web.poke(P.x, P.y, 2.2 * size); web.event(P.x, P.y, 1.2, self);
      world.emit('stuck', self);
    }
    function stick(now, phase, free, hold) {
      stopGroom(); flight = null; after = null; alarmAt = 0; mode = 'stuck';
      P.alt = 0; P.v = P.w = P.vT = P.wT = 0; P.headT = 0;
      depth = phase === 'stuck' ? WEBZ : depth;
      if (Math.random() < .5) free.reverse();
      prey = {
        phase, hold, onWeb: false, ax: P.x, ay: P.y, a0: P.a, ox: 0, oy: 0, jx: 0, jy: 0, jt: 0, spin: 0, int: 1, t0: now,
        bout: true, next: now + rnd(700, 1500), ev: 0, venom: 0, bitten: 0, silk: 0, roll: 0, rolling: false, tucked: false,
        wings: [rnd(28, 80), rnd(28, 80)], free, fan: [0, 0],
      };
      for (const L of legs) {
        const r = L.g.rest, sx = r[0] * rnd(1.05, 1.25), sy = r[1] * rnd(1.1, 1.35);
        if (phase === 'stuck' && Math.random() < .45) { script(L, () => [sx, sy], false); continue; }   // glued where it touched
        const ph = rnd(0, TAU), f = rnd(.018, .032), ax = rnd(1.5, 3.8), ay = rnd(1.5, 3.8);
        script(L, n => { const k = prey ? prey.int : 0; return [sx + Math.sin(n * f + ph) * ax * k, sy + Math.cos(n * f * 1.3 + ph) * ay * k]; }, false);
      }
    }
    function preyStep(now, dt) {
      const pr = prey;
      if (pr.bitten) pr.venom = approach(pr.venom, 1, dt, 1.6 * size);
      const vigor = (1 - pr.venom) * (1 - pr.silk * .9);
      if (pr.bout) {
        pr.int = approach(pr.int, vigor, dt, .08);
        if (now > pr.jt) {
          pr.jt = now + rnd(35, 110);
          const a = rnd(0, TAU), m = rnd(.3, 1) * 2.4 * size * vigor * (pr.hold ? .45 : 1);
          pr.jx = Math.cos(a) * m; pr.jy = Math.sin(a) * m; pr.spin = rnd(-1, 1) * 5 * vigor;
        }
        if (pr.phase === 'stuck' && now > pr.ev) {
          pr.ev = now + 160;
          world.web.event(P.x, P.y, .55 * vigor, self); world.web.poke(P.x, P.y, .8 * vigor * size);
        }
        if (now > pr.next) {
          pr.bout = false; pr.next = now + rnd(400, 2400) * (1 + pr.venom * 3);
          pr.jx = pr.jy = pr.spin = 0;
          if (pr.phase === 'stuck' && !pr.bitten && pr.silk < .1) {
            const chance = clamp((size - .95) * .24, 0, .14) * Math.exp(-(now - pr.t0) / 9000);
            if (Math.random() < chance) return breakFree(now);
          }
        }
      } else {
        pr.int = approach(pr.int, 0, dt, .2);
        if (now > pr.next && vigor > .04) { pr.bout = true; pr.next = now + rnd(300, 1300) * (.4 + vigor); }
      }
      if (pr.hold) { const h = pr.hold(); pr.ax = h.x; pr.ay = h.y; pr.a0 = h.a; depth = h.z; }
      pr.ox = approach(pr.ox, pr.jx, dt, .025); pr.oy = approach(pr.oy, pr.jy, dt, .025);
      // Stuck, it goes wherever its bit of the web goes, and throws the web about as it struggles.
      const d = !pr.hold && depth > .2 ? world.web.dispAt(pr.ax, pr.ay) : [0, 0];
      P.x = pr.ax + d[0] + pr.ox * .5; P.y = pr.ay + d[1] + pr.oy * .5;
      P.wT = pr.spin - angDiff(P.a, pr.a0) * (pr.hold ? 14 : 3);
      P.w = approach(P.w, P.wT, dt, .05); P.a += P.w * dt;
      if (pr.rolling) pr.roll += dt * 7;
      const fold = WING_REST - 12, glue = clamp(pr.silk * 1.4, 0, 1);
      for (let i = 0; i < 2; i++) {
        const buzz = pr.free[i] && pr.bout && pr.int > .3 && pr.silk < .3;
        const deg = buzz ? rnd(18, 100) : pr.wings[i] + (fold - pr.wings[i]) * glue;
        if (i) P.wingR = buzz ? deg : approach(P.wingR, deg, dt, .05); else P.wingL = buzz ? deg : approach(P.wingL, deg, dt, .05);
        pr.fan[i] = buzz ? .55 * pr.int : 0;
      }
      if (pr.silk > .35 && !pr.tucked) { pr.tucked = true; for (const L of legs) { const t = tuck(L.g); script(L, () => t, false); } }
      P.headT = pr.bout ? Math.sin(now * .03) * 8 * pr.int : 0;
      P.head = approach(P.head, P.headT, dt, .06);
    }
    function breakFree(now) {
      const web = world.web;
      web.tear(P.x, P.y, 7 * S, size > 1.3); web.poke(P.x, P.y, 3 * size); web.event(P.x, P.y, .8, null);
      prey = null;
      for (const L of legs) { L.mode = 'stance'; L.ank = null; setOver(L, false); }
      const a = rnd(0, TAU);
      launch(now, landing(false), [Math.cos(a), Math.sin(a)], Math.floor(rnd(1, 3)));
      flight.torn = true;
      world.emit('escaped', self);
    }
    function fallStep(dt) {
      fall.vy = Math.min(fall.vy + 900 * dt, 420); fall.vx *= 1 - dt;
      P.x += fall.vx * dt; P.y += fall.vy * dt; P.a += fall.spin * dt;
      if (P.y > world.bounds.y1 + 60) dead = true;
    }

    /* ── senses ── */
    function perceive(now) {
      if (mode === 'flight' || alarmAt) return;
      const M = world.pointer;
      if (M.on) {
        const dx = P.x - M.x, dy = P.y - M.y, d = Math.hypot(dx, dy) || 1;
        const toward = now - M.t < 100 ? (M.vx * dx + M.vy * dy) / d : 0;
        if (d < 70 || (d < 220 && toward > 450)) return takeoff(now, M.x, M.y);
        if (d < 150 && mode !== 'walk' && mode !== 'turn' && now > waryUntil) { waryUntil = now + 1200; stopGroom(); return walk(now, true); }
      }
      const T = world.threatFor(self);
      if (!T) return;
      const dx = P.x - T.x, dy = P.y - T.y, d = Math.hypot(dx, dy) || 1;
      const closing = (T.vx * dx + T.vy * dy) / d, speed = Math.hypot(T.vx, T.vy);
      const lateral = Math.sqrt(Math.max(0, speed * speed - closing * closing));
      // A fly sees movement, not shapes: what counts is how fast the spider grows and slides across its view.
      const heed = mode === 'groom' ? (seq && seq.cur === 'head' ? .25 : .5) : mode === 'walk' ? .75 : 1;
      const loom = (Math.max(0, closing) + lateral * .35) / d * heed;
      if (d < T.reach || loom > .85) { alarmAt = now + rnd(70, 190) + (mode === 'groom' ? 90 : 0); alarmFrom = [T.x, T.y]; return; }
      if (d < 130 && loom > .2 && mode !== 'walk' && mode !== 'turn' && now > waryUntil) { waryUntil = now + 1500; stopGroom(); walk(now, true, T); }
    }

    /* ── frame ── */
    function behave(now, dt) {
      if (mode === 'still') {
        if (now > nudgeUntil) P.wT = 0;
        if (now > lookUntil) P.headT = 0;
        if (now > twitchAt) twitch(now);
        if (now > until) { const f = after; after = null; f ? f(now) : decide(now); }
      } else if (mode === 'turn') {
        const d = angDiff(heading, P.a);
        P.wT = Math.sign(d) * turnRate * Math.min(1, Math.abs(d) / (25 * DEG));
        P.headT = clamp(d / DEG * .25, -8, 8);
        if (Math.abs(d) < 3 * DEG || now > until) { P.wT = P.headT = 0; const f = after; after = null; f ? f(now) : still(now); }
      } else if (mode === 'walk') {
        heading += (Math.sin(now * .0023 + seed) * .9 + Math.sin(now * .0061 + seed * 2) * .5) * dt;
        P.wT = clamp(angDiff(heading, P.a) * 5, -3, 3);
        P.vT = walkSpeed;
        P.headT = clamp(P.w / DEG * .06, -6, 6);
        const M = world.pointer, ax = P.x + Math.cos(P.a) * 45, ay = P.y + Math.sin(P.a) * 45;
        if (!inside(ax, ay, 30) || (walkSpeed < 80 && M.on && Math.hypot(ax - M.x, ay - M.y) < 150)) {
          P.vT = 0;
          return turn(now, chooseHeading(), n => Math.random() < .6 ? walk(n) : still(n));
        }
        if (now > until) {
          P.vT = 0;
          const r = Math.random();
          if (r < .45) still(now, rnd(250, 1100), n => walk(n));   // a pause, and on again
          else if (r < .75) still(now, rnd(1200, 5000)); else if (r < .87) walk(now); else groom(now, pick(SEQS));
        }
      } else if (mode === 'groom') groomStep(now);
      else if (mode === 'flight') flightStep(now, dt);
    }
    function tick(now, dt) {
      if (dead) return;
      if (mode === 'fall') return fallStep(dt);
      if (prey) { preyStep(now, dt); if (prey) stepLegs(dt, now); return; }
      if (alarmAt && now >= alarmAt) { alarmAt = 0; takeoff(now, alarmFrom[0], alarmFrom[1]); }
      perceive(now);
      behave(now, dt);
      if (prey) return;
      if (mode !== 'flight') {
        const b = world.bounds;
        P.v = approach(P.v, P.vT, dt, .05); P.w = approach(P.w, P.wT, dt, .04);
        P.a += P.w * dt;
        P.x = clamp(P.x + Math.cos(P.a) * P.v * dt, b.x0 + 20, b.x1 - 20);
        P.y = clamp(P.y + Math.sin(P.a) * P.v * dt, b.y0 + 20, b.y1 - 20);
      }
      P.head = approach(P.head, P.headT, dt, .06);
      P.sway = approach(P.sway, P.swayT, dt, .03); P.swayT = approach(P.swayT, 0, dt, .07);
      if (mode === 'flight') { const b = rnd(18, 100); P.wingL = b + rnd(-4, 4); P.wingR = b + rnd(-4, 4); }
      else {
        const base = WING_REST + (now < flickUntil ? 18 : 0), g = seq && seq.cur && GROOM[seq.cur].wing;
        P.wingL = approach(P.wingL, base + (g === 0 ? 8 : 0), dt, .035);
        P.wingR = approach(P.wingR, base + (g === 1 ? 8 : 0), dt, .035);
      }
      stepLegs(dt, now);
    }
    function render() {
      if (dead) return;
      const z = Math.max(P.alt, depth), roll = prey && prey.rolling ? .7 + .3 * Math.abs(Math.cos(prey.roll)) : 1;
      const silk = prey ? prey.silk : fall ? fall.silk : 0, hide = clamp((silk - .3) * 1.2, 0, .85);
      P.k = Sim.depthScale(z);
      el.style.transform = `translate3d(${n2(P.x - HALF)}px,${n2(P.y - HALF)}px,0)`;
      bodyG.setAttribute('transform', `rotate(${(drawn() / DEG).toFixed(3)}) scale(${n2(P.k)} ${n2(P.k * roll)})`);
      headG.setAttribute('transform', `rotate(${n2(P.head)} 6.9 0)`);
      [P.wingL, P.wingR].forEach((deg, i) => {
        const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), sg = i ? 1 : -1, fan = prey ? prey.fan[i] : P.alt;
        wingEls[i].setAttribute('transform', `matrix(${n2(-c)} ${n2(s * sg)} ${n2(s)} ${n2(c * sg)} ${ROOT[0]} ${ROOT[1] * sg})`);
        wingEls[i].style.opacity = fan || hide ? n2((1 - fan * .6) * (1 - hide)) : '';
        fanEls[i].style.opacity = n2(fan);
      });
      const flying = mode === 'flight', key = n2(z) + flying;
      if (key !== filterKey) { filterKey = key; el.style.filter = Sim.shadow(z, flying ? z * .4 : 0); }
      const snared = prey && !prey.hold ? 'inline' : 'none';
      if (snare.getAttribute('display') !== snared) snare.setAttribute('display', snared);
      const shown = Math.round(silk * strands.length);
      if (shown !== silkShown) {
        silkShown = shown;
        strands.forEach((s, i) => s.setAttribute('display', i < shown ? 'inline' : 'none'));
        shroud.setAttribute('opacity', n2(Math.min(.93, silk ** 1.6 * 1.05)));
      }
      legs.forEach(drawLeg);
    }

    const self = {
      el, size, S, kind: K === KINDS.green ? 'green' : 'house', name: K.name,
      get x() { return P.x; }, get y() { return P.y; }, get a() { return P.a; }, get mode() { return mode; },
      get plane() { return mode === 'fall' ? 'air' : prey ? (depth > .2 ? 'web' : 'glass') : P.alt > .3 ? 'air' : 'glass'; },
      get phase() { return prey ? prey.phase : null; },
      get free() { return !prey && !dead && mode !== 'fall'; },
      get caught() { return dead || mode === 'fall' || !!(prey && prey.bitten); },
      get dead() { return dead; },
      get settled() { return !prey && mode !== 'flight' && mode !== 'fall' ? world.now - landedAt : 0; },
      get silk() { return prey ? prey.silk : 0; },
      get stuckAt() { return prey ? prey.t0 : 0; },
      get loads() {
        if (!prey || depth < .2 || (prey.hold && !prey.onWeb)) return [];
        const W = Sim.Web.LOAD;
        return [{ x: prey.ax, y: prey.ay, fx: prey.ox * W * .22, fy: prey.oy * W * .22 + W * .05 * size ** 3 }];
      },
      claimed: false,
      tick, render,
      enter() {
        const b = world.bounds, right = Math.random() < .65;
        P.x = right ? b.x1 + 40 : rnd(b.x0 + (b.x1 - b.x0) * .3, b.x1 - 60);
        P.y = right ? rnd(b.y0 + 60, b.y1 - 60) : b.y1 + 40;
        const dest = landing(false), d = Math.hypot(dest[0] - P.x, dest[1] - P.y) || 1;
        P.a = Math.atan2(dest[1] - P.y, dest[0] - P.x);
        launch(world.now, dest, [(dest[0] - P.x) / d, (dest[1] - P.y) / d], Math.floor(rnd(1, 4)), true);
        P.alt = 1;
      },
      startle(x, y) { if (self.free) takeoff(world.now, x, y); },
      place(x, y, deg) {
        if (!self.free) return;
        stopGroom(); flight = null; after = null; alarmAt = 0; P.alt = 0; depth = 0;
        Object.assign(P, { x, y, a: (deg || 0) * DEG, v: 0, w: 0, vT: 0, wT: 0 });
        for (const L of legs) { L.mode = 'stance'; L.ank = null; setOver(L, false); L.loc = L.g.rest.slice(); L.w = toWorld(L.loc); }
        landedAt = world.now; still(world.now, 60000);
      },
      bite() { if (prey && !prey.bitten) { prey.bitten = world.now; world.emit('bitten', self); } },
      setSilk(v) { if (prey) prey.silk = Math.max(prey.silk, clamp(v, 0, 1)); },
      setRolling(on) { if (prey) prey.rolling = on; },
      hold(fn, onWeb) { if (!prey) return; prey.hold = fn; prey.onWeb = !!onWeb; prey.phase = prey.silk > .4 ? 'bundle' : 'held'; },
      grab(fn) { stick(world.now, 'held', [true, true], fn); prey.ax = P.x; prey.ay = P.y; },
      drop() { fall = { vx: rnd(-25, 25), vy: rnd(0, 30), spin: rnd(-2.5, 2.5), silk: prey ? prey.silk : 0 }; prey = null; mode = 'fall'; },
      remap(f) {
        const b = world.bounds;
        if (prey && !prey.hold) [prey.ax, prey.ay] = f(prey.ax, prey.ay);
        else if (!prey) {
          P.x = clamp(P.x, b.x0 + 20, b.x1 - 20); P.y = clamp(P.y, b.y0 + 20, b.y1 - 20);
          if (flight) { flight.pts = [landing(false)]; flight.idx = 0; flight.enter = false; }
        }
        for (const L of legs) L.w = toWorld(L.loc);
      },
    };
    return self;
  };
})(window.Sim);
