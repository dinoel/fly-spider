// The window: a garden far out of focus behind the pane, dust on the glass, and the painted frame
// in whose top left corner the web hangs. Painted once per size, onto the bottom canvas.
(function (Sim) {
  'use strict';
  const { clamp, seeded, TAU } = Sim.U;

  Sim.layout = (W, H) => {
    const FT = Math.round(clamp(H * .055, 30, 58)), FL = Math.round(clamp(W * .032, 30, 58));
    const R = Math.round(clamp(Math.min((H - FT) * .42, (W - FL) * .3), 140, 460));
    const hub = [FL + R * 1.02, FT + R * .9];
    return { W, H, FT, FL, R, hub, light: [hub[0] + R * .6, hub[1] - R * .38], bounds: { x0: FL, y0: FT, x1: W, y1: H } };
  };

  Sim.paintScene = (cv, L, seed) => {
    const { W, H, FL, FT } = L, M = Math.max(W, H), [lx, ly] = L.light;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rand = seeded(seed), r = (a, b) => a + rand() * (b - a), pick = a => a[Math.floor(rand() * a.length)];
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    const blob = (x, y, rx, ry, rot, color, alpha) => {
      c.globalAlpha = alpha; c.fillStyle = color;
      c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill();
    };
    const radial = (x, y, rad, stops) => {
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      c.fillStyle = g; c.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
    };

    /* the garden */
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#a3b6ad'); g.addColorStop(.2, '#748e66'); g.addColorStop(.52, '#405d33'); g.addColorStop(1, '#1b2b17');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.filter = `blur(${Math.round(M * .04)}px)`;
    for (let k = 0; k < 24; k++) {
      const rx = r(.08, .24) * M;
      blob(r(-.1, 1.1) * W, r(.12, 1.15) * H, rx, rx * r(.45, 1), r(-.5, .5), pick(['#1d331a', '#243e1e', '#2d4b25', '#385a2c', '#152613']), r(.55, .95));
    }
    c.filter = `blur(${Math.round(M * .022)}px)`;
    for (let k = 0; k < 14; k++) blob(r(-.05, 1.05) * W, r(-.05, .38) * H, r(.04, .12) * M, r(.03, .08) * M, r(-.6, .6), pick(['#d7e3df', '#c5d6d3', '#e4ebe1']), r(.35, .7));
    for (let k = 0; k < 16; k++) {
      const rx = r(.05, .14) * M;
      blob(r(.1, 1.05) * W, r(.25, 1) * H, rx, rx * r(.3, .6), r(-.4, .4), pick(['#1a2e17', '#21391c']), r(.6, .9));
    }
    c.filter = `blur(${Math.round(M * .014)}px)`;
    for (let k = 0; k < 46; k++) {
      const near = rand() < .6, a = r(0, TAU), d = Math.abs(gauss()) * L.R * 1.6;
      const x = near ? lx + Math.cos(a) * d : r(0, W), y = near ? ly + Math.sin(a) * d * .8 : r(.1, .8) * H;
      blob(x, y, r(.012, .045) * M, r(.008, .03) * M, r(0, TAU), pick(['#9fbd5a', '#c3d57a', '#7fa24a', '#dfe39a']), r(.2, .5));
    }
    c.filter = 'none'; c.globalAlpha = 1;

    /* the sun through the leaves, and the discs of light it throws out of focus */
    c.globalCompositeOperation = 'screen';
    radial(lx, ly, L.R * 1.6, [[0, 'rgba(255,246,222,.85)'], [.07, 'rgba(255,240,206,.55)'], [.3, 'rgba(255,226,170,.2)'], [1, 'rgba(255,220,160,0)']]);
    c.filter = 'blur(.9px)';
    for (let k = 0; k < 120; k++) {
      const near = rand() < .7, a = r(0, TAU), d = Math.abs(gauss()) * L.R * 1.5;
      const x = near ? lx + Math.cos(a) * d : r(0, W), y = near ? ly + Math.sin(a) * d * .75 : r(0, .75) * H;
      const rad = 3 + Math.pow(rand(), 2.3) * M * .028, b = .12 + .88 * Math.exp(-Math.hypot(x - lx, y - ly) / (L.R * 1.3));
      const [R_, G_, B_] = pick([[255, 246, 214], [238, 250, 200], [255, 234, 188], [226, 242, 255]]);
      const col = a => `rgba(${R_},${G_},${B_},${a})`;
      radial(x, y, rad, [[0, col(.09 * b)], [.72, col(.15 * b)], [.9, col(.3 * b)], [1, col(0)]]);
    }
    c.filter = 'none';
    c.globalCompositeOperation = 'source-over';

    /* the pane: a faint reflection, dust, the ghost of a wipe */
    g = c.createLinearGradient(W * .15, 0, W * .6, H);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,.035)'); g.addColorStop(.55, 'rgba(255,255,255,.05)'); g.addColorStop(.62, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.filter = 'blur(10px)';
    c.strokeStyle = 'rgba(255,255,255,.022)'; c.lineWidth = 34;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(r(.3, .9) * W, r(.3, .9) * H, r(.15, .35) * M, r(0, TAU), r(0, TAU) + r(.6, 1.4)); c.stroke(); }
    c.filter = 'none';
    for (let k = 0; k < 420; k++) {
      const lit = rand() < .8;
      c.fillStyle = lit ? `rgba(255,252,238,${r(.05, .26)})` : `rgba(40,34,24,${r(.08, .2)})`;
      c.beginPath(); c.arc(r(FL, W), r(FT, H), Math.pow(rand(), 2) * 1.1 + .25, 0, TAU); c.fill();
    }
    /* what a window collects: rain dried on the outside, a drip or two, a greasy hand, and fly specks */
    for (let k = 0; k < 240; k++) {
      const x = r(FL, W), y = FT + (H - FT) * Math.sqrt(rand()), rad = Math.pow(rand(), 2.2) * 5.5 + 1;
      c.beginPath(); c.arc(x, y, rad, 0, TAU);
      c.fillStyle = `rgba(232,228,208,${r(.012, .035).toFixed(3)})`; c.fill();
      c.strokeStyle = `rgba(246,242,224,${r(.035, .09).toFixed(3)})`; c.lineWidth = r(.4, .9); c.stroke();
    }
    for (let k = 0; k < 6; k++) {
      let x = r(FL + 40, W), y = r(FT, H * .55);
      const len = r(50, 240);
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < len; s += 5) { x += r(-1, 1) + (rand() < .05 ? r(-4, 4) : 0); y += 5; c.lineTo(x, y); }
      c.strokeStyle = 'rgba(236,232,212,.045)'; c.lineWidth = r(1.6, 3.2); c.stroke();
      c.strokeStyle = 'rgba(250,246,230,.05)'; c.lineWidth = .6; c.stroke();
      c.beginPath(); c.ellipse(x, y + 2, r(2, 3.5), r(2.6, 4.4), 0, 0, TAU); c.fillStyle = 'rgba(236,232,212,.06)'; c.fill();
    }
    {
      c.save(); c.translate(r(.55, .85) * W, r(.5, .8) * H); c.rotate(r(-.7, .5));
      c.filter = 'blur(9px)'; blob(0, 26, 34, 22, 0, 'rgba(255,252,240,1)', .035); c.globalAlpha = 1; c.filter = 'blur(.6px)';
      c.strokeStyle = 'rgba(255,252,240,.05)'; c.lineWidth = .7;
      [[-22, -16, 7, 10], [-8, -26, 7.5, 11], [7, -27, 7.5, 11], [21, -19, 6.5, 9.5]].forEach(([fx, fy, rx, ry]) => {
        if (rand() < .25) return;
        for (let q = 1; q < 6; q++) { c.beginPath(); c.ellipse(fx, fy, rx * q / 5.5, ry * q / 5.5, r(-.2, .2), r(0, 1), r(4, 6.3)); c.stroke(); }
      });
      c.restore(); c.filter = 'none';
    }
    const speck = (x, y) => {
      const rad = r(.4, 1.15);
      c.beginPath(); c.ellipse(x, y, rad, rad * r(.65, 1.35), r(0, TAU), 0, TAU);
      c.fillStyle = rand() < .72 ? `rgba(36,24,12,${r(.5, .85).toFixed(2)})` : `rgba(150,118,68,${r(.3, .55).toFixed(2)})`; c.fill();
    };
    for (let k = 0; k < 10; k++) {
      const cx = r(FL + 20, W - 20), cy = r(FT + 20, H - 20), spread = r(5, 36);
      for (let j = Math.floor(r(3, 28)); j > 0; j--) { const a = r(0, TAU), d = Math.abs(gauss()) * spread; speck(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
    }
    for (let k = 0; k < 50; k++) speck(r(FL, W), r(FT, H));
    radial(W * .55, H * .5, M * .75, [[0, 'rgba(0,0,0,0)'], [.6, 'rgba(0,0,0,0)'], [1, 'rgba(6,10,4,.4)']]);

    /* the frame stands proud of the glass and shades its edge */
    const shade = (x, y, w, h, x1, y1) => {
      const s = c.createLinearGradient(x, y, x1, y1);
      s.addColorStop(0, 'rgba(8,12,6,.46)'); s.addColorStop(.35, 'rgba(8,12,6,.16)'); s.addColorStop(1, 'rgba(8,12,6,0)');
      c.fillStyle = s; c.fillRect(x, y, w, h);
    };
    shade(FL, FT, 26, H - FT, FL + 26, FT);
    shade(FL, FT, W - FL, 26, FL, FT + 26);

    const bead = 8;
    const face = (pts, x0, y0, x1, y1, stops) => {
      const f = c.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([o, col]) => f.addColorStop(o, col));
      c.fillStyle = f; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    };
    face([[0, 0], [W, 0], [W, FT - bead], [FL - bead, FT - bead]], 0, 0, 0, FT - bead, [[0, '#f5f3ee'], [.6, '#ebe7df'], [1, '#d9d3c8']]);
    face([[0, 0], [FL - bead, FT - bead], [FL - bead, H], [0, H]], 0, 0, FL - bead, 0, [[0, '#f2efe9'], [.6, '#e7e2d9'], [1, '#d3cdc1']]);
    face([[FL - bead, FT - bead], [W, FT - bead], [W, FT], [FL, FT]], 0, FT - bead, 0, FT, [[0, '#f7f5f0'], [.25, '#e4dfd5'], [1, '#bdb5a6']]);
    face([[FL - bead, FT - bead], [FL, FT], [FL, H], [FL - bead, H]], FL - bead, 0, FL, 0, [[0, '#f4f1eb'], [.25, '#e0dbd1'], [1, '#b8b09f']]);
    c.globalAlpha = .5;
    for (let k = 0; k < 90; k++) {
      c.fillStyle = rand() < .5 ? 'rgba(255,255,255,.18)' : 'rgba(90,80,60,.05)';
      const t = r(0, 1);
      if (k % 2) c.fillRect(r(0, W), t * (FT - bead - 2) + 1, r(20, 160), .6);
      else c.fillRect(t * (FL - bead - 2) + 1, r(0, H), .6, r(20, 160));
    }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(90,78,60,.2)'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(FL - bead, FT - bead); c.moveTo(FL - bead, FT - bead); c.lineTo(FL, FT); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(FL - bead, FT - bead + .5); c.lineTo(W, FT - bead + .5); c.moveTo(FL - bead + .5, FT - bead); c.lineTo(FL - bead + .5, H); c.stroke();
    c.fillStyle = '#2b2e29';
    c.fillRect(FL - 1.4, FT - 1.4, 1.8, H); c.fillRect(FL - 1.4, FT - 1.4, W, 1.8);

    /* old paint: hairline cracks, a few chips down to the primer, grime in the rebate and dirt in the corner */
    c.lineWidth = .5; c.lineCap = 'round';
    for (let k = 0; k < 70; k++) {
      const top = rand() < .55;
      let x = top ? r(0, W) : r(2, FL - bead - 2), y = top ? r(2, FT - bead - 2) : r(0, H);
      c.beginPath(); c.moveTo(x, y);
      for (let s = Math.floor(r(2, 7)); s > 0; s--) {
        x += top ? r(2, 9) * (rand() < .5 ? -1 : 1) : r(-2, 2); y += top ? r(-2, 2) : r(2, 9) * (rand() < .5 ? -1 : 1);
        c.lineTo(clamp(x, 0, W), clamp(y, 0, H));
      }
      c.strokeStyle = `rgba(118,104,82,${r(.12, .3).toFixed(2)})`; c.stroke();
    }
    for (let k = 0; k < 7; k++) {
      const top = rand() < .5, x = top ? r(FL, W) : r(4, FL - bead - 4), y = top ? r(4, FT - bead - 4) : r(FT, H), s = r(1.5, 4.5);
      c.beginPath();
      for (let m = 0; m < 7; m++) { const a = m / 7 * TAU, rr = s * r(.5, 1); m ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .7) : c.moveTo(x + rr, y); }
      c.closePath(); c.fillStyle = pick(['#c9bb9b', '#b7a684', '#9d8f78']); c.fill();
      c.strokeStyle = 'rgba(80,68,50,.35)'; c.lineWidth = .5; c.stroke();
    }
    c.filter = 'blur(2.5px)';
    for (let k = 0; k < 60; k++) {
      const top = rand() < .5, x = top ? r(FL, W) : FL + r(-1, 4), y = top ? FT + r(-1, 4) : r(FT, H);
      blob(x, y, r(3, 16), r(1, 2.6), top ? 0 : Math.PI / 2, 'rgb(62,54,40)', r(.08, .22));
    }
    c.filter = 'blur(14px)';
    for (let k = 0; k < 26; k++) {   // the paint has yellowed unevenly and gone grey where hands and rain reach it
      const top = rand() < .6, x = top ? r(0, W) : r(0, FL), y = top ? r(0, FT) : r(0, H);
      blob(x, y, r(20, 90), r(6, 18), top ? 0 : Math.PI / 2, pick(['rgb(176,150,96)', 'rgb(120,112,96)', 'rgb(150,136,104)']), r(.05, .12));
    }
    c.filter = 'blur(6px)';
    blob(FL + 6, FT + 6, 26, 18, .8, 'rgb(58,50,38)', .3);
    c.filter = 'none'; c.globalAlpha = 1;

    /* in the corner, an old cobweb gone grey with dust, with a dried fly still in it */
    const corner = (x, y) => [FL + x, FT + y];
    c.filter = 'blur(7px)';
    c.fillStyle = 'rgba(196,190,172,.1)';
    c.beginPath(); c.moveTo(FL, FT); c.lineTo(FL + 130, FT); c.quadraticCurveTo(FL + 50, FT + 40, FL, FT + 110); c.fill();
    c.filter = 'none';
    // a tangle, not a fan: knots hung between the frame and each other, the threads sagging and furred with dust
    const knots = [];
    for (let k = 0; k < 14; k++) knots.push(corner(r(0, 190) * Math.pow(rand(), 1.4), r(0, 160) * Math.pow(rand(), 1.4)));
    for (let k = 0; k < 12; k++) knots.push(rand() < .55 ? corner(r(0, 200), r(-1, 1)) : corner(r(-1, 1), r(0, 170)));
    const threads = [];
    c.lineCap = 'round';
    for (let k = 0; k < 90; k++) {
      const a = knots[Math.floor(rand() * knots.length)], b = knots[Math.floor(rand() * knots.length)], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < 8 || d > 110) continue;
      const cx = (a[0] + b[0]) / 2 + r(-.1, .1) * d, cy = (a[1] + b[1]) / 2 + d * r(.03, .22);
      threads.push([a, [cx, cy], b]);
      c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx, cy, b[0], b[1]);
      const near = 1 - clamp(Math.hypot(cx - FL, cy - FT) / 190, 0, 1);
      c.strokeStyle = `rgba(206,200,182,${(.07 + near * .22 * rand()).toFixed(3)})`; c.lineWidth = r(.35, .9); c.stroke();
    }
    c.filter = 'blur(.9px)';
    for (let k = 0; k < 70; k++) {
      const [a, m, b] = threads[Math.floor(rand() * threads.length)], t = r(.1, .9), u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * m[1] + t * t * b[1];
      blob(x, y, r(.8, 3.2), r(.6, 2), r(0, TAU), pick(['rgb(176,168,150)', 'rgb(128,120,104)', 'rgb(204,198,180)', 'rgb(90,84,72)']), r(.25, .6));
    }
    c.filter = 'none'; c.globalAlpha = 1;
    {
      // a house fly that died here last summer, dry and grey, wings still on, half wrapped
      const [fx, fy] = corner(r(30, 50), r(24, 40)), s = Sim.MM * .9;
      c.save(); c.translate(fx, fy); c.rotate(r(0, TAU));
      c.fillStyle = 'rgba(200,204,206,.2)'; c.strokeStyle = 'rgba(60,52,44,.3)'; c.lineWidth = .3;
      for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(-s * 1.1, sg * s * .95, s * 2, s * .72, sg * .45, 0, TAU); c.fill(); c.stroke(); }
      c.strokeStyle = 'rgba(40,32,24,.4)'; c.lineWidth = .3;
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(-s * .2, sg * s * .3); c.lineTo(-s * 2.6, sg * s * 1.5); c.stroke(); }
      c.strokeStyle = 'rgba(46,38,30,.8)'; c.lineWidth = .5;
      c.beginPath();
      for (const sg of [-1, 1]) for (const x of [.5, 0, -.5]) { c.moveTo(x * s, sg * s * .4); c.quadraticCurveTo((x + .3) * s, sg * s * 1.4, (x + .1) * s, sg * s * .9); }
      c.stroke();
      c.beginPath(); c.ellipse(-s * 1, 0, s * 1.3, s * .85, 0, 0, TAU); c.fillStyle = '#6a5c48'; c.fill();
      c.beginPath(); c.ellipse(s * .35, 0, s * .8, s * .72, 0, 0, TAU); c.fillStyle = '#4e4840'; c.fill();
      c.beginPath(); c.ellipse(s * 1.3, 0, s * .45, s * .62, 0, 0, TAU); c.fillStyle = '#5a3a2a'; c.fill();
      c.strokeStyle = 'rgba(226,222,208,.3)'; c.lineWidth = .3;
      c.beginPath(); for (let k = 0; k < 3; k++) { const x = r(-2.2, 1.6) * s; c.moveTo(x - s * .5, -s * 1.2); c.lineTo(x + s * .5, s * 1.2); } c.stroke();
      c.restore();
    }

    /* grain, so the gradients do not band */
    const tile = document.createElement('canvas'); tile.width = tile.height = 128;
    const tc = tile.getContext('2d'), img = tc.createImageData(128, 128);
    for (let k = 0; k < img.data.length; k += 4) { const v = rand() * 255; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 9; }
    tc.putImageData(img, 0, 0);
    c.fillStyle = c.createPattern(tile, 'repeat'); c.fillRect(0, 0, W, H);
  };
})(window.Sim);
