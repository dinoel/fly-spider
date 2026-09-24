// The orb web of a garden cross spider: frame threads and their anchors, radii, the hub, and the sticky
// capture spiral that the spider lays from the outside in. The silk is light and elastic: the web swells and
// shivers in the draught, gives under the spider's feet and under whatever struggles in it, rings when plucked,
// and glints where its threads lie across the light.
(function (Sim) {
  'use strict';
  const { clamp, seeded, TAU } = Sim.U;
  const FRAME = 0, RADIUS = 1, HUB = 2, SPIRAL = 3, CELL = 24;
  const cellKey = (cx, cy) => (cx + 64) * 8192 + cy + 64;
  const pickR = (rand, a) => a[Math.floor(rand() * a.length)];

  /* The web as a net of elastic threads under tension. Each node carries the mass of the silk around it (1 per px
     of thread); each thread pulls its ends towards each other's displacement, the harder the shorter and the thicker
     it is. The units are px, s and px of silk, so a force is what gives a px of silk that acceleration. */
  const TENSION = 3.2e5;              // tension over line density: a pluck runs along the silk at some 570 px/s
  const STIFF = [3, 1.4, 1, .5];      // frame and anchors, radii, hub, capture spiral (the stretchiest)
  const LMIN = 6;                     // threads shorter than this are as stiff as this, no stiffer
  const HOME = 14;                    // the stays and the web's curve out of the plane pull every node back, a little (1/s²)
  const DAMP = 1.6;                   // air drag on the silk (1/s)
  const SWEEPS = 5;
  const WIND = 30, EDDY = 38;         // the swell of the draught over the whole web, and eddies crossing it (px/s²)
  const PLUCK = 45;                   // px/s given to the silk nearby by a pluck of strength 1
  const SNAP = 70;                    // px/s the ends of a thread fly apart with when it breaks

  class Web {
    constructor(seed) {
      this.seed = seed; this.now = 0; this.wind = [0, 0];
      this.loads = []; this.events = []; this.silk = []; this.debris = []; this.loose = [];
    }

    build(L) {
      const rand = seeded(this.seed), r = (a, b) => a + rand() * (b - a);
      const [hx, hy] = this.hub = L.hub.slice(), R = this.R = L.R;
      const x0 = L.bounds.x0, y0 = L.bounds.y0;
      this.light = L.light;
      const V = this.v = [], lines = this.lines = [], discs = this.discs = [];
      const vert = (x, y, fix) => {
        V.push({ bx: x, by: y, x, y, fix: !!fix });
        return V.length - 1;
      };
      const line = (a, b, kind) => lines.push({ a, b, kind, alive: true, heal: 1, bt: [] });

      /* the frame: a polygon around the orb, pressed flat against the window frame where it reaches it */
      const n = 6, a0 = r(0, TAU), poly = [];
      for (let k = 0; k < n; k++) {
        const a = a0 + (k + r(-.2, .2)) * TAU / n, c = Math.cos(a), s = Math.sin(a);
        let d = R * (1 + .22 * s) * r(.94, 1.06), on = false;
        if (c < 0 && (x0 - hx) / c < d) { d = (x0 - hx) / c; on = true; }
        if (s < 0 && (y0 - hy) / s < d) { d = (y0 - hy) / s; on = true; }
        poly.push({ x: hx + c * d, y: hy + s * d, on });
      }
      poly.forEach(p => { p.i = vert(p.x, p.y, p.on); });

      /* radii, each from the hub to where it meets the frame */
      const NR = Math.round(clamp(R / 10.5, 24, 40)), t0 = r(0, TAU), rad = [];
      for (let i = 0; i < NR; i++) {
        const th = t0 + (i + r(-.25, .25)) * TAU / NR, c = Math.cos(th), s = Math.sin(th);
        let best = null;
        for (let k = 0; k < n; k++) {
          const P = poly[k], Q = poly[(k + 1) % n], ex = Q.x - P.x, ey = Q.y - P.y, den = c * ey - s * ex;
          if (Math.abs(den) < 1e-9) continue;
          const t = ((P.x - hx) * ey - (P.y - hy) * ex) / den, u = ((P.x - hx) * s - (P.y - hy) * c) / den;
          if (t > 0 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, k, u };
        }
        rad.push({ c, s, len: best.t, k: best.k, u: best.u });
      }
      this.maxR = Math.max(...rad.map(q => q.len)) + 10;

      /* along each radius: the hub turns, the open free zone, then the capture spiral out to the frame */
      const rh = R * .09, r0 = Math.max(2.5, rh * .3), rin = this.rin = R * .22;
      const sp = this.sp = clamp(R * .029, 6, 11.5), mean = rad.reduce((a, q) => a + q.len, 0) / NR;
      const hubN = Math.max(3, Math.floor((rh - r0) / 2.8));
      // No two turns of a real capture spiral are the same distance apart.
      const gap = [], turns = [0];
      for (let m = 0; m < 120; m++) { gap.push(r(.8, 1.2)); turns.push(turns[m] + gap[m]); }
      rad.forEach((q, i) => {
        const at = d => vert(hx + q.c * d, hy + q.s * d);
        q.inner = at(r0);
        q.hub = [];
        for (let k = 1; k <= hubN; k++) q.hub.push(at(r0 + (k + i / NR) * (rh - r0) / (hubN + 1) + r(-.4, .4)));
        q.cap = [];
        const f = q.len / mean, base = rin * f ** .3, step = sp * f ** .45;
        for (let m = 0; ; m++) {
          const d = base + (turns[m] + i / NR * gap[m]) * step + r(-.8, .8);
          if (m > 118 || d > q.len - step * .8) break;
          q.cap.push(at(d));
        }
        q.end = vert(hx + q.c * q.len, hy + q.s * q.len, false);
        [q.inner, ...q.hub, ...q.cap, q.end].reduce((a, b) => (line(a, b, RADIUS), b));
      });
      rad.forEach((q, i) => {
        const nx = rad[(i + 1) % NR], shift = i === NR - 1 ? 1 : 0;
        // The spider laid it by touch: here it skipped a stretch, there it slipped onto the next turn out.
        q.cap.forEach((a, m) => {
          const b = nx.cap[m + shift], b2 = nx.cap[m + shift + 1], u = rand();
          if (b === undefined || u < .025) return;
          line(a, u < .04 && b2 !== undefined ? b2 : b, SPIRAL);
        });
        q.hub.forEach((a, m) => { const b = nx.hub[m + shift]; if (b !== undefined) line(a, b, HUB); });
        line(q.inner, nx.inner, HUB);
      });
      for (let k = 0; k < NR * .7; k++) {
        const i = Math.floor(r(0, NR)), j = (i + 2 + Math.floor(r(0, 3))) % NR, a = rad[i].hub, b = rad[j].hub;
        line(a[Math.floor(r(0, a.length))], b[Math.floor(r(0, b.length))], HUB);
      }
      for (let k = 0; k < n; k++) {
        const on = rad.filter(q => q.k === k).sort((p, q) => p.u - q.u).map(q => q.end);
        [poly[k].i, ...on, poly[(k + 1) % n].i].reduce((a, b) => (line(a, b, FRAME), b));
      }

      /* anchor lines from the free corners of the frame to the window frame or the glass, split near the end */
      poly.forEach(p => {
        if (p.on) return;
        let dx = p.x - hx, dy = p.y - hy;
        const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
        const tx = dx < -.02 ? (x0 - p.x) / dx : Infinity, ty = dy < -.02 ? (y0 - p.y) / dy : Infinity, t = Math.min(tx, ty);
        const toFrame = t < R * 1.3, len = toFrame ? t : R * r(.28, .45);
        const sx = p.x + dx * len * .72, sy = p.y + dy * len * .72, si = vert(sx, sy);
        line(p.i, si, FRAME);
        for (const sg of [-1, 1]) {
          const ang = Math.atan2(dy, dx) + sg * r(.1, .22), ex = Math.cos(ang), ey = Math.sin(ang);
          let rest = len * .28;
          if (toFrame) { const tt = tx < ty ? (x0 - sx) / ex : (y0 - sy) / ey; if (tt > 0 && isFinite(tt)) rest = tt; }
          const e = vert(sx + ex * rest, sy + ey * rest, true);
          line(si, e, FRAME);
          if (!toFrame) discs.push(e);
        }
      });

      /* Old silk: a few strays left from earlier webs, out to the window frame or the glass, and broken ends hanging loose. */
      for (let k = 0; k < 3; k++) {
        const q = rad[Math.floor(r(0, NR))], a = Math.atan2(q.s, q.c) + r(-.6, .6), c = Math.cos(a), s = Math.sin(a);
        const px = hx + q.c * q.len, py = hy + q.s * q.len;
        let t = Infinity;
        if (c < -.05) t = Math.min(t, (x0 - px) / c);
        if (s < -.05) t = Math.min(t, (y0 - py) / s);
        const far = t > R * .9, len = far ? R * r(.12, .3) : t, e = vert(px + c * len, py + s * len, true);
        line(q.end, e, FRAME);
        lines[lines.length - 1].dust = 2;
        if (far) discs.push(e);
      }
      this.loose = [];
      for (let k = 0; k < 6; k++) {
        const q = rad[Math.floor(r(0, NR))], i = rand() < .5 || !q.cap.length ? q.end : q.cap[Math.floor(q.cap.length * r(.6, 1))];
        this.loose.push({ i, len: r(10, 42), side: r(-.35, .35), ph: r(0, TAU) });
      }

      // The glue on the capture thread breaks up into droplets, never evenly spaced.
      for (const ln of lines) {
        if (ln.kind !== SPIRAL) continue;
        const A = V[ln.a], B = V[ln.b], len = Math.hypot(B.bx - A.bx, B.by - A.by) || 1;
        for (let s = r(.3, 2); s < len - .3; s += r(1.8, 4.4)) ln.bt.push(s / len);
      }

      /* A web a day or two old: patches torn by earlier catches and never mended, and dust that has settled on the
         silk more in some places than in others. */
      const mid = ln => [(V[ln.a].bx + V[ln.b].bx) / 2, (V[ln.a].by + V[ln.b].by) / 2];
      for (let k = Math.round(r(2, 5)); k > 0; k--) {
        const q = rad[Math.floor(r(0, NR))], d = r(rin * 1.3, q.len * .92), cx = hx + q.c * d, cy = hy + q.s * d, rr = r(14, 34);
        for (const ln of lines) {
          if (ln.kind !== SPIRAL) continue;
          const [mx, my] = mid(ln);
          if (Math.hypot(mx - cx, my - cy) < rr && rand() < .8) { ln.alive = false; ln.old = true; }
        }
      }
      const fa = r(0, TAU), fb = r(0, TAU);
      for (const ln of lines) {
        if (ln.dust !== undefined) continue;
        const [mx, my] = mid(ln), field = Math.sin(mx * .011 + fa) * Math.sin(my * .014 + fb) + (my - hy) / R * .3;
        ln.dust = field + rand() * .7 > .95 ? 1 : rand() < .14 ? 2 : 0;
      }

      /* What the web has caught besides flies: dust, pollen, plant fluff, a seed on its parachute, flakes of dry leaf,
         a petal, midges too small to be worth the spider's while, and the wrapped husks of old ones. */
      const deb = this.debris = [], all = [], sticky = [];
      lines.forEach(ln => { if (!ln.alive) return; all.push(ln); if (ln.kind === SPIRAL) sticky.push(ln); });
      const add = (pool, type, o) => {
        for (let tries = 0; tries < 30; tries++) {
          const ln = pool[Math.floor(rand() * pool.length)], t = r(.12, .88), A = V[ln.a], B = V[ln.b];
          if (Math.hypot(A.bx + (B.bx - A.bx) * t - hx, A.by + (B.by - A.by) * t - hy) < R * .14) continue;   // the hub it keeps clean
          deb.push(Object.assign({ ln, t, type, rot: r(0, TAU), twitch: 0 }, o));
          return;
        }
      };
      const k = R / 400;
      for (let j = 0; j < 260 * k; j++) add(rand() < .75 ? sticky : all, 'dust', { s: r(.45, 1.2), c: Math.floor(rand() * 4) });
      for (let j = 0; j < 50 * k; j++) add(sticky, 'pollen', { s: r(.7, 1.35) });
      for (let j = 0; j < 7; j++) {
        const hairs = [];
        for (let h = Math.floor(r(2, 5)); h > 0; h--) { const a = r(0, TAU), l = r(2.5, 7); hairs.push([Math.cos(a) * l, Math.sin(a) * l, r(-1.5, 1.5)]); }
        add(sticky, 'fluff', { hairs });
      }
      for (let j = rand() < .5 ? 1 : 2; j > 0; j--) add(sticky, 'seed', { s: r(6, 9) });
      for (let j = Math.floor(r(2, 4)); j > 0; j--) {
        const s = r(2.8, 6.5), n = Math.floor(r(6, 9)), pts = [];
        for (let m = 0; m < n; m++) { const a = m / n * TAU, rr = s * r(.55, 1) * (Math.abs(Math.cos(a)) * .5 + .5); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * .6]); }
        add(all, 'leaf', { pts, s, col: pickR(rand, ['#7a5a32', '#8e6b3c', '#5f4527', '#6f6a3a']) });
      }
      if (rand() < .6) add(sticky, 'petal', { s: r(3, 4.5) });
      for (let j = Math.floor(r(3, 6)); j > 0; j--) add(sticky, 'midge', { s: r(.9, 1.5) });
      for (let j = Math.floor(r(1, 3)); j > 0; j--) add(sticky, 'husk', { s: r(2.6, 4.4) });

      this.grid = new Map();
      lines.forEach((ln, idx) => {
        const A = V[ln.a], B = V[ln.b];
        for (let cx = Math.floor(Math.min(A.bx, B.bx) / CELL); cx <= Math.floor(Math.max(A.bx, B.bx) / CELL); cx++)
          for (let cy = Math.floor(Math.min(A.by, B.by) / CELL); cy <= Math.floor(Math.max(A.by, B.by) / CELL); cy++) {
            const key = cellKey(cx, cy);
            (this.grid.get(key) || this.grid.set(key, []).get(key)).push(idx);
          }
      });
      this.stamp = new Uint32Array(lines.length); this.stampN = 0;
      this.initMotion();
    }

    /* The nearest point on a thread that still holds, in the web's rest position. */
    nearest(x, y, maxD, stickyOnly) {
      const V = this.v, n = ++this.stampN;
      let best = null, bd = maxD * maxD;
      for (let cx = Math.floor((x - maxD) / CELL); cx <= Math.floor((x + maxD) / CELL); cx++)
        for (let cy = Math.floor((y - maxD) / CELL); cy <= Math.floor((y + maxD) / CELL); cy++) {
          const list = this.grid.get(cellKey(cx, cy));
          if (!list) continue;
          for (const idx of list) {
            if (this.stamp[idx] === n) continue;
            this.stamp[idx] = n;
            const ln = this.lines[idx];
            if (!ln.alive || (stickyOnly && ln.kind !== SPIRAL)) continue;
            const A = V[ln.a], B = V[ln.b], ex = B.bx - A.bx, ey = B.by - A.by;
            const t = clamp(((x - A.bx) * ex + (y - A.by) * ey) / (ex * ex + ey * ey || 1), 0, 1);
            const px = A.bx + ex * t, py = A.by + ey * t, d2 = (px - x) ** 2 + (py - y) ** 2;
            if (d2 < bd) { bd = d2; best = { x: px, y: py, idx }; }
          }
        }
      return best;
    }
    catches(x, y, rad) {
      return Math.hypot(x - this.hub[0], y - this.hub[1]) < this.maxR && !!this.nearest(x, y, rad, true);
    }
    touches(x, y, rad) {
      return Math.hypot(x - this.hub[0], y - this.hub[1]) < this.maxR + 40 && !!this.nearest(x, y, rad, false);
    }
    each(x, y, rad, fn) {
      const V = this.v;
      for (const ln of this.lines) {
        const A = V[ln.a], B = V[ln.b], ex = B.bx - A.bx, ey = B.by - A.by;
        const t = clamp(((x - A.bx) * ex + (y - A.by) * ey) / (ex * ex + ey * ey || 1), 0, 1);
        if (Math.hypot(A.bx + ex * t - x, A.by + ey * t - y) < rad) fn(ln, Math.hypot(A.bx + ex * t - x, A.by + ey * t - y));
      }
    }
    tear(x, y, rad, radii) {
      let broken = 0;
      this.each(x, y, rad, (ln, d) => {
        if (!ln.alive || ln.kind === FRAME || (ln.kind === RADIUS && !(radii && d < rad * .45))) return;
        ln.alive = false; broken++;
        this.snap(ln);
      });
      return broken;
    }
    repair(x, y, rad, dt) {
      this.each(x, y, rad, ln => { if (!ln.alive && !ln.old && Math.random() < dt * .9) { ln.alive = true; ln.heal = 0; } });
    }
    hole() {
      const V = this.v, torn = this.lines.filter(ln => !ln.alive && !ln.old);   // old damage it lives with
      if (torn.length < 6) return null;
      const ln = torn[Math.floor(Math.random() * torn.length)], A = V[ln.a], B = V[ln.b];
      return [(A.bx + B.bx) / 2, (A.by + B.by) / 2];
    }
    /* A pluck: the silk round a point is flicked one way, and the web rings with it. */
    poke(x, y, amp) {
      const V = this.v, a = Math.random() * TAU, v = amp * PLUCK, cx = Math.cos(a) * v, cy = Math.sin(a) * v, r = 16 + amp * 7, r2 = r * r;
      for (let i = 0; i < V.length; i++) {
        const d2 = (V[i].bx - x) ** 2 + (V[i].by - y) ** 2;
        if (d2 > r2 * 5 || V[i].fix) continue;
        const k = Math.exp(-d2 / r2);
        this.vx[i] += cx * k; this.vy[i] += cy * k;
      }
    }
    // A broken thread lets go of both ends: the tension that held it throws them back into the web.
    snap(ln) {
      const A = this.v[ln.a], B = this.v[ln.b], l = ln.len || 1, ex = (B.bx - A.bx) / l, ey = (B.by - A.by) / l;
      if (!A.fix) { this.vx[ln.a] -= ex * SNAP; this.vy[ln.a] -= ey * SNAP; }
      if (!B.fix) { this.vx[ln.b] += ex * SNAP; this.vy[ln.b] += ey * SNAP; }
    }
    /* Something small hits the capture thread and stays: it kicks for a while, then hangs there with the rest. */
    stick(x, y, type, o) {
      const hit = this.catches(x, y, 3) && this.nearest(x, y, 3, true);
      if (!hit) return null;
      const ln = this.lines[hit.idx], A = this.v[ln.a], B = this.v[ln.b], ex = B.bx - A.bx, ey = B.by - A.by;
      const t = clamp(((hit.x - A.bx) * ex + (hit.y - A.by) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const d = Object.assign({ ln, t, type, rot: Math.random() * TAU, s: 1, twitch: 0 }, o);
      this.debris.push(d);
      const old = this.debris.findIndex(q => q.type === 'midge');
      if (this.debris.length > 600 && old >= 0) this.debris.splice(old, 1);
      return d;
    }
    event(x, y, amp, fly) { this.events.push({ x, y, amp, fly, t: this.now }); }

    /* ── motion ── */
    initMotion() {
      const V = this.v, n = V.length, F = () => new Float32Array(n);
      this.ux = F(); this.uy = F(); this.vx = F(); this.vy = F(); this.fx = F(); this.fy = F();
      this.px = F(); this.py = F(); this.ax = F(); this.ay = F(); this.m = F();
      const deg = new Uint32Array(n + 1);
      for (const ln of this.lines) {
        const A = V[ln.a], B = V[ln.b];
        ln.len = Math.hypot(B.bx - A.bx, B.by - A.by);
        ln.k = TENSION * STIFF[ln.kind] / Math.max(LMIN, ln.len);
        this.m[ln.a] += ln.len / 2; this.m[ln.b] += ln.len / 2;
        deg[ln.a + 1]++; deg[ln.b + 1]++;
      }
      for (let i = 0; i < n; i++) { deg[i + 1] += deg[i]; this.m[i] += 2; }
      const nb = new Uint32Array(deg[n]), li = new Uint32Array(deg[n]), at = deg.slice(0, n);
      this.lines.forEach((ln, l) => { nb[at[ln.a]] = ln.b; li[at[ln.a]++] = l; nb[at[ln.b]] = ln.a; li[at[ln.b]++] = l; });
      this.adj = { start: deg, nb, li };
      this.loads = []; this.stepN = 0; this.motion = 0;
    }
    setTime(now, dt) {
      this.now = now;
      const t = now / 1000;
      this.gust = .45 + .55 * Math.max(0, Math.sin(t * .13 + 1.3)) ** 2 + .12 * Math.sin(t * .71);
      this.wind = [this.gust * (1.1 * Math.sin(t * .61) + .6 * Math.sin(t * 1.53 + 2) + .25 * Math.sin(t * 3.7 + .5)),
        this.gust * (.7 * Math.sin(t * .47 + 1) + .35 * Math.sin(t * 1.9 + .3))];
      if (this.events.length > 40) this.events = this.events.slice(-40);
      for (const ln of this.lines) if (ln.alive && ln.heal < 1) ln.heal = Math.min(1, ln.heal + dt / 1.2);
      for (const d of this.debris) {
        if (d.twitch < now || Math.random() > dt * 2.5) continue;
        const A = this.v[d.ln.a], B = this.v[d.ln.b];
        this.poke(A.bx + (B.bx - A.bx) * d.t, A.by + (B.by - A.by) * d.t, .35);
      }
      if (dt > 0) this.stepMotion(dt);
    }
    /* One step of Newmark's average acceleration rule, solved by a few Gauss-Seidel sweeps. It is implicit, so the
       short, stiff threads round the hub cannot blow it up, and unlike implicit Euler it does not damp the web's
       ringing away: only the air does. Every node i solves
         4m (u - u_pred) / dt² = f + Σ k (u_j - u) - HOME m u,   u_pred = u + v dt + a dt² / 4. */
    stepMotion(dt) {
      const V = this.v, n = V.length, L = this.lines, { ux, uy, vx, vy, fx, fy, px, py, ax, ay, m } = this;
      const { start, nb, li } = this.adj, t = this.now / 1000, g = this.gust;
      const wx = this.wind[0] * WIND, wy = this.wind[1] * WIND * .6;
      for (let i = 0; i < n; i++) {
        const v = V[i];
        // the draught: it swells over the whole web, and eddies cross it, so no two parts move quite alike
        const e1 = Math.sin(v.bx * .0061 + t * 1.13) * Math.cos(v.by * .0052 - t * .74), e2 = Math.sin((v.bx - v.by) * .0093 + t * 2.3);
        fx[i] = m[i] * (wx + (e1 + e2 * .45) * EDDY * g);
        fy[i] = m[i] * (wy + (e2 * .6 - e1 * .4) * EDDY * g);
      }
      for (const q of this.loads) q.r ? this.spread(q.x, q.y, q.fx, q.fy, q.r) : this.push(q.x, q.y, q.fx, q.fy);
      const idt2 = 4 / (dt * dt), q = dt * dt / 4;
      for (let i = 0; i < n; i++) {
        if (V[i].fix) { ux[i] = uy[i] = vx[i] = vy[i] = ax[i] = ay[i] = 0; continue; }
        px[i] = ux[i] + vx[i] * dt + ax[i] * q; py[i] = uy[i] + vy[i] * dt + ay[i] * q;
        ux[i] = px[i]; uy[i] = py[i];
      }
      for (let it = 0; it < SWEEPS; it++) {
        for (let i = 0; i < n; i++) {
          if (V[i].fix) continue;
          const mi = m[i] * idt2;
          let sk = HOME * m[i], sx = 0, sy = 0;
          for (let p = start[i]; p < start[i + 1]; p++) {
            const ln = L[li[p]];
            if (!ln.alive) continue;
            const k = ln.heal < 1 ? ln.k * ln.heal : ln.k, j = nb[p];
            sk += k; sx += k * ux[j]; sy += k * uy[j];
          }
          ux[i] = (mi * px[i] + fx[i] + sx) / (mi + sk);
          uy[i] = (mi * py[i] + fy[i] + sy) / (mi + sk);
        }
      }
      const keep = Math.exp(-DAMP * dt);
      let top = 0;
      for (let i = 0; i < n; i++) {
        if (V[i].fix) continue;
        const ax1 = (ux[i] - px[i]) * idt2, ay1 = (uy[i] - py[i]) * idt2;
        vx[i] = (vx[i] + (ax[i] + ax1) * dt / 2) * keep; vy[i] = (vy[i] + (ay[i] + ay1) * dt / 2) * keep;
        ax[i] = ax1; ay[i] = ay1;
        const s2 = vx[i] * vx[i] + vy[i] * vy[i];
        if (s2 > top) top = s2;
      }
      this.motion = Math.sqrt(top); this.stepN++;
    }
    // Where a point of the web at rest (x, y) lies on a thread: the thread and how far along it.
    thread(x, y, maxD) {
      const hit = this.nearest(x, y, maxD, false);
      if (!hit) return null;
      const ln = this.lines[hit.idx], A = this.v[ln.a], B = this.v[ln.b], ex = B.bx - A.bx, ey = B.by - A.by;
      return { ln, t: clamp(((hit.x - A.bx) * ex + (hit.y - A.by) * ey) / (ex * ex + ey * ey || 1), 0, 1) };
    }
    // A force on the web at a point of it, shared between the ends of the thread there.
    push(x, y, fx, fy) {
      const h = this.thread(x, y, 16);
      if (!h) return;
      const { ln, t } = h;
      this.fx[ln.a] += fx * (1 - t); this.fy[ln.a] += fy * (1 - t);
      this.fx[ln.b] += fx * t; this.fy[ln.b] += fy * t;
    }
    // A force borne by all the silk round a point, as by a body lying across many threads, or a foot over a few.
    spread(x, y, fx, fy, r) {
      const V = this.v, r2 = r * r, w = [];
      let sum = 0;
      for (let i = 0; i < V.length; i++) {
        const d2 = (V[i].bx - x) ** 2 + (V[i].by - y) ** 2;
        if (d2 > r2 * 4 || V[i].fix) continue;
        const k = Math.exp(-d2 / r2);
        w.push(i, k); sum += k;
      }
      if (!sum) return this.push(x, y, fx, fy);
      for (let p = 0; p < w.length; p += 2) { const k = w[p + 1] / sum; this.fx[w[p]] += fx * k; this.fy[w[p]] += fy * k; }
    }
    // How far the point of the web that rests at (x, y) has been carried from there.
    dispAt(x, y) {
      const h = this.thread(x, y, 16);
      if (!h) return [0, 0];
      const { ln, t } = h;
      return [this.ux[ln.a] * (1 - t) + this.ux[ln.b] * t, this.uy[ln.a] * (1 - t) + this.uy[ln.b] * t];
    }
    update() {
      const V = this.v;
      for (let i = 0; i < V.length; i++) { V[i].x = V[i].bx + this.ux[i]; V[i].y = V[i].by + this.uy[i]; }
    }

    /* ── drawing ── */
    draw(c) {
      const V = this.v, R = this.R;
      const lx = this.light[0] + this.wind[0] * 26, ly = this.light[1] + this.wind[1] * 26;
      const groups = Array.from({ length: 12 }, () => []), glint = Array.from({ length: 12 }, () => []), torn = [], healing = [];
      for (const ln of this.lines) {
        if (!ln.alive) { torn.push(ln); continue; }
        if (ln.heal < 1) { healing.push(ln); continue; }
        groups[ln.kind * 3 + ln.dust].push(ln);
        /* A silk thread flashes where it lies square to the line towards the light, so the flashes line up in arcs
           around the sun, as in photographs, each split into a little spectrum. */
        const A = V[ln.a], B = V[ln.b], ex = B.x - A.x, ey = B.y - A.y, el = Math.hypot(ex, ey) || 1;
        const ax = A.x - lx, ay = A.y - ly, bx = B.x - lx, by = B.y - ly, al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
        const ca = (ex * ax + ey * ay) / (el * al), cb = (ex * bx + ey * by) / (el * bl);
        const t = ca * cb < 0 ? ca / (ca - cb) : Math.abs(ca) < Math.abs(cb) ? 0 : 1, c = ca + (cb - ca) * t;
        const g = Math.exp(-c * c / .0012) * clamp(1.3 - (al + (bl - al) * t) / (R * 1.7), .08, 1);
        if (g < .12) continue;
        const half = clamp(.035 / (Math.abs(cb - ca) || 1e-3), 5 / el, .45), t0 = Math.max(0, t - half), t1 = Math.min(1, t + half);
        const at = u => [A.x + ex * u, A.y + ey * u], lvl = Math.min(3, Math.floor(g * 4)) * 3;
        const sign = cb > ca ? 1 : -1, cut1 = t0 + (t1 - t0) / 3, cut2 = t1 - (t1 - t0) / 3;
        glint[lvl + (sign > 0 ? 0 : 2)].push([at(t0), at(cut1), ln, t0, cut1]);
        glint[lvl + 1].push([at(cut1), at(cut2), ln, cut1, cut2]);
        glint[lvl + (sign > 0 ? 2 : 0)].push([at(cut2), at(t1), ln, cut2, t1]);
      }
      const stroke = (list, style, w) => {
        if (!list.length) return;
        c.beginPath(); for (const ln of list) { const A = V[ln.a], B = V[ln.b]; c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); }
        c.strokeStyle = style; c.lineWidth = w; c.stroke();
      };
      // Glue beads on the capture thread, [line, from, to] along it; a dashed stroke would cost a frame in three.
      const beads = (list, style, size) => {
        if (!list.length) return;
        const h = size / 2;
        c.beginPath();
        for (const [ln, t0, t1] of list) {
          const A = V[ln.a], B = V[ln.b], ex = B.x - A.x, ey = B.y - A.y;
          for (const t of ln.bt) if (t >= t0 && t <= t1) c.rect(A.x + ex * t - h, A.y + ey * t - h, size, size);
        }
        c.fillStyle = style; c.fill();
      };
      c.lineCap = 'round';
      // Each kind of thread as it is spun, as it looks with dust settled on it, and a finer or older strand.
      const STYLE = [
        [['rgba(236,240,230,.46)', 1.05], ['rgba(206,202,186,.58)', 1.35], ['rgba(232,236,226,.26)', .8]],
        [['rgba(232,238,228,.3)', .7], ['rgba(208,204,188,.42)', .9], ['rgba(232,238,228,.18)', .55]],
        [['rgba(232,238,228,.28)', .6], ['rgba(208,204,188,.38)', .75], ['rgba(232,238,228,.17)', .5]],
        [['rgba(226,234,224,.15)', .45], ['rgba(212,208,192,.26)', .6], ['rgba(226,234,224,.09)', .4]],
      ];
      for (let k = 0; k < 12; k++) stroke(groups[k], ...STYLE[k / 3 | 0][k % 3]);
      beads([...groups[SPIRAL * 3], ...groups[SPIRAL * 3 + 1]].map(ln => [ln, 0, 1]), 'rgba(246,249,238,.3)', .95);
      beads(groups[SPIRAL * 3 + 2].map(ln => [ln, 0, 1]), 'rgba(246,249,238,.16)', .8);
      for (const ln of healing) {
        stroke([ln], `rgba(236,242,232,${(ln.heal * .35).toFixed(3)})`, .5);
        if (ln.kind === SPIRAL) beads([[ln, 0, 1]], `rgba(246,249,238,${(ln.heal * .3).toFixed(3)})`, .95);
      }

      /* broken threads spring back and hang down in short tails */
      c.beginPath();
      for (const ln of torn) {
        const A = V[ln.a], B = V[ln.b], ex = B.x - A.x, ey = B.y - A.y, len = Math.hypot(ex, ey);
        for (const [P, s] of [[A, 1], [B, -1]]) {
          c.moveTo(P.x, P.y);
          c.quadraticCurveTo(P.x + ex * s * .16, P.y + ey * s * .16 + 1.5, P.x + ex * s * .12, P.y + ey * s * .12 + 3 + len * .18);
        }
      }
      // loose ends of old silk, drooping and stirring in the draught
      const t = this.now / 1000;
      for (const q of this.loose) {
        const P = V[q.i], sw = Math.sin(t * 1.3 + q.ph) * .08 + this.wind[0] * .12, L = q.len;
        c.moveTo(P.x, P.y);
        c.quadraticCurveTo(P.x + (q.side + sw * .5) * L * .5, P.y + L * .3, P.x + (q.side + sw) * L, P.y + L * .92);
      }
      c.strokeStyle = 'rgba(232,238,228,.3)'; c.lineWidth = .5; c.stroke();
      this.drawDebris(c);

      const tints = [[255, 222, 178], [255, 255, 250], [196, 226, 255]], alpha = [.22, .4, .62, .92];
      const pieces = (list, style, w) => {
        if (!list.length) return;
        c.beginPath(); for (const [p, q] of list) { c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); }
        c.strokeStyle = style; c.lineWidth = w; c.stroke();
      };
      for (let lvl = 0; lvl < 4; lvl++) for (let t = 0; t < 3; t++) {
        const list = glint[lvl * 3 + t];
        if (!list.length) continue;
        const [r, g, b] = tints[t], a = alpha[lvl], col = k => `rgba(${r},${g},${b},${Math.min(1, k).toFixed(3)})`;
        pieces(list, col(a * .2), 2.6 + lvl * .6);
        pieces(list, col(a), .7 + lvl * .12);
        beads(list.filter(p => p[2].kind === SPIRAL).map(p => [p[2], p[3], p[4]]), col(a * 1.1), 1.3 + lvl * .2);
      }
      c.fillStyle = 'rgba(240,244,236,.45)';
      for (const i of this.discs) { c.beginPath(); c.arc(V[i].x, V[i].y, 1.7, 0, TAU); c.fill(); }

      /* the spider's own silk: its dragline, the swathing band, a thread being laid */
      for (const s of this.silk) {
        c.beginPath(); s.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.strokeStyle = `rgba(242,246,238,${s.a})`; c.lineWidth = s.w; c.stroke();
      }
    }
  }
  /* Debris hangs where it was caught and goes where the thread goes; when the thread breaks, it falls. */
  Web.prototype.drawDebris = function (c) {
    const V = this.v, now = this.now;
    const DUST = ['rgba(58,50,38,.72)', 'rgba(124,110,88,.66)', 'rgba(206,200,182,.58)', 'rgba(36,32,26,.8)'];
    const specks = [[], [], [], []], pollen = [], rest = [];
    for (const d of this.debris) {
      if (d.gone) continue;
      if (!d.ln.alive) { d.gone = true; continue; }
      const A = V[d.ln.a], B = V[d.ln.b];
      d.x = A.x + (B.x - A.x) * d.t; d.y = A.y + (B.y - A.y) * d.t;
      if (d.type === 'dust') specks[d.c].push(d); else if (d.type === 'pollen') pollen.push(d); else rest.push(d);
    }
    const dots = (list, style) => {
      if (!list.length) return;
      c.beginPath();
      for (const d of list) { const r = d.s * .5 + .15; c.moveTo(d.x + r, d.y); c.arc(d.x, d.y, r, 0, TAU); }
      c.fillStyle = style; c.fill();
    };
    specks.forEach((l, k) => dots(l, DUST[k]));
    dots(pollen, 'rgba(226,194,74,.8)');

    for (const d of rest) {
      c.save();
      let rot = d.rot;
      if (d.twitch > now) {   // still kicking
        const k = Math.sin(now * .05 + d.rot * 9) * Math.sin(now * .013 + d.t * 20);
        c.translate(d.x + k * .6, d.y + Math.sin(now * .041 + d.rot) * .5); rot += k * .25;
      } else c.translate(d.x, d.y);
      c.rotate(rot);
      c.lineCap = 'round';
      const s = d.s;
      switch (d.type) {
        case 'fluff':
          c.beginPath();
          for (const [x, y, b] of d.hairs) { c.moveTo(0, 0); c.quadraticCurveTo(x * .5 - y * b * .1, y * .5 + x * b * .1, x, y); }
          c.strokeStyle = 'rgba(238,234,222,.5)'; c.lineWidth = .35; c.stroke();
          break;
        case 'seed': {
          c.beginPath(); c.ellipse(-s * .55, 0, s * .22, s * .07, 0, 0, TAU); c.fillStyle = '#4a3a24'; c.fill();
          c.beginPath(); c.moveTo(-s * .33, 0); c.lineTo(0, 0);
          for (let k = 0; k < 16; k++) {
            const a = (k / 15 - .5) * 2.2 + Math.sin(k * 7.3) * .08, l = s * (.8 + Math.sin(k * 3.1) * .12);
            c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * l * .6, Math.sin(a) * l * .45, Math.cos(a) * l, Math.sin(a) * l);
          }
          c.strokeStyle = 'rgba(244,244,236,.42)'; c.lineWidth = .3; c.stroke();
          break;
        }
        case 'leaf':
          c.beginPath(); d.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
          c.fillStyle = d.col; c.globalAlpha = .88; c.fill();
          c.globalAlpha = 1; c.strokeStyle = 'rgba(40,26,12,.45)'; c.lineWidth = .4; c.stroke();
          c.beginPath(); c.moveTo(-s * .8, 0); c.lineTo(s * .7, 0); c.strokeStyle = 'rgba(220,190,130,.3)'; c.lineWidth = .35; c.stroke();
          break;
        case 'petal':
          c.beginPath(); c.ellipse(0, 0, s, s * .62, 0, 0, TAU);
          c.fillStyle = 'rgba(246,232,236,.82)'; c.fill(); c.strokeStyle = 'rgba(190,150,160,.35)'; c.lineWidth = .35; c.stroke();
          c.beginPath(); c.moveTo(-s * .9, 0); c.lineTo(s * .6, 0); c.moveTo(-s * .9, 0); c.lineTo(s * .4, s * .3); c.moveTo(-s * .9, 0); c.lineTo(s * .4, -s * .3);
          c.strokeStyle = 'rgba(200,160,172,.35)'; c.lineWidth = .25; c.stroke();
          break;
        case 'midge': {
          const flap = d.twitch > now ? Math.sin(now * .09 + d.rot * 5) * .5 : 0;
          c.fillStyle = 'rgba(216,222,228,.4)';
          for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(-.9 * s, sg * .9 * s, 1.5 * s, .5 * s, sg * (.5 + flap), 0, TAU); c.fill(); }
          c.beginPath(); c.ellipse(-.3 * s, 0, 1.3 * s, .42 * s, 0, 0, TAU); c.fillStyle = '#231c14'; c.fill();
          c.beginPath(); c.arc(1.1 * s, 0, .36 * s, 0, TAU); c.fill();
          c.beginPath(); for (const sg of [-1, 1]) for (const x of [.5, 0, -.5]) { c.moveTo(x * s, 0); c.lineTo((x - .2) * s, sg * 1.1 * s); }
          c.strokeStyle = 'rgba(30,24,18,.6)'; c.lineWidth = .25; c.stroke();
          break;
        }
        case 'husk':
          c.beginPath(); c.ellipse(0, 0, s, s * .58, 0, 0, TAU); c.fillStyle = 'rgba(214,210,196,.72)'; c.fill();
          c.beginPath(); c.ellipse(s * .1, 0, s * .55, s * .3, 0, 0, TAU); c.fillStyle = 'rgba(60,44,30,.45)'; c.fill();
          c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(k * s * .35 - s * .2, -s * .6); c.lineTo(k * s * .35 + s * .2, s * .6); }
          c.strokeStyle = 'rgba(240,238,228,.55)'; c.lineWidth = .3; c.stroke();
          break;
      }
      c.restore();
    }
  };
  Web.LOAD = 5e5;                     // the spider's weight in the web's units: it sags the hub by some 4 px
  Sim.Web = Web;
})(window.Sim);
