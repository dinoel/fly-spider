// The page: lays the scene out, runs the clock, sends in a new fly whenever the spider has caught the last one,
// and drives the panel.
(function (Sim) {
  'use strict';
  const { rnd } = Sim.U;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const sceneCv = $('scene'), webCv = $('web'), wc = webCv.getContext('2d');
  const layers = { glass: $('glass'), web: $('onweb'), air: $('air') };
  const seed = Math.random() * 1e9 | 0;

  const defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.style.position = 'absolute';
  defs.innerHTML = `<defs>${Sim.flyDefs}${Sim.spiderDefs}</defs>`;
  document.body.prepend(defs);

  const web = new Sim.Web(seed);
  const world = Sim.world = {
    now: 0, speed: 1, paused: false, flies: [], web, bounds: null,
    pointer: { x: 0, y: 0, vx: 0, vy: 0, t: 0, rt: 0, on: false },
  };
  const spider = world.spider = Sim.makeSpider(world);
  layers.web.appendChild(spider.el);
  const life = Sim.makeLife(world, $('fx'));

  let L = null, dpr = 1;
  function layout() {
    const old = L;
    L = Sim.layout(innerWidth, innerHeight);
    world.bounds = L.bounds;
    Sim.paintScene(sceneCv, L, seed);
    dpr = Math.min(1.5, devicePixelRatio || 1);
    webCv.width = Math.round(L.W * dpr); webCv.height = Math.round(L.H * dpr);
    web.build(L);
    life.resize(L);
    webKey = '';
    if (!old) return;
    const k = L.R / old.R, map = (x, y) => [L.hub[0] + (x - old.hub[0]) * k, L.hub[1] + (y - old.hub[1]) * k];
    spider.remap(map);
    world.flies.forEach(f => f.remap(map));
  }
  world.light = (x, y) => Math.exp(-Math.hypot(x - L.light[0], y - L.light[1]) / (L.R * 1.1));
  world.threatFor = () => spider.onGlass ? spider.threat : null;

  /* ── story ── */
  const stats = { caught: 0, escaped: 0, missed: 0 };
  // "a 7 mm house fly", "an 8 mm greenbottle": size 1 is a house fly of about 7 mm
  const fly = f => { const n = Math.round(7 * f.size); return `${[8, 11, 18].includes(n) ? 'an' : 'a'} ${n} mm ${f.name}`; };
  const Fly = f => { const s = fly(f); return s[0].toUpperCase() + s.slice(1); };
  const TEXT = {
    enter: f => `${Fly(f)} flew in`,
    stuck: f => `${Fly(f)} got stuck in the web`,
    tore: f => `${Fly(f)} tore through the web and flew on`,
    escaped: f => `${Fly(f)} broke free of the web`,
    bitten: f => `The spider bit ${fly(f)}`,
    drop: () => 'The spider let itself down to the glass and is stalking',
    seized: f => `The spider seized ${fly(f)} right on the glass`,
    missed: () => 'The fly saw the spider coming and flew off',
    gaveup: () => 'The spider gave up and climbed back to its web',
    discard: () => 'The spider finished its meal and dropped the remains',
    gnat: () => 'A midge got stuck in the web; the spider did not stir',
  };
  world.emit = (type, f) => {
    if (type === 'bitten') stats.caught++;
    if (type === 'escaped' || type === 'tore') stats.escaped++;
    if (type === 'missed') stats.missed++;
    if (TEXT[type]) log(TEXT[type](f));
    $('caught').textContent = stats.caught; $('escaped').textContent = stats.escaped; $('missed').textContent = stats.missed;
  };
  function log(text) {
    const top = $('log').firstChild;
    if (top && top.dataset.text === text) { top.dataset.n = +top.dataset.n + 1; top.textContent = `${text} ×${top.dataset.n}`; return; }
    const li = document.createElement('li');
    li.textContent = li.dataset.text = text; li.dataset.n = 1;
    $('log').prepend(li);
    while ($('log').children.length > 4) $('log').lastChild.remove();
  }

  let spawnAt = 0;
  function spawn() {
    // Mostly house flies of 5 to 8 mm, now and then a greenbottle of 8 to 10.
    const green = Math.random() < .2, f = Sim.makeFly(world, (green ? rnd(8, 10) : rnd(5, 7.8)) / 7, green ? 'green' : 'house');
    world.flies.push(f);
    layers.air.appendChild(f.el);
    f.enter();
    world.emit('enter', f);
  }
  function keepFlies(now) {
    if (world.flies.some(f => !f.caught)) { spawnAt = 0; return; }
    if (!spawnAt) spawnAt = now + rnd(1500, 3500);
    else if (now >= spawnAt) { spawnAt = 0; spawn(); }
  }

  /* ── clock ── */
  function step(h) {
    world.now += h * 1000;
    const now = world.now;
    web.loads = [...spider.loads, ...world.flies.flatMap(f => f.loads)];
    web.setTime(now, h);
    for (const f of world.flies) f.tick(now, h);
    spider.tick(now, h);
    life.step(now, h);
    if (world.flies.some(f => f.dead)) {
      world.flies.filter(f => f.dead).forEach(f => f.el.remove());
      world.flies = world.flies.filter(f => !f.dead);
    }
    keepFlies(now);
  }
  /* The web is never still, so it is redrawn whenever it has moved; paused, only if the spider's silk has. */
  let webKey = '';
  function draw() {
    web.silk = spider.silk();
    const key = web.stepN + '|' + web.silk.map(s => s.pts.flat().map(Math.round).join()).join();
    if (key !== webKey) {
      webKey = key;
      web.update();
      wc.setTransform(1, 0, 0, 1, 0, 0);
      wc.clearRect(0, 0, webCv.width, webCv.height);
      wc.setTransform(dpr, 0, 0, dpr, 0, 0);
      web.draw(wc);
    }
    for (const c of [...world.flies, spider]) {
      const host = layers[c.plane];
      if (c.el.parentNode !== host) host.appendChild(c.el);
      c.render();
    }
    if (spider.el !== spider.el.parentNode.lastChild) spider.el.parentNode.appendChild(spider.el);   // the spider is on top of what it holds
    life.draw(world.now);
  }
  world.advance = ms => { for (let t = 0; t < ms; t += 1000 / 60) step(1 / 60); draw(); };
  let last = performance.now();
  function frame(t) {
    requestAnimationFrame(frame);
    const real = Math.min(.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (!world.paused) {
      let left = real * world.speed;
      while (left > 1e-6) { const h = Math.min(left, 1 / 60); left -= h; step(h); }
    }
    draw();
  }

  /* ── input ── */
  addEventListener('pointermove', e => {
    const M = world.pointer, rt = performance.now(), dt = Math.max(.008, (rt - M.rt) / 1000);
    if (M.on && rt - M.rt < 200) { M.vx = M.vx * .5 + (e.clientX - M.x) / dt * .5; M.vy = M.vy * .5 + (e.clientY - M.y) / dt * .5; }
    else M.vx = M.vy = 0;
    M.x = e.clientX; M.y = e.clientY; M.t = world.now; M.rt = rt; M.on = true;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { world.pointer.on = false; });
  addEventListener('pointerdown', e => {
    if (e.target.closest('#hud')) return;
    const x = e.clientX, y = e.clientY, near = world.flies.filter(f => f.free && Math.hypot(f.x - x, f.y - y) < 110);
    if (near.length) return near.forEach(f => f.startle(x, y));
    if (web.touches(x, y, 12)) { web.poke(x, y, 2.5); web.event(x, y, .9, null); log('Something tugged at the web'); }
  });
  const setPaused = p => {
    world.paused = p;
    $('pause').setAttribute('aria-pressed', String(p));
    $('pause').title = p ? 'Resume (space)' : 'Pause (space)';
  };
  const setSpeed = s => {
    world.speed = s;
    document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === s)));
  };
  const addFly = () => { if (world.flies.filter(f => f.free).length < 6) spawn(); };
  $('pause').addEventListener('click', () => setPaused(!world.paused));
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('add').addEventListener('click', addFly);
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); setPaused(!world.paused); }
    else if (e.code === 'KeyH') $('hud').classList.toggle('hidden');
    else if (e.key === '+' || e.code === 'NumpadAdd') addFly();
    else if (e.key === '1' || e.key === '3') setSpeed(+e.key);
    else if (e.key === '0') setSpeed(10);
  });
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 150); });

  layout();
  spider.place();
  spawn();
  requestAnimationFrame(frame);
})(window.Sim);
