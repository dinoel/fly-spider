// Shared helpers for the fly-and-spider page.
window.Sim = {};
(function (Sim) {
  'use strict';
  const DEG = Math.PI / 180, TAU = 2 * Math.PI;
  const n2 = v => v.toFixed(2);
  const mirror = d => { let k = 0; return d.replace(/-?(?:\d+\.?\d*|\.\d+)/g, m => ' ' + (k++ % 2 ? String(Math.round(-m * 1000) / 1000) : m)); };

  Sim.U = {
    DEG, TAU, n2, mirror,
    rnd: (a, b) => a + Math.random() * (b - a),
    pick: a => a[Math.floor(Math.random() * a.length)],
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    ease: t => t * t * (3 - 2 * t),
    angDiff: (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from)),
    approach: (v, target, dt, tau) => v + (target - v) * (1 - Math.exp(-dt / tau)),
    both: d => d + mirror(d),
    // A closed outline symmetric about the x axis, given as cubic segments along its y < 0 half from (x0, 0) back to the axis.
    sym: (x0, segs) => {
      const ends = [[x0, 0], ...segs.map(s => [s[4], s[5]])];
      let d = `M${x0} 0` + segs.map(s => 'C' + s.join(' ')).join('');
      for (let k = segs.length - 1; k >= 0; k--) {
        const s = segs[k], p = ends[k];
        d += `C${s[2]} ${-s[3]} ${s[0]} ${-s[1]} ${p[0]} ${-p[1]}`;
      }
      return d + 'Z';
    },
    seeded: seed => () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
  };

  /* One scale for every creature: px per millimetre on the glass. The orb is about 25 cm across. */
  Sim.MM = 3.4;

  /* Depth in front of the glass, on the scale of a flying fly's altitude: 0 on the pane, 1 in full flight. */
  Sim.WEBZ = .4;
  Sim.depthScale = z => 1 + .3 * z;
  Sim.shadow = (z, blur) => `${blur > .01 ? `blur(${n2(blur)}px) ` : ''}drop-shadow(0 0 .4px rgba(255,255,255,.5)) ` +
    `drop-shadow(${n2(z * 6)}px ${n2(1 + z * 10)}px ${n2(1.1 + z * 2.5)}px rgba(0,0,0,${n2(.34 - z * .17)}))`;
})(window.Sim);
