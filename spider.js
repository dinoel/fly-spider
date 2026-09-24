// A garden cross spider, Araneus diadematus, seen from above. It hangs head down in the hub of its web,
// runs out along the radii to whatever sets the web shaking, bites and wraps it, cuts it free and carries
// it back to feed. When it is hungry and a fly settles on the glass nearby, it lets itself down on a
// dragline and stalks it: creeping while the fly looks away, freezing while it looks, then the lunge.
(function (Sim) {
  'use strict';
  const { DEG, TAU, rnd, pick, clamp, ease, n2, angDiff, approach, sym, both } = Sim.U;
  const NS = 'http://www.w3.org/2000/svg', WEBZ = Sim.WEBZ;
  const U0 = 11 * Sim.MM / 31;        // px per body unit on the glass; the body is 31 units, a female of about 11 mm
  const BOX = 84, HALF = BOX * U0 / 2;
  const PX = U0 / 1.5;                // distances and speeds were first tuned for a spider drawn at 1.5 px per unit
  const REST_A = Math.PI / 2;         // head down, the way an orb weaver hangs in its hub
  const MOUTH = 11.4, TIP = -21;      // chelicerae and spinnerets on the body axis

  /* Body units, origin at the back of the carapace, head towards +x, the spider's right side towards +y. */
  const CARAPACE = sym(9.6, [[9.6, -1.3, 9.1, -2.3, 8.2, -2.6], [7.2, -2.9, 6, -3.2, 5, -3.7], [3.8, -4.3, 2.6, -4.7, 1.3, -4.5], [-.4, -4.2, -1.4, -2.5, -1.4, 0]]);
  const BAND = sym(8.3, [[8.3, -.9, 7.2, -1.3, 5.7, -1.1], [4.3, -.9, 3.1, -1.4, 1.9, -1.3], [.8, -1.2, -.5, -.8, -.7, 0]]);
  const GROOVES = both('M5.7-2.5Q3.9-1.5 2.2-.3M1.6-.7L3.7-3.6M1.1-.9L1.4-4.1M.6-.7L-.5-3.3') + 'M.3 0L2.4 0';
  const ABDOMEN = sym(-.4, [[-.4, -3.3, -1.9, -5.8, -4, -6.8], [-5.7, -7.7, -7.3, -8, -9.3, -7.8], [-12.2, -7.4, -15.3, -6.1, -17.3, -4.3], [-18.9, -2.9, -20.5, -1.4, -20.5, 0]]);
  const FOLIUM = sym(-2.2, [[-2.2, -1.6, -3, -3, -4.2, -3.6], [-5.2, -4.7, -6.4, -4.8, -7, -3.5], [-7.6, -4.5, -8.7, -5.3, -9.7, -4.7],
    [-10.9, -4.5, -11.7, -4.4, -12.3, -3.6], [-13, -3.9, -13.9, -3.7, -14.5, -3], [-15.2, -2.9, -16, -2.7, -16.7, -2], [-17.6, -1.5, -18.8, -.9, -19.3, 0]]);
  const HEART = sym(-2.8, [[-2.8, -1, -3.4, -2.2, -4.4, -2.5], [-5.4, -2.9, -7, -2.7, -8.2, -2.2], [-9.8, -1.8, -11, -1, -11.6, 0]]);
  const FLANKS = both('M-5.6-5.4L-7-7.9M-8.4-5.8L-9.8-8.2M-11.2-5.4L-12.6-7.6M-13.8-4.4L-15.2-6.4M-16-3.2L-17.4-4.8');
  const dots = list => list.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>` + (y ? `<ellipse cx="${x}" cy="${-y}" rx="${rx}" ry="${ry}"/>` : '')).join('');
  // The cross the species is named for: a line of white spots down the back, a bar across it.
  const CROSS = dots([[-2.9, 0, .55, .45], [-4.1, 0, .62, .5], [-5.5, 0, .78, .62], [-6.9, 0, .64, .52], [-8.2, 0, .56, .46], [-9.4, 0, .46, .38],
    [-5.6, 1.45, .62, .46], [-5.75, 2.7, .56, .42], [-5.95, 3.7, .42, .34]]);
  const PALE = dots([[-10.8, 3.7, .4, .32], [-12.9, 3.1, .35, .28], [-15, 2.4, .3, .25], [-3.5, 4.5, .5, .36], [-4.5, 5.7, .36, .28], [-17.2, 1.4, .26, .22]]);
  const SIGILLA = dots([[-7.8, 1.1, .32, .22], [-10, .95, .3, .2], [-12.1, .75, .26, .18]]);
  const hairs = (n, cx, rx, ry, dir, len) => {
    let d = '';
    for (let k = 0; k < n; k++) {
      const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * .96, x = cx + Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
      const [ux, uy] = dir(x, y), ul = Math.hypot(ux, uy), l = rnd(len * .7, len * 1.3);
      d += `M${n2(x)} ${n2(y)}l${n2(ux / ul * l)} ${n2(uy / ul * l)}`;
    }
    return d;
  };

  Sim.spiderDefs = `
    <radialGradient id="spCarapace" cx=".6" cy=".5" r=".62"><stop offset="0" stop-color="#b98e5a"/><stop offset=".55" stop-color="#8e6538"/><stop offset="1" stop-color="#4f341a"/></radialGradient>
    <radialGradient id="spAbdomen" gradientUnits="userSpaceOnUse" cx="-8" cy="-2.2" r="13.5"><stop offset="0" stop-color="#d5ab6f"/><stop offset=".4" stop-color="#ae7c44"/><stop offset=".78" stop-color="#7c4f27"/><stop offset="1" stop-color="#4b2e15"/></radialGradient>
    <linearGradient id="spFolium" gradientUnits="userSpaceOnUse" x1="-2" y1="0" x2="-19" y2="0"><stop offset="0" stop-color="#5a3216"/><stop offset=".5" stop-color="#6d3e1b"/><stop offset="1" stop-color="#40230e"/></linearGradient>
    <radialGradient id="spSheen" gradientUnits="userSpaceOnUse" cx="-7.5" cy="-3" r="5"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="spChel" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#7d4c26"/><stop offset="1" stop-color="#2a160a"/></radialGradient>
    <clipPath id="spAbdClip"><path d="${ABDOMEN}"/></clipPath>`;

  /* Legs, left side: hip at the edge of the carapace, resting foot, femur, patella with tibia, metatarsus with tarsus,
     their widths, the side the knee bulges to, and how steeply the metatarsus comes down to the thread.
     Leg I is the longest, III the shortest, as in Araneus. */
  const LEFT = [
    { hip: [5.9, -3.5], rest: [31, -13], len: [10.5, 11.5, 12], w: [2, 1.62, 1.05], bend: -1, tilt: 30 * DEG },
    { hip: [4.3, -4.1], rest: [20, -24], len: [10, 10.5, 11], w: [1.95, 1.58, 1.02], bend: -1, tilt: 34 * DEG },
    { hip: [2.5, -4.3], rest: [-2, -18.5], len: [6.8, 6.8, 7.2], w: [1.8, 1.45, .95], bend: 1, tilt: 46 * DEG },
    { hip: [.6, -3.9], rest: [-20.5, -12.5], len: [9.5, 10.5, 11], w: [1.95, 1.58, 1.02], bend: 1, tilt: 36 * DEG },
  ];
  const LEGS = [...LEFT, ...LEFT.map(l => ({ ...l, hip: [l.hip[0], -l.hip[1]], rest: [l.rest[0], -l.rest[1]], bend: -l.bend }))];
  const HIP_Z = 2.4, LIFT = 3.2;      // how high the coxae ride above the threads, and a stepping foot rises
  const FLAT = 6 * DEG;               // the metatarsus can lie almost flat along the thread when the leg is stretched
  // How far from the hip a foot can be, the leg straight and the metatarsus flat. No foot is set down beyond most of it,
  // and a leg whose foot has been left that far behind steps whatever the others are doing.
  LEGS.forEach(g => { const [l1, l2, l3] = g.len, z = l3 * Math.sin(FLAT) - HIP_Z; g.reach = Math.sqrt((l1 + l2 - .05) ** 2 - z * z) + l3 * Math.cos(FLAT); });
  const GAIT = [[0, 5, 2, 7], [4, 1, 6, 3]];   // alternating tetrapods: L1 R2 L3 R4, then R1 L2 R3 L4
  const PALPS = [{ hip: [8.6, -1.9], rest: [13.6, -3.3], len: [2.6, 3], w: [.85, .72], bend: -1 }, { hip: [8.6, 1.9], rest: [13.6, 3.3], len: [2.6, 3], w: [.85, .72], bend: 1 }];

  const ik = (hx, hy, fx, fy, l1, l2, bend) => {
    const e = Math.hypot(fx - hx, fy - hy) || 1, vx = (fx - hx) / e, vy = (fy - hy) / e;
    const reach = clamp(e, Math.abs(l1 - l2) + .3, l1 + l2 - .05);
    const along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, l1 * l1 - along * along)) * bend;
    return [hx + vx * along - vy * h, hy + vy * along + vx * h, hx + vx * reach, hy + vy * reach];
  };

  Sim.makeSpider = function (world) {
    const el = document.createElement('div');
    el.className = 'spider';
    el.style.width = el.style.height = `${BOX * U0}px`;
    el.innerHTML = `<svg viewBox="${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}" focusable="false" shape-rendering="geometricPrecision">
    <g class="sp-body">
      <g class="sp-legs"></g>
      <g class="sp-palps"></g>
      <g fill="url(#spChel)"><ellipse cx="10.3" cy="-.95" rx="1.55" ry="1.05" transform="rotate(-10 10.3 -.95)"/><ellipse cx="10.3" cy=".95" rx="1.55" ry="1.05" transform="rotate(10 10.3 .95)"/></g>
      <g fill="#fff" fill-opacity=".28"><ellipse cx="10.5" cy="-1.2" rx=".6" ry=".25"/><ellipse cx="10.5" cy=".7" rx=".6" ry=".25"/></g>
      <path d="${CARAPACE}" fill="url(#spCarapace)" stroke="#3a2412" stroke-opacity=".8" stroke-width=".5"/>
      <path d="${BAND}" fill="#583618" fill-opacity=".55"/>
      <path d="${GROOVES}" fill="none" stroke="#3a2210" stroke-opacity=".55" stroke-width=".4" stroke-linecap="round"/>
      <path d="${hairs(46, 4, 5, 3.6, (x, y) => [1, y * .3], .85)}" stroke="#f0e2c4" stroke-opacity=".4" stroke-width=".17" stroke-linecap="round"/>
      <ellipse cx="8.3" cy="0" rx="1.35" ry="1.3" fill="#2c1a0d" fill-opacity=".8"/>
      <g fill="#0c0806">${dots([[8.85, .6, .46, .46], [7.8, .62, .42, .42], [8.25, 2.15, .31, .3], [7.85, 2.42, .31, .3]])}</g>
      <g fill="#fff" fill-opacity=".85">${dots([[8.98, .45, .14, .14], [7.92, .47, .13, .13], [8.35, 2.03, .09, .09], [7.95, 2.3, .09, .09]])}</g>
      <path d="${ABDOMEN}" fill="url(#spAbdomen)"/>
      <g clip-path="url(#spAbdClip)">
        <path d="${ABDOMEN}" fill="none" stroke="#462810" stroke-opacity=".5" stroke-width="3.4"/>
        <path d="${FLANKS}" fill="none" stroke="#3d220d" stroke-opacity=".5" stroke-width=".75" stroke-linecap="round"/>
        <g fill="#e7c996" fill-opacity=".5"><ellipse cx="-3.8" cy="-5.3" rx="1.6" ry="1"/><ellipse cx="-3.8" cy="5.3" rx="1.6" ry="1"/></g>
      </g>
      <path d="${FOLIUM}" fill="url(#spFolium)" stroke="#ecd6ad" stroke-opacity=".6" stroke-width=".38"/>
      <path d="${HEART}" fill="#a0703e" fill-opacity=".55"/>
      <g fill="#f6eedb" fill-opacity=".93">${CROSS}</g>
      <g fill="#ecd9b2" fill-opacity=".7">${PALE}</g>
      <g fill="#2b1608" fill-opacity=".45">${SIGILLA}</g>
      <path d="${hairs(160, -10.3, 9.8, 7.3, (x, y) => [-1, y * .15], 1.05)}" stroke="#efdfbf" stroke-opacity=".3" stroke-width=".16" stroke-linecap="round"/>
      <ellipse cx="-7.5" cy="-3" rx="5" ry="2.3" fill="url(#spSheen)"/>
      <ellipse cx="-20.6" cy="0" rx=".95" ry=".75" fill="#34200f"/>
    </g></svg>`;
    const bodyG = el.querySelector('.sp-body'), legG = el.querySelector('.sp-legs'), palpG = el.querySelector('.sp-palps');

    /* Each segment is drawn as spines, hair, the pale cuticle, a dark ring towards its far end, and a glint. */
    const layer = (parent, color, width, attrs) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', width);
      for (const k in attrs) p.setAttribute(k, attrs[k]);
      parent.appendChild(p);
      return p;
    };
    const limb = (parent, w) => w.map(wd => [
      layer(parent, '#1c1007', n2(wd * 1.7 + 1.2), { 'stroke-opacity': .6, 'stroke-dasharray': '.012 .1 .01 .14' }),
      layer(parent, '#1f1208', n2(wd + 1.2), { 'stroke-opacity': .45, 'stroke-dasharray': '.02 .028' }),
      layer(parent, '#aa7b48', n2(wd), { 'stroke-linecap': 'round' }),
      layer(parent, '#3d2412', n2(wd + .06), { 'stroke-dasharray': '0 .64 .28 .08' }),
      layer(parent, '#f2d8ab', n2(wd * .3), { 'stroke-opacity': .3, 'stroke-linecap': 'round' }),
    ]).map((layers, k) => {
      if (!k) return layers;   // the joint where this segment starts: a darker knuckle, the patella on a leg
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', n2(w[k - 1] * .58)); c.setAttribute('fill', '#4a2c14');
      parent.appendChild(c);
      return [...layers, c];
    });
    // No two spiders, and no two sides of one, hold their legs quite alike.
    const legs = LEGS.map(g0 => ({ ...g0, rest: [g0.rest[0] + rnd(-1.5, 1.5), g0.rest[1] + rnd(-1.5, 1.5)] })).map((g, i) => ({ i, g, mode: 'stance', w: [0, 0], loc: g.rest.slice(), land: g.rest.slice(), settled: false, z: 0, zFrom: 0, lift: 1, base: null, hold: null, aim: null, from: null, t: 0, dur: .1, fn: null, t0: 0, sFrom: null, until: 0 }));
    [3, 7, 2, 6, 1, 5, 0, 4].forEach(i => { legs[i].segs = limb(legG, LEGS[i].w); });   // hind legs first, so the front ones lie over them
    const palps = PALPS.map(g => ({ g, segs: limb(palpG, g.w) }));

    const P = { x: 0, y: 0, a: REST_A, v: 0, w: 0, vT: 0, wT: 0, z: WEBZ, lunge: 0, lungeT: 0, vx: 0, vy: 0 };
    const O = { x: 0, y: 0 };         // where the body is drawn: its place, the web's give under it, and a lunge
    let sc = U0 * Sim.depthScale(WEBZ);
    let state = 'rest', until = 0, after = null, target = null, prey = null, steps = null, cache = [];
    let path = [], pathSpeed = 0, arrive = null, turnTo = REST_A, glide = null, airborne = false;
    let hunger = .6, anchor = null, stalk = null, band = null, repairAt = null, nextShift = 0, twist = 0, twistT = 0, twistAt = 0;
    let huntCheck = 0, repairCheck = 0, pluckAt = 0, fidgetAt = 0, lastEvent = 0, lastTet = 1, stillFor = 0, grip = false, filterKey = '';
    let palpAmp = 0, palpAt = 0, palpUntil = 0, palpSide = 0;
    const give = { x: 0, y: 0 }, acc = { x: 0, y: 0, vx: 0, vy: 0 };   // how far the web has let the body down; its acceleration

    const web = () => world.web;
    const toWorld = l => { const c = Math.cos(P.a), s = Math.sin(P.a); return [O.x + (l[0] * c - l[1] * s) * sc, O.y + (l[0] * s + l[1] * c) * sc]; };
    const toLocal = w => { const c = Math.cos(P.a), s = Math.sin(P.a), dx = (w[0] - O.x) / sc, dy = (w[1] - O.y) / sc; return [dx * c + dy * s, dy * c - dx * s]; };
    const onWeb = () => P.z > .2 && !airborne;
    const webPos = b => { const d = web().dispAt(b[0], b[1]); return [b[0] + d[0], b[1] + d[1]]; };
    const strain = L => Math.hypot(L.loc[0] - L.land[0], L.loc[1] - L.land[1]);   // how far the foot has been dragged since it took hold
    const off = L => Math.hypot(L.loc[0] - L.g.rest[0], L.loc[1] - L.g.rest[1]);      // how far it is from where the leg would have it
    const spread = L => Math.hypot(L.loc[0] - L.g.hip[0], L.loc[1] - L.g.hip[1]) / L.g.reach;   // 1: stretched as far as it goes
    const hang = g => [g.hip[0] + (g.rest[0] - g.hip[0]) * .6, g.hip[1] + (g.rest[1] - g.hip[1]) * .6, 2];
    const mouthHold = f => () => {
      const c = Math.cos(P.a), s = Math.sin(P.a), d = (MOUTH + .6) * sc + 5.2 * f.S;
      return { x: O.x + c * d, y: O.y + s * d, a: P.a + Math.PI / 2 + twist, z: P.z };
    };

    /* ── legs ── on the web every foot takes hold of a thread; on the glass it goes where it lands */
    function lead(r) {
      const mx = P.v / sc - P.w * r[1], my = P.w * r[0], m = Math.hypot(mx, my);
      if (m < .5) return [0, 0];
      const t = Math.min(.25, 7 / m);
      return [mx * t, my * t];
    }
    // A foot can wait before it lifts: within a set of four the hind legs go first and the wave runs forwards,
    // so the legs of a walking spider never move quite together.
    function swing(L, jit, dur, delay) {
      L.mode = 'swing'; L.dur = dur; L.t = -(delay || 0) / dur; L.from = L.w.slice(); L.hold = L.base; L.base = null;
      L.lift = rnd(.7, 1.1);
      const r = L.g.rest, ld = lead(r);
      const [hx, hy] = L.g.hip, max = L.g.reach * .82;
      let ax = r[0] + ld[0] + jit[0], ay = r[1] + ld[1] + jit[1], ad = Math.hypot(ax - hx, ay - hy);
      if (ad > max) { ax = hx + (ax - hx) * max / ad; ay = hy + (ay - hy) * max / ad; }
      L.aim = [ax, ay];
      if (onWeb()) {
        // On the glass a foot comes down wherever the leg has carried it; on the web it has to make for a thread,
        // chosen now, where the aim will be by the time the foot arrives: ahead of the body that is still moving on.
        const T = (delay || 0) + dur * .8, turn = P.w * T, c = Math.cos(turn), sn = Math.sin(turn), ahead = P.v * T / sc;
        const aw = toWorld([ax * c - ay * sn + ahead, ax * sn + ay * c]), hit = web().nearest(aw[0], aw[1], 7 * sc, false);
        if (hit) {
          const hl = toLocal([hit.x, hit.y]), fx = hl[0] - ahead, fy = hl[1];
          if (Math.hypot(fx * c + fy * sn - hx, fy * c - fx * sn - hy) < L.g.reach * .92) L.base = [hit.x, hit.y];
        }
      }
    }
    function script(L, fn, ms) { L.mode = 'script'; L.fn = fn; L.t0 = world.now; L.sFrom = L.loc.slice(); L.zFrom = L.z; L.until = ms ? world.now + ms : 0; }
    function release(L, delay) { if (L.mode !== 'script') return; L.w = toWorld(L.loc); swing(L, [0, 0], .16, delay); }
    function plant() { for (const L of legs) { L.mode === 'script' ? release(L, rnd(0, .12)) : swing(L, [rnd(-.5, .5), rnd(-.5, .5)], rnd(.12, .18), rnd(0, .12)); } }
    function stepLegs(dt, now) {
      for (const L of legs) {
        if (L.mode === 'stance') { if (L.base) L.w = webPos(L.base); L.loc = toLocal(L.w); }
        else if (L.mode === 'swing') {
          L.t = Math.min(1, L.t + dt / L.dur);
          if (L.t <= 0) { if (L.hold) L.from = webPos(L.hold); L.loc = toLocal(L.from); continue; }   // still holding its old thread
          const tw = L.base ? webPos(L.base) : toWorld(L.aim), e = ease(L.t);
          L.w = [L.from[0] + (tw[0] - L.from[0]) * e, L.from[1] + (tw[1] - L.from[1]) * e];
          L.loc = toLocal(L.w);
          if (L.t >= 1) { L.mode = 'stance'; L.z = 0; L.land = L.loc.slice(); if (L.base && onWeb()) web().poke(L.base[0], L.base[1], .18); }
        } else {
          if (L.until && now > L.until) { L.until = 0; release(L); continue; }
          const p = L.fn(now), b = ease(Math.min(1, (now - L.t0) / 220));
          L.loc = [L.sFrom[0] + (p[0] - L.sFrom[0]) * b, L.sFrom[1] + (p[1] - L.sFrom[1]) * b];
          L.z = L.zFrom + ((p[2] || 0) - L.zFrom) * b;
        }
      }
      if (airborne) return;
      // Four feet stay down while the other four step, unless one of them has been left so far behind it must go now.
      if (legs.some(L => L.mode === 'swing') && !legs.some(L => L.mode === 'stance' && spread(L) > 1)) return;
      const vu = Math.abs(P.v) / sc, moving = vu > 3 || Math.abs(P.w) > .15;
      stillFor = moving ? 0 : stillFor + dt;
      if (moving) legs.forEach(L => { L.settled = false; });
      // Walking, a set steps once its feet have been dragged back far enough. Just after it stops, each leg that was
      // left awkwardly may reset itself once, onto whatever thread it finds. After that a resting spider keeps every
      // foot where it took hold and goes with the web however it sways, unless a leg is wrenched right out of place.
      const settling = !moving && stillFor > .15 && stillFor < 1.5;
      const due = L => L.mode === 'stance' && (moving ? strain(L) > clamp(3.4 + vu * .02, 3.4, 7.5) || spread(L) > .93 :
        settling ? !L.settled && off(L) > 2.2 : stillFor >= 1.5 && (strain(L) > 6.5 || spread(L) > .99));
      for (const tp of [1 - lastTet, lastTet]) {
        const set = GAIT[tp].filter(i => legs[i].mode === 'stance');
        if (!set.some(i => due(legs[i]))) continue;
        lastTet = tp;
        const dur = clamp(.17 - vu * .0007 - Math.abs(P.w) * .012, .06, .17);
        for (const i of set) {
          if (!moving && !due(legs[i])) continue;
          if (settling) legs[i].settled = true;
          const wave = (3 - i % 4) * dur * rnd(.12, .2) * clamp(1.2 - vu / 90, .25, 1);   // at a run the wave closes up
          swing(legs[i], [rnd(-.5, .5), rnd(-.5, .5)], dur * rnd(.9, 1.1), wave + (moving ? 0 : rnd(0, .25)));
        }
        return;
      }
    }
    function setSegs(segs, pts) {
      segs.forEach((layers, k) => {
        const d = `M${n2(pts[k][0])} ${n2(pts[k][1])}L${n2(pts[k + 1][0])} ${n2(pts[k + 1][1])}`;
        for (const p of layers) if (p.tagName === 'path') p.setAttribute('d', d);
        const knob = layers[layers.length - 1];
        if (knob.tagName === 'circle') { knob.setAttribute('cx', n2(pts[k][0])); knob.setAttribute('cy', n2(pts[k][1])); }
      });
    }
    /* A leg is solved upright, in the plane through the hip and the foot, and then seen from above: the femur climbs
       from the body to the knee, the highest point, and the rest comes down to the thread. From above the leg looks
       nearly straight, the femur foreshortened the more the leg is drawn in, the knee bowed a little outwards. */
    function legPts(g, fx, fy, fz) {
      const [hx, hy] = g.hip, [l1, l2, l3] = g.len;
      const D = Math.hypot(fx - hx, fy - hy) || 1, ux = (fx - hx) / D, uy = (fy - hy) / D, nx = -uy * g.bend, ny = ux * g.bend;
      // Stretched, the metatarsus comes down flatter and flatter before the leg runs out of length.
      let tilt = g.tilt + clamp(fz, 0, LIFT) * .06, ex, ez, e;
      for (let k = 0; ; k++) {
        ex = D - l3 * Math.cos(tilt); ez = fz + l3 * Math.sin(tilt) - HIP_Z; e = Math.hypot(ex, ez) || 1;
        if (e <= l1 + l2 - .05 || tilt <= FLAT || k > 10) break;
        tilt = Math.max(FLAT, tilt - 4 * DEG);
      }
      const vx = ex / e, vz = ez / e;
      const reach = clamp(e, Math.abs(l1 - l2) + .3, l1 + l2 - .05);
      const along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      const kd = vx * along - vz * h, ad = vx * reach, fd = ad + l3 * Math.cos(tilt);
      const bow = 1 + h * .3, at = (d, b) => [hx + ux * d + nx * b, hy + uy * d + ny * b];
      return [[hx, hy], at(kd, bow), at(ad, bow * .45), at(Math.min(fd, D + .5), 0)];
    }
    function pose2(segs, hip, len, bend, fx, fy) {
      const [kx, ky] = ik(hip[0], hip[1], fx, fy, len[0], len[1], bend);
      setSegs(segs, [hip, [kx, ky], [fx, fy]]);
    }
    function drawLeg(L) {
      let [fx, fy] = L.loc, fz = L.mode === 'script' ? L.z : 0;
      if (L.mode === 'swing' && L.t > 0) {
        const k = Math.sin(Math.PI * L.t), [hx, hy] = L.g.hip;
        fz = k * LIFT * L.lift; fx += (hx - fx) * k * .05; fy += (hy - fy) * k * .05;
      }
      setSegs(L.segs, legPts(L.g, fx, fy, fz));
    }

    /* ── moving ── along a path, or gliding into an exact place and heading */
    function goTo(pts, speed, then) { path = pts.map(p => p.slice()); pathSpeed = speed; arrive = then; glide = null; }
    function stop() { path = []; arrive = null; glide = null; P.vT = 0; }
    function glideTo(x, y, a, z, ms, then) {
      path = [];
      glide = { x0: P.x, y0: P.y, a0: P.a, z0: P.z, x1: x, y1: y, a1: P.a + angDiff(a, P.a), z1: z, t0: world.now, ms, then };
    }
    function steer(now, dt) {
      if (glide) {
        const G = glide, e = ease(clamp((now - G.t0) / G.ms, 0, 1)), px = P.x, py = P.y, pa = P.a;
        P.x = G.x0 + (G.x1 - G.x0) * e; P.y = G.y0 + (G.y1 - G.y0) * e; P.a = G.a0 + (G.a1 - G.a0) * e; P.z = G.z0 + (G.z1 - G.z0) * e;
        P.v = P.vT = ((P.x - px) * Math.cos(P.a) + (P.y - py) * Math.sin(P.a)) / dt; P.w = P.wT = (P.a - pa) / dt;
        if (now - G.t0 >= G.ms) { glide = null; P.v = P.w = P.vT = P.wT = 0; if (G.then) G.then(now); }
        return;
      }
      if (state === 'lunge') return;
      if (path.length) {
        const [tx, ty] = path[0], dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy), last = path.length === 1;
        if (d < (last ? 2 : 10)) {
          path.shift();
          if (!path.length) { P.vT = 0; const f = arrive; arrive = null; if (f) f(now); }
        } else {
          const diff = angDiff(Math.atan2(dy, dx), P.a);
          P.wT = clamp(diff * 8, -7, 7);
          P.vT = pathSpeed * Math.max(0, Math.cos(diff)) ** 3 * (last ? clamp(d / 22, .15, 1) : 1);
        }
      } else {
        P.vT = 0;
        P.wT = turnTo === null ? 0 : clamp(angDiff(turnTo, P.a) * 6, -5, 5);
      }
      if (glide) return;
      P.v = approach(P.v, P.vT, dt, .07); P.w = approach(P.w, P.wT, dt, .05);
      P.a += P.w * dt; P.x += Math.cos(P.a) * P.v * dt; P.y += Math.sin(P.a) * P.v * dt;
    }
    function webPath(tx, ty, reach) {
      const W = web(), [hx, hy] = W.hub, pts = [];
      const rS = Math.hypot(P.x - hx, P.y - hy), rT = Math.hypot(tx - hx, ty - hy);
      if (rS > W.R * .3 && rT > W.R * .3 && Math.abs(angDiff(Math.atan2(ty - hy, tx - hx), Math.atan2(P.y - hy, P.x - hx))) > 55 * DEG) pts.push([hx, hy]);
      const from = pts.length ? pts[0] : [P.x, P.y], d = Math.hypot(tx - from[0], ty - from[1]) || 1;
      pts.push([tx - (tx - from[0]) / d * reach, ty - (ty - from[1]) / d * reach]);
      return pts;
    }

    /* ── sequences ── a list of timed steps, used for everything done at the prey */
    function run(now, list, done) { steps = { list, i: -1, t0: now, done }; state = 'seq'; next(now); }
    function next(now) {
      steps.i++;
      const s = steps.list[steps.i];
      if (!s) { const d = steps.done; steps = null; return d(now); }
      steps.t0 = now;
      if (s.start) s.start(now);
    }
    function seqStep(now) {
      if (prey && prey.phase === null) { steps = null; band = null; P.lungeT = 0; grip = false; prey = null; return home(now); }   // it tore free
      const s = steps.list[steps.i], p = Math.min(1, (now - steps.t0) / s.ms);
      if (s.step) s.step(now, p);
      if (p >= 1 && !glide) { if (s.end) s.end(now); next(now); }
    }
    const bite = f => ({
      ms: 1100,
      start() { f.bite(); P.lungeT = 1.6; grip = true; web().poke(f.x, f.y, 1.2); },
      step(now, p) { if (p > .3) P.lungeT = .7; },
      end() { P.lungeT = 0; grip = false; },
    });
    const faceAway = f => ({
      ms: 800,
      start() { const a = Math.atan2(P.y - f.y, P.x - f.x), d = -TIP * sc + 3.5 * f.S; glideTo(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, a, P.z, 800); },
    });
    const faceTo = f => ({
      ms: 750,
      start() { const a = Math.atan2(f.y - P.y, f.x - P.x), d = MOUTH * sc + 4 * f.S; glideTo(f.x - Math.cos(a) * d, f.y - Math.sin(a) * d, a, P.z, 750); },
    });
    // Back to the prey, legs IV draw silk from the spinnerets in turn and lay it on while the prey is turned over.
    const wrap = (f, ms) => ({
      ms,
      start(now) {
        f.setRolling(true); band = f;
        const px = toLocal([f.x, f.y])[0];
        [3, 7].forEach((i, k) => script(legs[i], n => {
          const s = i === 3 ? -1 : 1, ph = ((n - now) / 430 + k * .5) % 1, u = ph < .6 ? ease(ph / .6) : 1 - ease((ph - .6) / .4);
          return [TIP + 1 + (px - 3 - TIP - 1) * u, s * (3.8 - 2.2 * u)];
        }));
      },
      step(now, p) { f.setSilk(p); if (Math.random() < .04) web().poke(f.x, f.y, .5); },
      end() { f.setRolling(false); band = null; release(legs[3]); release(legs[7]); },
    });
    const cut = f => ({
      ms: 900,
      start() { web().tear(f.x, f.y, 4.5 * f.S + 3, false); f.hold(mouthHold(f), false); web().poke(f.x, f.y, 1.5); grip = true; },
      end() { grip = false; },
    });

    /* ── behaviour ── */
    function stuckFly(now) {
      let best = null, bd = Infinity;
      for (const f of world.flies) {
        if (f.phase !== 'stuck' || f.claimed || now - f.stuckAt < 250) continue;
        const d = Math.hypot(f.x - P.x, f.y - P.y);
        if (d < bd) { bd = d; best = f; }
      }
      return best;
    }
    function tug(now) {
      const evs = web().events;
      let best = null;
      for (const e of evs) if (!e.fly && e.t > lastEvent && now - e.t < 800 && e.amp >= .5 && (!best || e.amp > best.amp)) best = e;
      if (evs.length) lastEvent = evs[evs.length - 1].t;
      return best;
    }
    function respond(now, clicks) {
      const f = stuckFly(now);
      if (f) { orient(now, f); return true; }
      const e = clicks && tug(now);
      if (e) { orient(now, null, e); return true; }
      return false;
    }
    function orient(now, f, e) {
      stop(); unhug(); band = null; repairAt = null; state = 'orient';
      target = f ? { fly: f } : { x: e.x, y: e.y };
      if (f) f.claimed = true;
      turnTo = Math.atan2((f ? f.y : e.y) - P.y, (f ? f.x : e.x) - P.x);
      until = now + rnd(250, 550);
      pluck(now, Math.random() < .5 ? 0 : 4);
    }
    function rush(now) {
      const f = target.fly;
      state = 'rush'; turnTo = null;
      goTo(webPath(f ? f.x : target.x, f ? f.y : target.y, f ? MOUTH * sc + 4 * f.S : 4), (f ? 200 : 160) * PX, n => f ? attack(n) : search(n));
    }
    function search(now) {
      state = 'wait'; turnTo = P.a + rnd(-1, 1); until = now + rnd(1200, 2200); after = home;
      pluck(now, Math.random() < .5 ? 0 : 4);
    }
    function attack(now) {
      const f = prey = target.fly;
      if (f.phase !== 'stuck') { prey = null; return home(now); }
      const big = f.size >= 1.1, list = [];
      if (!big) list.push(bite(f));
      list.push(faceAway(f), wrap(f, big ? 3800 : 2400), faceTo(f));
      if (big) list.push(bite(f));
      list.push(cut(f));
      run(now, list, carry);
    }
    function carry(now) {
      const [hx, hy] = web().hub;
      state = 'carry'; turnTo = null;
      goTo(webPath(hx, hy, 0), 85 * PX, n => settle(n, feed));
    }
    function settle(now, then) {
      const [hx, hy] = web().hub;
      state = 'settle';
      glideTo(hx, hy, REST_A + rnd(-.15, .15), WEBZ, 900, then);
    }
    function home(now) {
      const [hx, hy] = web().hub;
      state = 'home'; turnTo = null;
      goTo(webPath(hx, hy, 0), 95 * PX, n => settle(n, rest0));
    }
    function rest0() {
      if (prey) return feed(world.now);
      unhug(); state = 'rest'; turnTo = REST_A;
      pluckAt = Math.max(pluckAt, world.now + rnd(6000, 15000)); fidgetAt = Math.max(fidgetAt, world.now + rnd(8000, 20000));
    }
    function feed(now) {
      state = 'feed'; turnTo = REST_A;
      until = now + rnd(15000, 25000) * prey.size; twistAt = now + rnd(5000, 12000);
      hug(prey);
    }
    // Feeding, it holds still: legs I cradle the bundle against the chelicerae, the other six keep their threads.
    function hug(f) {
      [0, 4].forEach((i, k) => {
        const s = k ? 1 : -1, j = rnd(-.4, .4);
        script(legs[i], () => {
          const cx = MOUTH + .6 + 5.2 * f.S / sc, r = 4.4 * f.S / sc + .9, a = twist * .7, ox = 1.2 + j, oy = s * r;
          return [cx + ox * Math.cos(a) - oy * Math.sin(a), ox * Math.sin(a) + oy * Math.cos(a), 3];
        });
      });
    }
    function unhug() { release(legs[0], 0); release(legs[4], .08); }
    function feedStep(now, dt) {
      hunger = Math.max(0, hunger - dt * .012);
      if (now > twistAt) { twistAt = now + rnd(6000, 14000); twistT = clamp(twistT + rnd(-.45, .45), -.6, .6); }   // now and then it turns the bundle
      const f = stuckFly(now);
      if (f) {   // leave this one hanging in the hub and fetch the new one
        const at = mouthHold(prey)();
        prey.hold(() => { const d = web().dispAt(at.x, at.y); return { x: at.x + d[0], y: at.y + d[1], a: at.a, z: at.z }; }, true);
        cache.push(prey); prey = null;
        return orient(now, f);
      }
      if (now > until) { prey.drop(); world.emit('discard', prey); prey = null; rest0(); }
    }
    function rest(now) {
      turnTo = REST_A;
      if (respond(now, true)) return;
      while (cache.length > 2) { const old = cache.shift(); old.drop(); world.emit('discard', old); }
      if (cache.length) { prey = cache.shift(); prey.hold(mouthHold(prey), false); return feed(now); }
      if (now > repairCheck) {
        repairCheck = now + rnd(3000, 7000);
        const hole = web().hole();
        if (hole && Math.random() < .5) return goRepair(now, hole);
      }
      if (now > huntCheck) {
        huntCheck = now + 700;
        const f = huntable();
        if (f && Math.random() < .07) { huntCheck = now + rnd(25000, 50000); return drop(now, f); }   // and a while before it tries again
      }
      // In the hub it sits for minutes without a twitch; once in a long while it tries a radius or shifts a foot.
      if (now > pluckAt) { pluckAt = now + rnd(20000, 60000); if (Math.random() < .6) pluck(now, Math.random() < .5 ? 0 : 4); }
      if (now > fidgetAt) { fidgetAt = now + rnd(15000, 45000); const L = pick(legs); if (L.mode === 'stance') swing(L, [rnd(-.6, .6), rnd(-.6, .6)], .2); }
      if (now > palpAt) { palpAt = now + rnd(7000, 22000); palpSide = Math.random() < .5 ? 0 : 1; palpUntil = now + 450; }
    }
    // It tugs a radius with a front leg and feels what comes back.
    function pluck(now, i) {
      const L = legs[i];
      if (L.mode !== 'stance') return;
      const b = L.loc.slice(), dx = L.g.hip[0] - b[0], dy = L.g.hip[1] - b[1], dl = Math.hypot(dx, dy) || 1, t0 = now;
      script(L, n => { const k = Math.sin(clamp((n - t0) / 520, 0, 1) * Math.PI * 2) ** 2 * 2.2; return [b[0] + dx / dl * k, b[1] + dy / dl * k]; }, 520);
      if (onWeb()) { const w = toWorld(b); web().poke(w[0], w[1], .7); }
    }
    function goRepair(now, hole) {
      state = 'repair-go'; turnTo = null; repairAt = hole;
      goTo(webPath(hole[0], hole[1], 0), 70 * PX, n => { state = 'repair'; until = n + rnd(4500, 7000); nextShift = n; });
    }
    function repairStep(now, dt) {
      if (respond(now, false)) return;
      web().repair(repairAt[0], repairAt[1], 30, dt);
      if (now > nextShift && !glide) { nextShift = now + rnd(500, 1000); glideTo(repairAt[0] + rnd(-10, 10) * PX, repairAt[1] + rnd(-10, 10) * PX, P.a + rnd(-.6, .6), P.z, 450); }
      if (now > until) { repairAt = null; home(now); }
    }

    /* ── on the glass ── */
    function huntable() {
      if (hunger < .15 || prey || cache.length) return null;
      const [hx, hy] = web().hub, R = web().R;
      let best = null, bd = Infinity;
      for (const f of world.flies) {
        if (!f.free || f.plane !== 'glass' || f.settled < 4000) continue;
        const d = Math.hypot(f.x - hx, f.y - hy);
        if (d < R * 1.6 && d < bd) { bd = d; best = f; }
      }
      return best;
    }
    function drop(now, f) {
      stop(); state = 'drop'; target = { fly: f }; anchor = [P.x, P.y];
      airborne = true; legs.forEach(L => script(L, () => hang(L.g)));
      glideTo(P.x, P.y, Math.atan2(f.y - P.y, f.x - P.x), 0, 1100, n => {
        airborne = false; plant();
        stalk = { t0: n, creep: 0, freeze: n + rnd(300, 800) }; state = 'stalk';
      });
      world.emit('drop', f);
    }
    function stalkStep(now) {
      const f = target.fly;
      if (stuckFly(now) || f.phase === 'stuck') return climbBack(now, true);
      if (!f.free || f.plane !== 'glass') return giveUp(now, f.mode === 'flight');
      const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy) || 1, reach = MOUTH * sc + 4 * f.S;
      turnTo = Math.atan2(dy, dx);
      if (d < reach + 34 * PX && Math.abs(angDiff(turnTo, P.a)) < 20 * DEG) return lunge(now);
      if (d > web().R * 2.4 || now - stalk.t0 > 45000) return giveUp(now, false);
      // It creeps in bursts and freezes while the fly, close by, faces it.
      const eyed = d < 140 && Math.abs(angDiff(Math.atan2(-dy, -dx), f.a)) < 50 * DEG;
      if (now > stalk.freeze && now > stalk.creep) { stalk.creep = now + rnd(600, 1600); stalk.freeze = stalk.creep + rnd(250, 700); }
      if (now < stalk.creep && !eyed) { path = [[f.x - dx / d * reach, f.y - dy / d * reach]]; pathSpeed = (d > 150 * PX ? 60 : 30) * PX; arrive = null; }
      else path = [];
    }
    function lunge(now) {
      state = 'lunge'; until = now + 280; path = []; turnTo = null; P.v = 260 * PX;
      [0, 4, 1, 5].forEach(i => { const r = LEGS[i].rest; script(legs[i], () => [r[0] + 7, r[1] * .55, 3.5]); });
    }
    function lungeStep(now) {
      const f = target.fly, m = toWorld([MOUTH, 0]);
      if (f.free && f.plane === 'glass' && Math.hypot(f.x - m[0], f.y - m[1]) < 5 * f.S + 3) return seize(now, f);
      if (now > until || !f.free || f.plane !== 'glass') { [0, 4, 1, 5].forEach(i => release(legs[i])); return giveUp(now, true); }
      P.wT = clamp(angDiff(Math.atan2(f.y - P.y, f.x - P.x), P.a) * 10, -8, 8); P.vT = 480 * PX;
      P.v = approach(P.v, P.vT, 1 / 60, .04); P.w = approach(P.w, P.wT, 1 / 60, .03);
    }
    function seize(now, f) {
      f.grab(mouthHold(f)); f.bite(); prey = f;
      [0, 4, 1, 5].forEach(i => release(legs[i]));
      P.vT = P.v = 0; grip = true;
      state = 'wait'; until = now + 1400; after = n => { grip = false; climbBack(n, false); };
      world.emit('seized', f);
    }
    function giveUp(now, missed) {
      world.emit(missed ? 'missed' : 'gaveup', target.fly);
      stop(); state = 'wait'; until = now + rnd(700, 1600); after = n => climbBack(n, false);
    }
    function climbBack(now, fast) {
      state = 'return'; turnTo = null;
      goTo([anchor], (fast ? 130 : 70) * PX, () => {
        state = 'climb'; airborne = true; legs.forEach(L => script(L, () => hang(L.g)));
        glideTo(anchor[0], anchor[1], REST_A, WEBZ, 1000, n => {
          airborne = false; anchor = null; plant();
          if (prey) feed(n); else rest0();
        });
      });
    }

    function think(now, dt) {
      switch (state) {
        case 'rest': return rest(now);
        case 'orient':
          if (target.fly && target.fly.phase !== 'stuck') { target.fly.claimed = false; return rest0(); }
          if (now > until) rush(now);
          return;
        case 'rush': if (target.fly && target.fly.phase !== 'stuck') return home(now); return;
        case 'home': case 'repair-go': if (!prey) respond(now, false); return;
        case 'seq': return seqStep(now);
        case 'feed': return feedStep(now, dt);
        case 'repair': return repairStep(now, dt);
        case 'stalk': return stalkStep(now);
        case 'lunge': return lungeStep(now);
        case 'wait': if (now > until) { const f = after; after = null; f(now); } return;
      }
    }
    function tick(now, dt) {
      hunger = Math.min(1, hunger + dt * .006);
      think(now, dt);
      steer(now, dt);
      if (state === 'lunge') { P.a += P.w * dt; P.x += Math.cos(P.a) * P.v * dt; P.y += Math.sin(P.a) * P.v * dt; }
      sc = U0 * Sim.depthScale(P.z);
      P.lunge = approach(P.lunge, P.lungeT, dt, .06);
      twist = approach(twist, twistT, dt, .8);
      // The palps feel ahead while it is on the move, and are still while it waits or feeds.
      palpAmp = approach(palpAmp, ['rest', 'feed', 'repair', 'settle'].includes(state) ? 0 : state === 'stalk' ? .35 : 1, dt, .35);
      // On the web the body rides on its feet, and the feet on threads that give and swing.
      const k = clamp((P.z - .2) / .2, 0, 1), ox = O.x, oy = O.y;
      let dx = 0, dy = 0, nf = 0;
      if (k) for (const L of legs) if (L.mode === 'stance' && L.base) { const d = web().dispAt(L.base[0], L.base[1]); dx += d[0]; dy += d[1]; nf++; }
      if (k && nf < 2) { const d = web().dispAt(P.x, P.y); dx = d[0]; dy = d[1]; nf = 1; }
      give.x = approach(give.x, nf ? dx / nf * k : 0, dt, .035); give.y = approach(give.y, nf ? dy / nf * k : 0, dt, .035);
      O.x = P.x + give.x + Math.cos(P.a) * P.lunge * sc; O.y = P.y + give.y + Math.sin(P.a) * P.lunge * sc;
      const vx = Math.cos(P.a) * P.v, vy = Math.sin(P.a) * P.v;
      acc.x = approach(acc.x, (vx - acc.vx) / dt, dt, .06); acc.y = approach(acc.y, (vy - acc.vy) / dt, dt, .06); acc.vx = vx; acc.vy = vy;
      P.vx = approach(P.vx, (O.x - ox) / dt, dt, .05); P.vy = approach(P.vy, (O.y - oy) / dt, dt, .05);
      stepLegs(dt, now);
    }
    function render() {
      el.style.transform = `translate3d(${n2(O.x - HALF)}px,${n2(O.y - HALF)}px,0)`;
      bodyG.setAttribute('transform', `rotate(${(P.a / DEG).toFixed(3)}) scale(${n2(sc / U0)})`);
      legs.forEach(drawLeg);
      const t = world.now;
      const hold = grip || state === 'feed';
      palps.forEach((p, i) => {
        const s = i ? 1 : -1, r = p.g.rest, tw = palpSide === i && t < palpUntil ? Math.sin((palpUntil - t) / 450 * Math.PI) : 0;
        const x = hold ? 12.4 + Math.sin(t * .0019 + i * 1.7) * .2 : r[0] + Math.sin(t * .006 + i * 2.1) * .6 * palpAmp + tw * 1.1;
        const y = hold ? s * (1.6 + Math.sin(t * .0013 + i) * .12) : r[1] + s * (Math.cos(t * .0047 + i) * .4 * palpAmp - tw * .5);
        pose2(p.segs, p.g.hip, p.g.len, p.g.bend, x, y);
      });
      const key = n2(P.z);
      if (key !== filterKey) { filterKey = key; el.style.filter = Sim.shadow(P.z, 0); }
    }

    function place() {
      const [hx, hy] = web().hub;
      Object.assign(P, { x: hx, y: hy, a: REST_A, z: WEBZ, v: 0, w: 0, vT: 0, wT: 0 });
      sc = U0 * Sim.depthScale(WEBZ); O.x = hx; O.y = hy;
      for (const L of legs) {
        const aw = toWorld(L.g.rest), hit = web().nearest(aw[0], aw[1], 8 * sc, false);
        L.mode = 'stance'; L.base = hit ? [hit.x, hit.y] : null; L.w = L.base ? L.base.slice() : aw; L.loc = toLocal(L.w); L.land = L.loc.slice(); L.settled = true;
      }
      pluckAt = world.now + rnd(8000, 20000); fidgetAt = world.now + rnd(10000, 25000); palpAt = world.now + rnd(4000, 12000);
    }

    return {
      el,
      get plane() { return P.z > .2 ? 'web' : 'glass'; },
      get onGlass() { return P.z < .25; },
      get threat() { return { x: O.x, y: O.y, vx: P.vx, vy: P.vy, reach: 16 * sc }; },
      // Its weight hangs on whichever feet are down, and every start and stop jerks the threads under them.
      get loads() {
        if (P.z < .3 || airborne) return [];
        const W = Sim.Web.LOAD, fx = -acc.x / 12000 * W, fy = W - acc.y / 12000 * W, feet = legs.filter(L => L.mode === 'stance' && L.base);
        if (feet.length < 3) return [{ x: P.x, y: P.y, fx, fy, r: 22 * PX }];   // between holds: all the threads under it
        return feet.map(L => ({ x: L.base[0], y: L.base[1], fx: fx / feet.length, fy: fy / feet.length, r: 5 }));
      },
      get state() { return state; },
      get prey() { return prey; },
      get cache() { return cache.slice(); },
      get hunger() { return hunger; },
      silk() {
        const out = [], tip = () => toWorld([TIP - .6, 0]);
        if (anchor) out.push({ pts: [anchor, tip()], a: .62, w: .7 });
        if (band) {
          const t = tip(), px = -Math.sin(P.a), py = Math.cos(P.a), n = world.now;
          for (let k = 0; k < 6; k++) {
            const o = (Math.sin(n * .005 + k * 1.3) * .5 + (k - 2.5) / 5) * 9 * band.S;
            out.push({ pts: [t, [band.x + px * o, band.y + py * o]], a: .32, w: .45 });
          }
        }
        if (repairAt && state === 'repair') out.push({ pts: [tip(), [repairAt[0] + Math.sin(world.now * .003) * 6, repairAt[1] + Math.cos(world.now * .002) * 6]], a: .4, w: .5 });
        return out;
      },
      tick, render, place,
      remap(f) {
        [P.x, P.y] = f(P.x, P.y);
        if (anchor) anchor = f(anchor[0], anchor[1]);
        if (repairAt) repairAt = f(repairAt[0], repairAt[1]);
        path = path.map(p => f(p[0], p[1])); glide = null;
        O.x = P.x; O.y = P.y;
        for (const L of legs) { if (L.base) L.base = f(L.base[0], L.base[1]); L.w = L.base ? L.base.slice() : toWorld(L.loc); }
        if (state === 'drop' || state === 'climb') { P.z = WEBZ; airborne = false; anchor = null; plant(); }
        if (['settle', 'repair', 'repair-go', 'drop', 'climb', 'home', 'carry'].includes(state)) { repairAt = null; prey ? carry(world.now) : home(world.now); }
      },
    };
  };
})(window.Sim);
