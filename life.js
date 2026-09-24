// The small life of the window: dust drifting in the room, lit where the sun comes through the pane, and midges
// dancing in front of the glass. A midge that blunders into the capture spiral stays there; it is too small to be
// worth the spider's while.
(function (Sim) {
  'use strict';
  const { TAU, rnd, clamp, approach, angDiff } = Sim.U;
  const WEBZ = Sim.WEBZ;

  Sim.makeLife = function (world, cv) {
    const c = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, gnatAt = 0;
    const motes = [], gnats = [];

    function resize(L) {
      W = L.W; H = L.H; dpr = Math.min(1.5, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const n = Math.round(clamp(W * H / 22000, 40, 110));
      while (motes.length < n) motes.push({ x: rnd(0, W), y: rnd(0, H), z: Math.random(), vx: 0, vy: 0, ph: rnd(0, TAU), f: rnd(.4, 2.6), s: rnd(.35, 1) });
      motes.length = n;
      for (const m of motes) { m.x = clamp(m.x, 0, W); m.y = clamp(m.y, 0, H); }
    }

    /* ── dust ── carried by slow eddies in the warm air by the glass, rising a little */
    function stepMotes(now, dt) {
      const t = now / 1000;
      for (const m of motes) {
        const k = .4 + m.z * .9;
        const fx = (Math.sin(m.y * .004 + t * .11 + m.ph) * 4 + Math.sin(t * .07 + m.ph * 3) * 2.5) * k;
        const fy = (-2.2 + Math.cos(m.x * .003 + t * .13) * 3 + Math.sin(t * .23 + m.ph) * 1.2) * k;
        m.vx = approach(m.vx, fx + rnd(-6, 6), dt, .8); m.vy = approach(m.vy, fy + rnd(-6, 6), dt, .8);
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < -10) m.x += W + 20; else if (m.x > W + 10) m.x -= W + 20;
        if (m.y < -10) m.y += H + 20; else if (m.y > H + 10) m.y -= H + 20;
      }
    }

    /* ── midges ── */
    function spawnGnat(now) {
      const b = world.bounds, side = Math.random() < .55;
      gnats.push({
        x: side ? b.x1 + 10 : rnd(b.x0 + 60, b.x1 - 40), y: side ? rnd(b.y0 + 40, b.y1 - 40) : b.y1 + 10, vx: 0, vy: 0, a: 0,
        alt: 1, altT: .8, mode: 'fly', s: rnd(.75, 1.25), ph: rnd(0, TAU), w1: rnd(1.4, 2.6), w2: rnd(1.1, 2.3), amp: rnd(25, 70),
        home: [rnd(b.x0 + 80, b.x1 - 80), rnd(b.y0 + 60, b.y1 - 60)], moveAt: now + rnd(2000, 6000), leaveAt: now + rnd(20000, 60000),
        sitAt: now + rnd(4000, 15000), until: 0, pa: 1,
      });
    }
    function stepGnats(now, dt) {
      const live = gnats.filter(g => !g.gone).length;
      if (!gnatAt) gnatAt = now + rnd(3000, 10000);
      if (now > gnatAt) { gnatAt = now + rnd(12000, 40000); if (live < 4) spawnGnat(now); }
      const b = world.bounds, M = world.pointer, t = now / 1000;
      for (const g of gnats) {
        if (g.gone) continue;
        if (g.mode === 'sit') {
          g.alt = approach(g.alt, 0, dt, .05);
          if (now > g.until || (M.on && Math.hypot(M.x - g.x, M.y - g.y) < 60)) { g.mode = 'fly'; g.altT = rnd(.6, 1); g.sitAt = now + rnd(6000, 20000); }
          continue;
        }
        const leaving = now > g.leaveAt;
        if (now > g.moveAt) {   // the dance drifts about, towards the light
          g.moveAt = now + rnd(2000, 7000);
          const tx = g.home[0] + rnd(-160, 160), ty = g.home[1] + rnd(-120, 120), lx = world.light(tx, ty) > world.light(g.home[0], g.home[1]);
          if (lx || Math.random() < .5) g.home = [clamp(tx, b.x0 + 40, b.x1 - 40), clamp(ty, b.y0 + 40, b.y1 - 40)];
        }
        let tx = g.home[0] + Math.sin(t * g.w1 + g.ph) * g.amp, ty = g.home[1] + Math.sin(t * g.w2 + g.ph * 2) * g.amp * .6;
        if (leaving) { tx = b.x1 + 80; ty = g.home[1] - 200; }
        if (M.on) { const dx = g.x - M.x, dy = g.y - M.y, d = Math.hypot(dx, dy); if (d < 70) { tx = g.x + dx / d * 120; ty = g.y + dy / d * 120; } }
        const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(150, 25 + d * 2.2);
        g.vx = approach(g.vx, dx / d * sp + rnd(-90, 90), dt, .12); g.vy = approach(g.vy, dy / d * sp + rnd(-90, 90), dt, .12);
        g.x += g.vx * dt; g.y += g.vy * dt;
        g.a += angDiff(Math.atan2(g.vy, g.vx), g.a) * Math.min(1, dt * 10);
        if (!leaving && now > g.sitAt) { g.altT = 0; if (g.alt < .04) { g.mode = 'sit'; g.until = now + rnd(1500, 8000); continue; } }
        else if (Math.random() < dt * .3) g.altT = rnd(.25, 1);
        g.alt = approach(g.alt, g.altT, dt, .5);
        // Through the plane of the web, over a capture thread, it can stick.
        const crossed = (g.pa - WEBZ) * (g.alt - WEBZ) < 0, near = Math.abs(g.alt - WEBZ) < .12;
        g.pa = g.alt;
        if ((crossed || (near && Math.random() < dt * 2)) && world.web.catches(g.x, g.y, 2) && Math.random() < .7) {
          if (world.web.stick(g.x, g.y, 'midge', { s: g.s * .75, twitch: now + rnd(6000, 25000) })) {
            g.gone = true; world.web.poke(g.x, g.y, .5); world.emit('gnat'); continue;
          }
        }
        if (leaving && (g.x > b.x1 + 40 || g.y < b.y0 - 40)) g.gone = true;
      }
      for (let i = gnats.length - 1; i >= 0; i--) if (gnats[i].gone) gnats.splice(i, 1);
    }

    function draw(now) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = now / 1000;

      c.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        const lit = .06 + .94 * world.light(m.x, m.y) ** .8, flash = .3 + .7 * Math.abs(Math.sin(t * m.f + m.ph)) ** 4;
        const a = lit * flash * (m.z > .85 ? .22 : .5);
        if (a < .02) continue;
        const r = m.z > .85 ? 1.6 + m.s * 1.8 : .35 + m.s * .7 * (.5 + m.z);
        c.beginPath(); c.arc(m.x, m.y, r, 0, TAU);
        c.fillStyle = `rgba(255,244,214,${a.toFixed(3)})`; c.fill();
      }
      c.globalCompositeOperation = 'source-over';

      for (const g of gnats) {
        const k = Sim.depthScale(g.alt), s = g.s * Sim.MM * k, fly = g.mode === 'fly';
        c.beginPath(); c.ellipse(g.x + g.alt * 6, g.y + 1 + g.alt * 10, s * .8, s * .35, g.a, 0, TAU);
        c.fillStyle = `rgba(0,0,0,${(.22 - g.alt * .12).toFixed(3)})`; c.fill();
        c.save(); c.translate(g.x, g.y); c.rotate(g.a);
        if (fly) { c.beginPath(); c.ellipse(-s * .1, 0, s * .55, s * 1.05, 0, 0, TAU); c.fillStyle = 'rgba(200,206,212,.2)'; c.fill(); }
        else {
          c.fillStyle = 'rgba(214,220,226,.38)';
          for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(-s * .7, sg * s * .22, s * .8, s * .22, sg * .25, 0, TAU); c.fill(); }
        }
        c.beginPath(); c.ellipse(-s * .15, 0, s * .75, s * .24, 0, 0, TAU); c.fillStyle = '#1e1812'; c.fill();
        c.beginPath(); c.arc(s * .62, 0, s * .2, 0, TAU); c.fill();
        c.restore();
      }
    }

    return {
      resize, draw,
      step(now, dt) { stepMotes(now, dt); stepGnats(now, dt); },
      get gnats() { return gnats; },
    };
  };
})(window.Sim);
