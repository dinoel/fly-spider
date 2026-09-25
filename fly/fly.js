// The fly watermark: house flies on the screen glass, seen from above, a swatter to hit them with and a rag to wipe up after.
// Include it on any page with <script src="fly.js"></script>; it lives in its own shadow root, so page styles do not reach it.
// F hides the flies, Esc puts the tool down. Elements with data-fly-swatter or data-fly-rag take up that tool; without them the
// script adds two small round buttons and a settings button, bottom left by default: data-button="right" or data-button="none"
// on the script tag changes that. The settings (how many flies, how hard they are to swat, sound) are kept per site;
// data-flies="3" and data-level="easy|normal|hard" set where they start.
// It is heard as well as seen: the buzz of the wings, the swatter's swish and slap, the rag on the glass. data-sound="off" starts it silent.
(function () {
  'use strict';
  if (window.flyWatermark || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.flyWatermark = {};
  const scriptTag = document.currentScript;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  function start() {

    const NS = 'http://www.w3.org/2000/svg';
    const S = 1.1;                    // px per unit: the body is 27 units, the size of a real house fly
    const BOX = 64, HALF = BOX * S / 2;
    const DEG = Math.PI / 180, TAU = 2 * Math.PI;
    const WING_REST = 21;             // degrees each folded wing points out from the body axis
    const THR = 3.2, SETTLE = .8;     // how far a foot may lag behind before it steps: walking, standing
    const STRIKE = 130, SWAT_TILT = 28; // ms from the click until the swatter meets the glass; degrees the swatter leans
    /* The swing, in ms after the click: wind-up, the swing down, flat on the glass, then the rebound back into the hand.
       Heights are px towards the viewer; DEPTH is how far the viewer's eye is from the glass. */
    const T_WIND = 70, T_HOLD = 18, T_BACK = 300, T_END = STRIKE + T_HOLD + T_BACK;
    const WIND = { z: 120, phi: 22, s: 26, bow: 5, reach: -.25 };   // how far the wind-up takes it back and up
    const Z_UP = 150, PHI_UP = 38, Z_HAND = 175, REACH_UP = 192, REACH_HIT = 215, DEPTH = 900;
    /* How hard the flies are to swat. see: how likely one is to see the swatter coming down (times a chance set by what it
       is doing); react: ms after the click that it is off, often too late on easy, while the swatter is still being wound
       up on hard; swoop: px/s at which a swatter swung at it alarms it, and shy: how likely it goes then; startle: how
       likely a slap close by sends it off; hop: how restless it is. */
    const LEVELS = {
      easy: { see: .35, react: [T_WIND + 15, T_WIND + 45], swoop: 1000, shy: .15, startle: .25, hop: 1 },
      normal: { see: 1, react: [T_WIND - 5, T_WIND + 15], swoop: 700, shy: .35, startle: .55, hop: 1 },
      hard: { see: 1.5, react: [40, 80], swoop: 450, shy: .6, startle: .85, hop: 3 },
    };
    const MAX_FLIES = 8;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const ease = t => t * t * (3 - 2 * t);
    const n2 = v => v.toFixed(2);
    const angDiff = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
    const approach = (v, target, dt, tau) => v + (target - v) * (1 - Math.exp(-dt / tau));
    let skew = 0;                     // fly.advance moves the flies' time ahead of the page's
    const clock = () => performance.now() + skew;
    const mirror = d => { let k = 0; return d.replace(/-?(?:\d+\.?\d*|\.\d+)/g, m => ' ' + (k++ % 2 ? String(Math.round(-m * 1000) / 1000) : m)); };
    const both = d => d + mirror(d);

    /* The settings: what the page's script tag asks for, unless the user has chosen otherwise on this site. */
    const STORE = 'flyWatermark.settings';
    const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } })();
    const asked = (scriptTag && scriptTag.dataset) || {};
    const settings = {
      level: LEVELS[saved.level] ? saved.level : LEVELS[asked.level] ? asked.level : 'normal',
      flies: clamp(Math.round(+saved.flies || +asked.flies || 1), 1, MAX_FLIES),
      sound: typeof saved.sound === 'boolean' ? saved.sound : asked.sound !== 'off',
    };
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* private mode: not kept */ } };
    const lv = () => LEVELS[settings.level];

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
    // The underside, shown when the fly lies on its back: plates of the abdomen and the bases of the legs.
    const STERNITES = [[-6.2, 1.5], [-8.6, 1.8], [-11, 1.7], [-13.2, 1.3]]
      .map(([x, ry]) => `<ellipse cx="${x}" cy="0" rx=".95" ry="${ry}"/>`).join('');
    const COXAE = [[5, 2.4, 1.3, .9], [2, 3.4, 1.4, 1], [-1, 3, 1.5, 1.1]]
      .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/><ellipse cx="${x}" cy="${-y}" rx="${rx}" ry="${ry}"/>`).join('');

    // Gradients every fly shares, kept apart from the flies so that one flying off does not take them with it.
    const FLY_DEFS = `
      <radialGradient id="flyEye" cx=".62" cy=".4" r=".75"><stop offset="0" stop-color="#a64c34"/><stop offset=".5" stop-color="#6c2618"/><stop offset="1" stop-color="#33100a"/></radialGradient>
      <radialGradient id="flyThorax" cx=".6" cy=".5" r=".65"><stop offset="0" stop-color="#95958f"/><stop offset="1" stop-color="#474744"/></radialGradient>
      <radialGradient id="flyAbdomen" cx=".62" cy=".5" r=".62"><stop offset="0" stop-color="#a8966d"/><stop offset=".6" stop-color="#6e6047"/><stop offset="1" stop-color="#3a3226"/></radialGradient>
      <linearGradient id="flySheen"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".4" stop-color="#d8c6ff" stop-opacity=".17"/>
        <stop offset=".7" stop-color="#b6f4dc" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>
      ${fanGrad('flyBeatL', -1)}${fanGrad('flyBeatR', 1)}
      <radialGradient id="flyBellyTh" cx=".55" cy=".5" r=".65"><stop offset="0" stop-color="#8f8a80"/><stop offset="1" stop-color="#57534c"/></radialGradient>
      <radialGradient id="flyBellyAbd" cx=".6" cy=".5" r=".62"><stop offset="0" stop-color="#b8a67f"/><stop offset=".7" stop-color="#85765a"/><stop offset="1" stop-color="#4f4535"/></radialGradient>`;
    const FLY_SVG = `<svg viewBox="${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}" focusable="false" shape-rendering="geometricPrecision">
    <g class="fly-body">
      <g class="fly-legs"></g>
      <path d="${ABDOMEN}" fill="url(#flyAbdomen)"/>
      <path d="M-5.2 0L-14.3 0" stroke="#2a241b" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>
      <path d="${SEGMENTS}" fill="none" stroke="#231c14" stroke-opacity=".45" stroke-width=".45"/>
      <g fill="#2a2218" fill-opacity=".35">${spots}</g>
      <g fill="#ece6d4" fill-opacity=".85" stroke="#6b5f45" stroke-opacity=".35" stroke-width=".2"><ellipse cx="-3.3" cy="-4.1" rx="2" ry="1.3"/><ellipse cx="-3.3" cy="4.1" rx="2" ry="1.3"/></g>
      <path d="${THORAX}" fill="url(#flyThorax)"/>
      <path d="${both(STRIPES)}" fill="none" stroke="#1d1c1a" stroke-opacity=".72" stroke-width=".85" stroke-linecap="round"/>
      <path d="${SCUTELLUM}" fill="#6a6964"/>
      <path class="fly-bristles" d="${both(BRISTLES)}" fill="none" stroke="#11100f" stroke-opacity=".85" stroke-width=".26" stroke-linecap="round"/>
      <g class="fly-belly">
        <path d="${ABDOMEN}" fill="url(#flyBellyAbd)"/>
        <g fill="#8f7f60" fill-opacity=".55" stroke="#3f3526" stroke-opacity=".4" stroke-width=".25">${STERNITES}</g>
        <path d="${THORAX}" fill="url(#flyBellyTh)"/>
        <path d="M6.3 0L-3.5 0" stroke="#34322d" stroke-opacity=".5" stroke-width=".35"/>
        <g fill="#4a4238" fill-opacity=".8">${COXAE}</g>
      </g>
      <g class="fly-head">
        <path d="${HEAD}" fill="#2c2825"/>
        <path d="${EYE}" fill="url(#flyEye)"/><path d="${mirror(EYE)}" fill="url(#flyEye)"/>
        <path d="M7.9-1.4C8.7-1.1 10-1 11-1.2L11 1.2C10 1 8.7 1.1 7.9 1.4Z" fill="#241713"/>
        <path d="M11.4-2.6C11.9-1.6 12-.6 11.9 0C12 .6 11.9 1.6 11.4 2.6" fill="none" stroke="#d8cfae" stroke-opacity=".6" stroke-width=".45"/>
        <g fill="#c09a82" fill-opacity=".8"><circle cx="7.9" cy="0" r=".2"/><circle cx="8.4" cy="-.35" r=".2"/><circle cx="8.4" cy=".35" r=".2"/></g>
        <path d="M11.9-.5L12.7-.8M11.9.5L12.7.8" stroke="#5c3d24" stroke-width=".35" stroke-linecap="round"/>
        <g fill="#fff" fill-opacity=".3"><ellipse cx="10" cy="-3.7" rx="1" ry=".42" transform="rotate(-18 10 -3.7)"/><ellipse cx="10" cy="3.7" rx="1" ry=".42" transform="rotate(18 10 3.7)"/></g>
        <g class="fly-belly">
          <ellipse cx="9.8" cy="0" rx="1.9" ry="1.7" fill="#a39c8c" fill-opacity=".85"/>
          <path d="M8.6 0L12.3 0" stroke="#6b5234" stroke-width="1.3" stroke-linecap="round"/>
          <ellipse cx="12.9" cy="0" rx="1" ry="1.7" fill="#b8996a" stroke="#6b5234" stroke-width=".25"/>
        </g>
      </g>
      <path class="fly-fan" d="${fanPath(-1)}" fill="url(#flyBeatL)" opacity="0"/>
      <path class="fly-fan" d="${fanPath(1)}" fill="url(#flyBeatR)" opacity="0"/>
      ${wingMarkup}${wingMarkup}
      <g class="fly-over"></g>
    </g></svg>`;
    const FILTER = 'drop-shadow(0 0 .4px rgba(255,255,255,.6)) drop-shadow(0 1px 1.1px rgba(0,0,0,.3))';
    // One host on <html>, above everything on the page; frameworks that redraw <body> leave it alone.
    const host = document.createElement('fly-watermark');
    host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none';
    const root = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);
    const sheet = (target, css) => {
      try {
        const s = new CSSStyleSheet();
        s.replaceSync(css);
        target.adoptedStyleSheets = [...target.adoptedStyleSheets, s];
      } catch (e) {
        const el = document.createElement('style');
        el.textContent = css;
        (target === document ? document.head || document.documentElement : target).appendChild(el);
      }
    };
    sheet(root, `.fly{position:fixed;left:0;top:0;width:${BOX * S}px;height:${BOX * S}px;z-index:2;pointer-events:none;will-change:transform;filter:${FILTER}}
      .fly svg{display:block;width:100%;height:100%;overflow:visible}
      .fly .fly-belly{display:none} .fly.fly-dead .fly-belly{display:inline} .fly.fly-dead .fly-bristles{display:none}
      #flySmear{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:1;pointer-events:none;overflow:visible}
      #flySwatter{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:3;pointer-events:none;display:none}
      #flySwatter svg{display:block;width:100%;height:100%;overflow:visible}
      #flySwatter.on{display:block}
      #flyRag{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:3;pointer-events:none;display:none}
      #flyRag svg{display:block;width:100%;height:100%;overflow:visible}
      #flyRag.on{display:block}
      .tool-btn{position:fixed;left:14px;bottom:14px;z-index:4;width:38px;height:38px;padding:0;border-radius:50%;border:1px solid rgba(0,0,0,.14);
        background:#fff;color:#444;box-shadow:0 2px 8px rgba(0,0,0,.2);display:grid;place-items:center;cursor:pointer;pointer-events:auto;opacity:.55;transition:opacity .15s,background .15s}
      .tool-btn.second{left:60px}
      .tool-btn.third{left:106px;bottom:19px;width:28px;height:28px;opacity:.4}
      .tool-btn.right{left:auto;right:14px} .tool-btn.right.second{right:60px} .tool-btn.right.third{right:106px}
      .tool-btn:hover,.tool-btn:focus-visible,.tool-btn[aria-pressed="true"],.tool-btn[aria-expanded="true"]{opacity:1}
      .tool-btn[aria-pressed="true"]{background:#ea5b0c;border-color:#ea5b0c;color:#fff}
      .tool-btn svg{width:20px;height:20px;display:block}
      .tool-btn.third svg{width:15px;height:15px}
      .fly-settings{position:fixed;left:14px;bottom:60px;z-index:5;pointer-events:auto;cursor:default;box-sizing:border-box;min-width:212px;padding:10px 12px;
        display:grid;gap:8px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#333;box-shadow:0 6px 20px rgba(0,0,0,.2);
        font:12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif}
      .fly-settings.right{left:auto;right:14px}
      .fly-settings[hidden]{display:none}
      .fly-settings .row{display:flex;align-items:center;justify-content:space-between;gap:14px}
      .fly-settings button{font:inherit;color:inherit;background:#fff;border:0;margin:0;padding:4px 8px;cursor:pointer}
      .fly-settings button:disabled{opacity:.35;cursor:default}
      .fly-settings button:focus-visible{outline:2px solid #ea5b0c;outline-offset:1px}
      .fly-settings .seg{display:flex;border:1px solid rgba(0,0,0,.15);border-radius:7px;overflow:hidden}
      .fly-settings .seg button+button{border-left:1px solid rgba(0,0,0,.1)}
      .fly-settings .step{display:flex;align-items:center;gap:3px}
      .fly-settings .step button{width:24px;height:24px;padding:0;border:1px solid rgba(0,0,0,.15);border-radius:7px;font-size:14px;line-height:1}
      .fly-settings output{min-width:20px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}
      .fly-settings .toggle{min-width:46px;border:1px solid rgba(0,0,0,.15);border-radius:7px}
      .fly-settings button[aria-pressed="true"],.fly-settings button[aria-checked="true"]{background:#ea5b0c;color:#fff}`);
    // While a tool is out the pointer is hidden, and a finger rubs or swats instead of scrolling the page.
    sheet(document, 'html.fly-tool,html.fly-tool *{cursor:none!important;touch-action:none!important}');
    const sharedDefs = document.createElementNS(NS, 'svg');
    sharedDefs.setAttribute('width', '0'); sharedDefs.setAttribute('height', '0'); sharedDefs.setAttribute('aria-hidden', 'true');
    sharedDefs.style.position = 'absolute';
    sharedDefs.innerHTML = `<defs>${FLY_DEFS}</defs>`;
    root.appendChild(sharedDefs);

    /* The swatter, drawn in page coordinates: a rigid mesh head, a bending handle, and their shadows on the glass. */
    const swatter = document.createElement('div');
    swatter.id = 'flySwatter';
    swatter.setAttribute('aria-hidden', 'true');
    swatter.innerHTML = `<svg focusable="false">
      <defs>
        <linearGradient id="flySwatPlastic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f58a45"/><stop offset=".5" stop-color="#ea5b0c"/><stop offset="1" stop-color="#c94a07"/></linearGradient>
        <pattern id="flySwatHoles" width="7" height="7" patternUnits="userSpaceOnUse" x="-31.5" y="-35"><rect x="1.2" y="1.2" width="4.6" height="4.6" rx=".8" fill="#000"/></pattern>
        <mask id="flySwatMesh" maskUnits="userSpaceOnUse" x="-45" y="-50" width="90" height="115">
          <rect x="-38" y="-43" width="76" height="86" rx="16" fill="#fff"/>
          <rect x="-31.5" y="-35" width="63" height="70" rx="9" fill="url(#flySwatHoles)"/>
          <path d="M0-36V36M-32 0H32" stroke="#fff" stroke-width="3"/>
          <path d="M-14 41L14 41L4.5 60L-4.5 60Z" fill="#fff"/>
        </mask>
        <g id="flySwatHead">
          <rect x="-38" y="-43" width="76" height="86" rx="16" fill="url(#flySwatPlastic)" mask="url(#flySwatMesh)"/>
          <rect x="-37.2" y="-42.2" width="74.4" height="84.4" rx="15.3" fill="none" stroke="#b3410a" stroke-width="1.6"/>
          <path d="M-14 41L14 41L4.5 60L-4.5 60Z" fill="url(#flySwatPlastic)"/>
        </g>
        <g id="flySwatShade"><rect x="-38" y="-43" width="76" height="86" rx="16" fill="#000" mask="url(#flySwatMesh)"/><path d="M-14 41L14 41L4.5 60L-4.5 60Z" fill="#000"/></g>
        <filter id="flySwatBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <g class="sw-shadow" filter="url(#flySwatBlur)"><use class="sw-shade-head" href="#flySwatShade"/><path class="sw-shade-handle" fill="#000"/></g>
      <path class="sw-handle" fill="#e35a10" stroke="#b3410a" stroke-width=".6"/>
      <path class="sw-shine" fill="none" stroke="#ffb27f" stroke-opacity=".7" stroke-width="1.1" stroke-linecap="round"/>
      <path class="sw-grip" fill="#b3410a"/>
      <use class="sw-ghost" href="#flySwatHead" display="none"/><use class="sw-ghost" href="#flySwatHead" display="none"/><use class="sw-ghost" href="#flySwatHead" display="none"/>
      <use class="sw-head" href="#flySwatHead"/>
    </svg>`;
    root.appendChild(swatter);

    /* The buttons: the swatter, the rag, and a small one beside them for the settings, which opens a little panel. */
    const buttonAt = asked.button || 'left';
    let panel = null, settingsBtn = null;
    if (buttonAt !== 'none' && !document.querySelector('[data-fly-swatter],[data-fly-rag]')) {
      const button = (attr, label, title, icon, place) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tool-btn' + (buttonAt === 'right' ? ' right' : '') + (place ? ' ' + place : '');
        if (attr) { b.setAttribute(attr, ''); b.setAttribute('aria-pressed', 'false'); }
        b.setAttribute('aria-label', label);
        b.title = title;
        b.innerHTML = icon;
        root.appendChild(b);
        return b;
      };
      button('data-fly-swatter', 'Fliegenklatsche', 'Fliegenklatsche · Esc legt sie weg',
        '<svg viewBox="0 0 16 16" aria-hidden="true"><g transform="rotate(-28 8 8)" fill="none" stroke="currentColor"><rect x="3.8" y=".8" width="8.4" height="9" rx="2" stroke-width="1.3"/><path d="M6.3 3v5M8 3v5M9.7 3v5M5 5.3h6" stroke-width=".7"/><path d="M8 10v5.4" stroke-width="1.5" stroke-linecap="round"/></g></svg>');
      button('data-fly-rag', 'Putztuch', 'Putztuch · gedrückt halten und reiben, Esc legt es weg',
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.2L4.8 3.2L6.8 4L4.8 4.8L4 6.8L3.2 4.8L1.2 4L3.2 3.2Z" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"><path d="M5.2 10.3L10.3 5.2Q11 4.5 11.7 5.2L14.3 7.8Q15 8.5 14.3 9.2L9.2 14.3Q8.5 15 7.8 14.3L5.2 11.7Q4.5 11 5.2 10.3Z" stroke-width="1.3"/><path d="M7.3 10.9L10.9 7.3M8.9 12.5L12.5 8.9" stroke-width=".8" stroke-dasharray="1 1.1"/></g></svg>', 'second');
      settingsBtn = button(null, 'Einstellungen', 'Einstellungen',
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5h12M2 8h12M2 11.5h12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><g fill="#fff" stroke="currentColor" stroke-width="1.3"><circle cx="10" cy="4.5" r="1.7"/><circle cx="5.5" cy="8" r="1.7"/><circle cx="11" cy="11.5" r="1.7"/></g></svg>', 'third');
      settingsBtn.setAttribute('aria-expanded', 'false');
      panel = document.createElement('div');
      panel.className = 'fly-settings' + (buttonAt === 'right' ? ' right' : '');
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Einstellungen');
      panel.innerHTML = `
        <div class="row"><span>Schwierigkeit</span><div class="seg" role="group" aria-label="Schwierigkeit">
          <button type="button" data-level="easy">Leicht</button><button type="button" data-level="normal">Mittel</button><button type="button" data-level="hard">Schwer</button></div></div>
        <div class="row"><span>Fliegen</span><div class="step">
          <button type="button" data-step="-1" aria-label="Weniger Fliegen">−</button><output aria-live="polite"></output><button type="button" data-step="1" aria-label="Mehr Fliegen">+</button></div></div>
        <div class="row"><span>Ton</span><button type="button" class="toggle" role="switch"></button></div>`;
      root.appendChild(panel);
      settingsBtn.addEventListener('click', () => openPanel(panel.hidden));
      panel.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.level) configure({ level: b.dataset.level });
        else if (b.dataset.step) configure({ flies: settings.flies + +b.dataset.step });
        else if (b.classList.contains('toggle')) configure({ sound: !settings.sound });
      });
    }
    function openPanel(open) {
      if (!panel) return;
      panel.hidden = !open;
      settingsBtn.setAttribute('aria-expanded', String(open));
      if (open) syncPanel();
    }
    function syncPanel() {
      if (!panel) return;
      panel.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === settings.level)));
      panel.querySelector('output').textContent = settings.flies;
      panel.querySelector('[data-step="-1"]').disabled = settings.flies <= 1;
      panel.querySelector('[data-step="1"]').disabled = settings.flies >= MAX_FLIES;
      const t = panel.querySelector('.toggle');
      t.setAttribute('aria-checked', String(settings.sound));
      t.textContent = settings.sound ? 'An' : 'Aus';
    }
    const sw = s => swatter.querySelector(s);
    const swShadow = sw('.sw-shadow'), swShadeHead = sw('.sw-shade-head'), swShadeHandle = sw('.sw-shade-handle'), swBlur = sw('feGaussianBlur');
    const swHandle = sw('.sw-handle'), swShine = sw('.sw-shine'), swGrip = sw('.sw-grip'), swHead = sw('.sw-head'), swGhosts = [...swatter.querySelectorAll('.sw-ghost')];

    /* Legs: hip under the thorax, resting foot, projected femur, tibia and tarsus, and the side the knee bends to. */
    const LEFT = [
      { hip: [5, -2.4], rest: [14, -8], len: [4.1, 3.9, 3.6], bend: -1 },
      { hip: [2, -3.4], rest: [1, -14.5], len: [4.2, 4, 4], bend: 1 },
      { hip: [-1, -3], rest: [-11.5, -14], len: [5.6, 5.6, 4.6], bend: 1 },
    ];
    const LEGS = [...LEFT, ...LEFT.map(l => ({ hip: [l.hip[0], -l.hip[1]], rest: [l.rest[0], -l.rest[1]], len: l.len, bend: -l.bend }))];
    const TRIPODS = [[0, 4, 2], [3, 1, 5]];   // left front, right middle, left hind step together

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
      wingL: { legs: [2], ms: [1300, 2600], over: true, wing: 0, pos: (i, t, P) => wingStroke(-1, P.wingL, t) },
      wingR: { legs: [5], ms: [1300, 2600], over: true, wing: 1, pos: (i, t, P) => wingStroke(1, P.wingR, t) },
    };
    const SEQS = [['front'], ['front', 'head', 'front'], ['head', 'front'], ['front', 'head'], ['hind'],
      ['hind', 'wingL', 'hind'], ['hind', 'wingR', 'wingL', 'hind'], ['front', 'head', 'front', 'hind']];
    const tuck = g => {
      const dx = g.rest[0] - g.hip[0], dy = g.rest[1] - g.hip[1];
      return [g.hip[0] + dx * .62 - 2.5, g.hip[1] + dy * .62, g.hip[0] + dx * .45, g.hip[1] + dy * .45];
    };
    // Where each left leg ends up on a dead fly: foot and ankle, folded over the belly; right legs mirror them.
    // The knees stick out, tibiae and tarsi fold back over the belly (drawLeg bends every knee outwards then).
    const CURL = [[8.4, -.6, 6.55, -2], [2.2, -.7, 3.6, -4], [-5.2, -.4, -3.4, -1.4]];
    function curl(L, t, amp = 1) {
      const c = CURL[L.i % 3], s = L.i < 3 ? 1 : -1;
      const k = t < 3500 ? Math.max(0, Math.sin(t * .021 + L.i * 2.1) - .55) * 2.4 * amp * (1 - t / 3500) : 0;
      return [c[0] + k * .6, s * (c[1] - k * .8), c[2] + k * .3, s * (c[3] - k)];
    }

    let W = innerWidth, H = innerHeight;
    const M = { x: 0, y: 0, vx: 0, vy: 0, t: 0, on: false, ui: false };   // the pointer; ui while it is over the buttons or the panel
    let hidden = false, tool = null, swat = null;   // tool: null, 'swatter' or 'rag'
    const flies = [];
    const inside = (x, y, m) => x > m && x < W - m && y > m && y < H - m;
    // A point beyond one edge of the screen, far px further out still.
    const entryAt = (e, far) => {
      const out = 70 + far, along = len => 60 + e.u * (len - 120);
      return [e.side === 0 ? -out : e.side === 1 ? W + out : along(W), e.side === 2 ? -out : e.side === 3 ? H + out : along(H)];
    };
    const anyEdge = () => ({ side: Math.floor(Math.random() * 4), u: Math.random() });

    /* ── the swatter ── a busy fly is easier to hit; a hit one lies on its back, then slides off, and a new one comes */
    // Take up a tool, 'swatter' or 'rag', or put it down (null); only one is in the hand at a time.
    function take(t) {
      tool = t; swat = null; rub = null;
      document.documentElement.classList.toggle('fly-tool', !!t);
      host.classList.toggle('tool-out', !!t);
      for (const [attr, name] of [['data-fly-swatter', 'swatter'], ['data-fly-rag', 'rag']])
        [...document.querySelectorAll(`[${attr}]`), ...root.querySelectorAll(`[${attr}]`)].forEach(b => b.setAttribute('aria-pressed', String(t === name)));
      if (t !== 'swatter') swatter.classList.remove('on');
      if (t !== 'rag') ragEl.classList.remove('on');
    }
    function strike(now, x, y) {
      swat = { x, y, t0: now, done: false };
      swish(x);
      for (const f of flies) f.threat(now, x, y);
    }
    function swatStep(now) {
      if (!swat) return;
      if (!swat.done && now - swat.t0 >= STRIKE) {
        swat.done = true;
        let wet = 0;
        for (const f of flies.slice()) wet = Math.max(wet, f.struck(now, swat.x, swat.y));
        slap(swat.x, wet);
      }
      if (now - swat.t0 > T_END) swat = null;
    }
    /* Where the swatter is t ms after the click (Infinity while it is only held): height z of the head, its tilt phi,
       how far it is pulled back (s) and to the side (lat), the bow of the handle, and reach, 0 held to 1 flat on the glass. */
    function swatPose(t) {
      let z = Z_UP, phi = PHI_UP, s = 0, lat = 0, bow = 0, reach = 0, spread = 1;
      if (t < T_WIND) {
        const u = ease(t / T_WIND);
        z += WIND.z * u; phi += WIND.phi * u; s = WIND.s * u; bow = WIND.bow * u; reach = WIND.reach * u;
      } else if (t < STRIKE) {
        // the wrist accelerates: the head lags and bends the handle back, then whips past it onto the glass
        const u = (t - T_WIND) / (STRIKE - T_WIND), p = u ** 2.2;
        z = (Z_UP + WIND.z) * (1 - p); phi = (PHI_UP + WIND.phi) * (1 - p) ** .8; s = WIND.s * (1 - p); lat = -12 * Math.sin(Math.PI * p);
        bow = WIND.bow * (1 - u) ** 2 - 16 * Math.sin(Math.PI * u) ** 1.5 * Math.sqrt(1 - u) + 8 * u ** 6; reach = WIND.reach + (1 - WIND.reach) * p;
      } else if (t < STRIKE + T_HOLD) {
        // flat on the glass while the hand follows through and bows the handle
        const v = (t - STRIKE) / T_HOLD;
        z = 0; phi = 0; bow = 8 + 10 * Math.sin(Math.PI / 2 * v); reach = 1 + .1 * v; spread = 1 + .03 * (1 - v);
      } else if (t < T_END) {
        // the handle springs back and rings; the head bounces off the glass and is lifted
        const ms = t - STRIKE - T_HOLD, w = ms / T_BACK, e = ease(w);
        bow = 18 * Math.exp(-ms / 70) * Math.cos(2 * Math.PI * 21 * ms / 1000);
        z = Z_UP * e + 7 * Math.sin(Math.PI * Math.min(1, ms / 60)) * (1 - w); phi = PHI_UP * e; reach = 1.1 * (1 - e);
      }
      return { z, phi, s, lat, bow, reach, spread };
    }
    const SW_DIR = [Math.sin(SWAT_TILT * DEG), Math.cos(SWAT_TILT * DEG)], SW_ACROSS = [Math.cos(SWAT_TILT * DEG), -Math.sin(SWAT_TILT * DEG)];
    const kz = z => DEPTH / (DEPTH - z);
    const shadowOff = z => [z * .1, z * .13];
    const matrix = m => `matrix(${m.map(v => v.toFixed(3)).join(' ')})`;
    function headMatrix(pose, T, k) {
      const r = pose.bow * .004, c = Math.cos(r), s = Math.sin(r), fore = Math.cos(pose.phi * DEG);
      const d = [SW_DIR[0] * c - SW_DIR[1] * s, SW_DIR[0] * s + SW_DIR[1] * c], a = [SW_ACROSS[0] * c - SW_ACROSS[1] * s, SW_ACROSS[0] * s + SW_ACROSS[1] * c];
      return [a[0] * k, a[1] * k, d[0] * k * fore, d[1] * k * fore,
        T[0] + SW_DIR[0] * pose.s + SW_ACROSS[0] * pose.lat, T[1] + SW_DIR[1] * pose.s + SW_ACROSS[1] * pose.lat];
    }
    const bez = (c, t) => { const m = 1 - t, a = m * m * m, b = 3 * m * m * t, d = 3 * m * t * t, e = t * t * t; return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]]; };
    const bezDir = (c, t) => { const m = 1 - t; return [3 * m * m * (c[1][0] - c[0][0]) + 6 * m * t * (c[2][0] - c[1][0]) + 3 * t * t * (c[3][0] - c[2][0]), 3 * m * m * (c[1][1] - c[0][1]) + 6 * m * t * (c[2][1] - c[1][1]) + 3 * t * t * (c[3][1] - c[2][1])]; };
    // A band along the curve between t0 and t1, width(t) wide, optionally displaced by shift(t): the handle, its grip, its shadow.
    function band(c, t0, t1, width, shift, side) {
      const L = [], R = [];
      for (let i = 0; i <= 12; i++) {
        const t = t0 + (t1 - t0) * i / 12, p = bez(c, t), dv = bezDir(c, t), l = Math.hypot(dv[0], dv[1]) || 1;
        const nx = -dv[1] / l, ny = dv[0] / l, w = width(t) / 2, sh = shift ? shift(t) : [0, 0];
        if (side !== undefined) { L.push(`${n2(p[0] + nx * w * side)} ${n2(p[1] + ny * w * side)}`); continue; }
        L.push(`${n2(p[0] + nx * w + sh[0])} ${n2(p[1] + ny * w + sh[1])}`);
        R.unshift(`${n2(p[0] - nx * w + sh[0])} ${n2(p[1] - ny * w + sh[1])}`);
      }
      return side !== undefined ? `M${L.join('L')}` : `M${L.join('L')}L${R.join('L')}Z`;
    }
    let hoverBow = 0;
    function drawSwatter(now, dt) {
      const show = tool === 'swatter' && M.on && !M.ui;
      if (swatter.classList.contains('on') !== show) swatter.classList.toggle('on', show);
      if (!show) return;
      const t = swat ? now - swat.t0 : Infinity;
      // swung around, the head lags behind the hand and bends the handle a little
      const across = now - M.t < 100 ? M.vx * SW_ACROSS[0] + M.vy * SW_ACROSS[1] : 0;
      hoverBow = approach(hoverBow, clamp(-across * .012, -8, 8), dt, .06);
      let T = [M.x, M.y];
      if (t < T_END) {
        const back = t > STRIKE + T_HOLD ? ease((t - STRIKE - T_HOLD) / T_BACK) : 0;
        T = [swat.x + (M.x - swat.x) * back, swat.y + (M.y - swat.y) * back];
      }
      const pose = swatPose(t);
      pose.bow += hoverBow;
      const k = kz(pose.z) * pose.spread, m = headMatrix(pose, T, k);
      const neck = [m[4] + m[2] * 58, m[5] + m[3] * 58];
      const reach = REACH_UP + (REACH_HIT - REACH_UP) * pose.reach, hand = [T[0] + SW_DIR[0] * reach, T[1] + SW_DIR[1] * reach];
      const dx = neck[0] - hand[0], dy = neck[1] - hand[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const curve = [hand, [hand[0] + dx * .3 + nx * pose.bow, hand[1] + dy * .3 + ny * pose.bow],
        [hand[0] + dx * .72 + nx * pose.bow * .7, hand[1] + dy * .72 + ny * pose.bow * .7], neck];
      const zNeck = Math.max(0, pose.z - 45 * Math.sin(pose.phi * DEG)), kHand = kz(Z_HAND), kNeck = kz(zNeck);
      const width = base => tt => base * (kHand + (kNeck - kHand) * tt);
      swHandle.setAttribute('d', band(curve, 0, 1, width(7.2)));
      swShine.setAttribute('d', band(curve, .22, .95, width(3.4), null, 1));
      swGrip.setAttribute('d', band(curve, 0, .2, width(9.4)));
      swHead.setAttribute('transform', matrix(m));
      // the shadow has the swatter's real size and sits further off the higher each part is
      const shade = headMatrix(pose, T, pose.spread), off = shadowOff(pose.z);
      shade[4] += off[0]; shade[5] += off[1];
      swShadeHead.setAttribute('transform', matrix(shade));
      swShadeHandle.setAttribute('d', band(curve, 0, 1, width(7.2), tt => shadowOff(Z_HAND + (zNeck - Z_HAND) * tt)));
      swShadow.setAttribute('opacity', n2(.36 - pose.z * .0011));
      swBlur.setAttribute('stdDeviation', n2(1.2 + pose.z * .03));
      // motion blur: where the head was a few ms ago, while it rushes down
      const fast = t > T_WIND + 8 && t < STRIKE + 3;
      swGhosts.forEach((g, i) => {
        g.setAttribute('display', fast ? 'inline' : 'none');
        if (!fast) return;
        const gp = swatPose(t - 6 * (i + 1));
        g.setAttribute('transform', matrix(headMatrix(gp, T, kz(gp.z) * gp.spread)));
        g.setAttribute('opacity', [.3, .17, .08][i]);
      });
    }

    /* ── the smear ── what a swatted fly leaves on the glass: a splat where it was hit and a trail down to where it went.
       It stays until it is wiped off. Each smear keeps a list of spots, points of its goo and how much of each is left,
       so that the rag knows what it has cleaned, and a mask of its own that the rag's strokes are drawn into. A smear
       is active while its fly is still on it. */
    const GOO = '#80742c', GOO_DARK = '#4e401a', GOO_RED = '#7d2016';
    const DRY = 45000;   // ms after the fly has gone that the goo has dried
    const smearLayer = document.createElementNS(NS, 'svg');
    smearLayer.id = 'flySmear';
    smearLayer.setAttribute('aria-hidden', 'true');
    root.appendChild(smearLayer);
    const smears = [];
    let dryAt = 0, maskN = 0;
    const svgEl = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      parent.appendChild(e);
      return e;
    };
    const smearDefs = svgEl('defs', {}, smearLayer);
    // A lumpy splat: points on a noisy circle, some pushed out into short splashes, joined by curves through their midpoints.
    function blob(x, y, r0, out, noise) {
      const p = [];
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * TAU, r = r0 * (.8 + .22 * noise(a * 40)) + (Math.random() < .22 ? r0 * rnd(.15, out) : 0);
        p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      const mid = i => { const a = p[i % p.length], b = p[(i + 1) % p.length]; return `${n2((a[0] + b[0]) / 2)} ${n2((a[1] + b[1]) / 2)}`; };
      return `M${mid(0)}` + p.map((_, i) => `Q${n2(p[(i + 1) % p.length][0])} ${n2(p[(i + 1) % p.length][1])} ${mid(i + 1)}`).join('') + 'Z';
    }
    function splatAt(s, x, y, amount) {
      const at = s.band || null;
      const put = (tag, attrs) => { const e = svgEl(tag, attrs, s.g); if (at) s.g.insertBefore(e, at); };
      put('path', { d: blob(x, y, 12 * (.4 + .6 * amount), .55, s.noise), fill: GOO, 'fill-opacity': .34 });
      put('path', { d: blob(x, y, 6.5 * (.4 + .6 * amount), .35, s.noise), fill: GOO_DARK, 'fill-opacity': .42 });
      put('path', { d: blob(x, y, 3 * (.4 + .6 * amount), .3, s.noise), fill: GOO_RED, 'fill-opacity': .3 });
      const r = 12 * (.4 + .6 * amount) * .7;
      s.spots.push({ x, y, left: 1 });
      for (let k = 0; k < 4; k++) s.spots.push({ x: x + Math.cos(k * TAU / 4) * r, y: y + Math.sin(k * TAU / 4) * r, left: 1 });
    }
    function startSmear(x, y) {
      // the mask starts all white, so all of the smear shows; the rag's strokes are drawn into it in black
      const mask = svgEl('mask', { id: `flyWipe${++maskN}`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, smearDefs);
      svgEl('rect', { x: -1e5, y: -1e5, width: 2e5, height: 2e5, fill: '#fff' }, mask);
      const g = svgEl('g', { mask: `url(#${mask.id})` }, smearLayer), ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
      const noise = s => Math.sin(s * .09 + ph[0]) * .5 + Math.sin(s * .23 + ph[1]) * .3 + Math.sin(s * .041 + ph[2]) * .2;
      const s = { g, mask, noise, spots: [], pts: [[x, y, 1]], left: 0, active: true, dry: false, beadAt: rnd(15, 35), len: 0 };
      splatAt(s, x, y, 1);
      s.band = svgEl('path', { fill: GOO, 'fill-opacity': .32 }, g);
      s.core = svgEl('path', { fill: GOO_DARK, 'fill-opacity': .3 }, g);
      s.red = svgEl('path', { fill: 'none', stroke: GOO_RED, 'stroke-opacity': .3, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      s.streaks = svgEl('path', { fill: 'none', stroke: GOO_DARK, 'stroke-opacity': .24, 'stroke-width': .7, 'stroke-linecap': 'round' }, g);
      s.gloss = svgEl('path', { fill: 'none', stroke: '#fffbe6', 'stroke-opacity': .3, 'stroke-width': .8, 'stroke-linecap': 'round' }, g);
      smears.push(s);
      return s;
    }
    // The trail is widest where the fly was hit and thins out as its goo (amount) is spent.
    function growSmear(s, x, y, amount) {
      const last = s.pts[s.pts.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) < 3) return;
      s.len += Math.hypot(x - last[0], y - last[1]);
      s.pts.push([x, y, amount]);
      s.spots.push({ x, y, left: 1 });
      const w0 = 7 * amount * Math.max(.4, 1 - s.len / 1100);
      if (Math.random() < .1) svgEl('circle', { cx: n2(x + rnd(-.8, .8) * w0), cy: n2(y - rnd(2, 8)), r: n2(rnd(.4, Math.random() < .2 ? 2.2 : 1.2)), fill: GOO_DARK, 'fill-opacity': .5 }, s.g);
      if (s.len > s.beadAt) {
        // goo beads up along the edges of the trail
        s.beadAt = s.len + rnd(18, 45);
        const side = Math.random() < .5 ? -1 : 1, dy = y - last[1], dx = x - last[0], l = Math.hypot(dx, dy) || 1;
        svgEl('circle', { cx: n2(x - dy / l * w0 * side * .95), cy: n2(y - 6 + dx / l * w0 * side * .95), r: n2(w0 * rnd(.3, .55)), fill: GOO, 'fill-opacity': .32 }, s.g);
      }
      const L = [], R = [], CL = [], CR = [], G = [], RED = [], S1 = [], S2 = [], pt = (p, nx, ny, o) => `${n2(p[0] + nx * o)} ${n2(p[1] + ny * o)}`;
      let along = 0;
      s.pts.forEach((p, i) => {
        const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)];
        if (i) along += Math.hypot(p[0] - a[0], p[1] - a[1]);
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        const w = 7 * p[2] * Math.max(.4, 1 - along / 1100) * (.8 + .3 * s.noise(along)), c = w * .35, off = w * .25 * s.noise(along * 1.7 + 50);
        L.push(pt(p, nx, ny, w)); R.unshift(pt(p, nx, ny, -w));
        CL.push(pt(p, nx, ny, off + c)); CR.unshift(pt(p, nx, ny, off - c));
        G.push(pt(p, nx, ny, w - 1.3));
        if (along < 90) RED.push(pt(p, nx, ny, off));
        S1.push(pt(p, nx, ny, w * (.6 + .15 * s.noise(along * 2.3 + 9))));
        S2.push(pt(p, nx, ny, -w * (.55 + .15 * s.noise(along * 1.9 + 31))));
      });
      s.band.setAttribute('d', `M${L.join('L')}L${R.join('L')}Z`);
      s.core.setAttribute('d', `M${CL.join('L')}L${CR.join('L')}Z`);
      s.gloss.setAttribute('d', `M${G.join('L')}`);
      if (RED.length > 1) s.red.setAttribute('d', `M${RED.join('L')}`);
      s.streaks.setAttribute('d', `M${S1.join('L')}M${S2.join('L')}`);
    }
    /* Splashes: droplets squirt out from under the swatter and through its mesh, brake in the goo and stay as tadpole-shaped spots. */
    const drops = [];
    function splash(s, x, y, amount) {
      // a few big drops that do not get far, and a fine mist that does
      const n = Math.round(rnd(16, 26) * (.4 + amount));
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), c = Math.random(), mist = i % 3 === 0;
        drops.push({
          s, el: svgEl('path', { fill: c < .22 ? GOO_RED : c < .6 ? GOO_DARK : GOO, 'fill-opacity': mist ? .4 : .5 }, s.g),
          x: x + Math.cos(a) * rnd(3, 8), y: y + Math.sin(a) * rnd(3, 8), a, d: 0,
          v: (mist ? rnd(250, 700) : rnd(90, 420)) * (.6 + .5 * amount), k: rnd(7, 14),
          r: mist ? rnd(.3, .7) : rnd(.6, 2.4) * (.6 + .5 * amount), tail: Math.random() < .3 ? 0 : rnd(.05, .25),
        });
      }
    }
    function stepDrops(dt) {
      for (let i = drops.length - 1; i >= 0; i--) {
        const q = drops[i], ca = Math.cos(q.a), sa = Math.sin(q.a);
        q.d += q.v * dt; q.v *= Math.exp(-q.k * dt);
        const hx = q.x + ca * q.d, hy = q.y + sa * q.d, tl = Math.min(12, q.d * q.tail), nx = -sa * q.r, ny = ca * q.r;
        const r = n2(q.r), left = `${n2(hx + nx)} ${n2(hy + ny)}`, right = `${n2(hx - nx)} ${n2(hy - ny)}`;
        q.el.setAttribute('d', tl > q.r * 1.5
          ? `M${n2(hx - ca * tl)} ${n2(hy - sa * tl)}L${left}A${r} ${r} 0 0 0 ${right}Z`
          : `M${left}A${r} ${r} 0 0 0 ${right}A${r} ${r} 0 0 0 ${left}Z`);
        if (q.v < 8) { drops.splice(i, 1); q.s.spots.push({ x: hx, y: hy, left: 1 }); }
      }
    }
    // Its fly has gone from it; returns null, for the fly to forget it by.
    function endSmear(s, now) {
      if (s) { s.left = now; s.active = false; }
      return null;
    }
    // A smear stays until it is wiped off. It is wet while the fly is on it and for a while after; drying, it loses its shine.
    function drySmears(now) {
      if (now < dryAt) return;
      dryAt = now + 500;
      for (const s of smears) {
        if (s.dry || !s.left) continue;
        const o = 1 - (now - s.left - DRY) / 8000;
        if (o >= 1) continue;
        s.gloss.setAttribute('opacity', n2(Math.max(0, o)));
        if (o <= 0) s.dry = true;
      }
    }

    /* ── the rag ── a yellow cloth bunched in the hand, drawn in page coordinates like the swatter. Pressed to the glass
       and rubbed, it takes the smears off. Each stroke takes away part of what is under it, in lanes with thin gaps
       between them, so a smear goes in a few passes and is streaky in between. A fresh one comes off in two or three and
       smears along the stroke at first; a dried one needs rubbing. A dead fly under it is wiped up with it. Every time
       the hand turns back, or has gone round far enough, the next stroke is a new pass over the glass. */
    // px: half the width of cloth on the glass; where its lanes run (the gaps between them are the streaks a pass leaves);
    // how far to the side a lane surely wipes, and how far past the end of a stroke
    const RAG_R = 30, LANES = [-19, 0, 19], REACH = 24, OVERRUN = 8;
    const RAG = { x: 0, y: 0, z: 26, vx: 0, vy: 0, speed: 0, rot: rnd(-.5, .5), wet: 0, dirt: 0 };
    let rub = null;   // while the rag is pressed: the pass it is on, and the goo it is dragging along
    const ragEl = document.createElement('div');
    ragEl.id = 'flyRag';
    ragEl.setAttribute('aria-hidden', 'true');
    // A lumpy outline with a corner or two of the cloth sticking out, and creases running in towards the fingers.
    const ragOutline = (() => {
      const ph = [rnd(0, TAU), rnd(0, TAU)], corners = [rnd(0, TAU), rnd(0, TAU)], p = [];
      for (let i = 0; i < 30; i++) {
        const a = i / 30 * TAU;
        let r = 1 + .07 * Math.sin(a * 3 + ph[0]) + .05 * Math.sin(a * 7 + ph[1]) + rnd(-.03, .03);
        for (const c of corners) r += .24 * Math.exp(-(angDiff(a, c) ** 2) / .025);
        p.push([Math.cos(a) * 40 * r, Math.sin(a) * 33 * r]);
      }
      const mid = i => { const a = p[i % 30], b = p[(i + 1) % 30]; return `${n2((a[0] + b[0]) / 2)} ${n2((a[1] + b[1]) / 2)}`; };
      return `M${mid(0)}` + p.map((_, i) => `Q${n2(p[(i + 1) % 30][0])} ${n2(p[(i + 1) % 30][1])} ${mid(i + 1)}`).join('') + 'Z';
    })();
    const ragFolds = Array.from({ length: 5 }, (_, k) => {
      const a = k / 5 * TAU + rnd(-.4, .4), r0 = rnd(7, 13), r1 = rnd(24, 33), bend = rnd(-8, 8);
      const x0 = Math.cos(a) * r0, y0 = Math.sin(a) * r0 * .82, x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1 * .82;
      return `M${n2(x0)} ${n2(y0)}Q${n2((x0 + x1) / 2 - Math.sin(a) * bend)} ${n2((y0 + y1) / 2 + Math.cos(a) * bend)} ${n2(x1)} ${n2(y1)}`;
    }).join('');
    const ragStains = Array.from({ length: 7 }, () => {
      const a = rnd(0, TAU), d = rnd(0, 22);
      return `<ellipse cx="${n2(Math.cos(a) * d)}" cy="${n2(Math.sin(a) * d * .8)}" rx="${n2(rnd(3, 9))}" ry="${n2(rnd(2, 6))}" transform="rotate(${n2(rnd(0, 180))} ${n2(Math.cos(a) * d)} ${n2(Math.sin(a) * d * .8)})" fill="${pick([GOO, GOO_DARK, GOO])}" fill-opacity="${n2(rnd(.25, .5))}"/>`;
    }).join('');
    ragEl.innerHTML = `<svg focusable="false">
      <defs>
        <radialGradient id="flyRagCloth" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#fbe48e"/><stop offset=".55" stop-color="#f0c648"/><stop offset="1" stop-color="#c99722"/></radialGradient>
        <radialGradient id="flyRagPucker"><stop offset="0" stop-color="#8a6512" stop-opacity=".45"/><stop offset="1" stop-color="#8a6512" stop-opacity="0"/></radialGradient>
        <pattern id="flyRagWeave" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><path d="M0 1.2H2.4M1.2 0V2.4" stroke="#6b4c08" stroke-opacity=".12" stroke-width=".5"/></pattern>
        <filter id="flyRagBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <path class="rag-shade" d="${ragOutline}" fill="#000" filter="url(#flyRagBlur)"/>
      <g class="rag-body">
        <path d="${ragOutline}" fill="url(#flyRagCloth)" stroke="#b5871d" stroke-width=".9"/>
        <path d="${ragOutline}" fill="url(#flyRagWeave)"/>
        <path d="${ragOutline}" transform="scale(.9)" fill="none" stroke="#a37813" stroke-opacity=".5" stroke-width=".7" stroke-dasharray="1.6 1.4"/>
        <ellipse cx="2" cy="1" rx="15" ry="12" fill="url(#flyRagPucker)"/>
        <path d="${ragFolds}" fill="none" stroke="#9c7212" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/>
        <path d="${ragFolds}" transform="translate(-1.2 -1.2)" fill="none" stroke="#fff6cf" stroke-opacity=".55" stroke-width=".9" stroke-linecap="round"/>
        <g class="rag-dirt" opacity="0">${ragStains}</g>
      </g>
    </svg>`;
    root.appendChild(ragEl);
    const ragBody = ragEl.querySelector('.rag-body'), ragShade = ragEl.querySelector('.rag-shade'), ragBlur = ragEl.querySelector('feGaussianBlur'), ragDirt = ragEl.querySelector('.rag-dirt');

    // Lifted, it hangs just above the glass; pressed, it lies flat and the cloth drags behind the fingers along the stroke.
    function drawRag(now, dt) {
      const show = tool === 'rag' && M.on && !M.ui;
      if (ragEl.classList.contains('on') !== show) ragEl.classList.toggle('on', show);
      if (!show) { RAG.speed = 0; RAG.x = M.x; RAG.y = M.y; return; }
      const vx = dt ? (M.x - RAG.x) / dt : 0, vy = dt ? (M.y - RAG.y) / dt : 0;
      RAG.x = M.x; RAG.y = M.y;
      RAG.vx = approach(RAG.vx, vx, dt, .05); RAG.vy = approach(RAG.vy, vy, dt, .05);
      const sp = Math.hypot(RAG.vx, RAG.vy);
      RAG.speed = rub ? sp : 0;
      RAG.z = approach(RAG.z, rub ? 0 : 26, dt, rub ? .03 : .08);
      RAG.wet = approach(RAG.wet, 0, dt, .4);
      const ang = sp > 1 ? Math.atan2(RAG.vy, RAG.vx) / DEG : 0, st = rub ? Math.min(.14, sp / 5000) : Math.min(.05, sp / 12000);
      const lag = rub ? Math.min(6, sp * .006) : 0, bx = RAG.x - (sp > 1 ? RAG.vx / sp * lag : 0), by = RAG.y - (sp > 1 ? RAG.vy / sp * lag : 0);
      const rot = (RAG.rot + .06 * Math.sin(now * .0023)) / DEG, k = kz(RAG.z) * (rub ? 1.03 : 1);
      const shape = `rotate(${n2(ang)}) scale(${n2(1 + st)} ${n2(1 - st * .5)}) rotate(${n2(rot - ang)})`;
      ragBody.setAttribute('transform', `translate(${n2(bx)} ${n2(by)}) ${shape} scale(${n2(k)})`);
      const off = shadowOff(RAG.z);
      ragShade.setAttribute('transform', `translate(${n2(bx + off[0])} ${n2(by + off[1])}) ${shape}`);
      ragShade.setAttribute('opacity', n2(.3 - RAG.z * .005));
      ragBlur.setAttribute('stdDeviation', n2(1 + RAG.z * .09));
      ragDirt.setAttribute('opacity', n2(Math.min(.9, RAG.dirt)));
    }

    const segDist = (x, y, a, b) => {
      const ex = b[0] - a[0], ey = b[1] - a[1], t = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      return Math.hypot(a[0] + ex * t - x, a[1] + ey * t - y);
    };
    // Whether a point lies under the lanes the cloth wipes along a stroke from a to b: beside it, not beyond its ends.
    const covered = (x, y, a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      const along = (x - a[0]) * ux + (y - a[1]) * uy, across = (x - a[0]) * uy - (y - a[1]) * ux;
      return Math.abs(across) < REACH && along > -OVERRUN && along < l + OVERRUN;
    };
    const seen = q => q.x > -10 && q.x < W + 10 && q.y > -10 && q.y < H + 10;
    // One lane of a pass: the stroke's path shifted sideways by off px.
    const lane = (pts, off) => pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return `${i ? 'L' : 'M'}${n2(p[0] - (b[1] - a[1]) / l * off)} ${n2(p[1] + (b[0] - a[0]) / l * off)}`;
    }).join('');
    function rubStart(x, y) { rub = { pts: [[x, y]], dir: null, turn: 0, len: 0, masks: new Map(), touched: new Set(), carry: 0, from: null, since: 0 }; }
    function newPass(at) { Object.assign(rub, { pts: [at], dir: null, turn: 0, len: 0, masks: new Map(), touched: new Set() }); }
    function rubMove(x, y) {
      const a = rub.pts[rub.pts.length - 1], dx = x - a[0], dy = y - a[1], d = Math.hypot(dx, dy);
      if (d < 3) return;
      const u = [dx / d, dy / d];
      if (rub.dir) {
        const c = u[0] * rub.dir[0] + u[1] * rub.dir[1];
        rub.turn += Math.abs(Math.atan2(u[0] * rub.dir[1] - u[1] * rub.dir[0], c));
        if (c < -.3 || rub.turn > 2.4 || rub.len > 420) newPass(a);
      }
      rub.dir = u; rub.len += d;
      rub.pts.push([x, y]);
      wipe(a, [x, y], u, d);
    }
    function wipe(a, b, u, d) {
      for (const f of flies.slice()) if (f.mode === 'dead' && segDist(f.P.x, f.P.y, a, b) < RAG_R * .8) { RAG.dirt += .25; f.gone(clock()); }
      for (let i = smears.length - 1; i >= 0; i--) {
        const s = smears[i], under = s.spots.filter(q => !rub.touched.has(q) && covered(q.x, q.y, a, b));
        if (!under.length && !rub.masks.has(s)) continue;
        const r = s.dry ? .24 : .5;   // how much of what is under it one pass takes off
        let stroke = rub.masks.get(s);
        if (!stroke) {
          // one path per pass, its lanes a little apart and a little different each time
          stroke = svgEl('path', { fill: 'none', stroke: '#000', 'stroke-opacity': n2(r * rnd(.85, 1.15)), 'stroke-width': n2(rnd(15, 18)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s.mask);
          stroke.off = LANES.map(o => o + rnd(-2.5, 2.5));
          rub.masks.set(s, stroke);
        }
        stroke.setAttribute('d', stroke.off.map(o => lane(rub.pts, o)).join(''));
        for (const q of under) {
          rub.touched.add(q);
          const took = q.left * r;
          q.left -= took;
          RAG.dirt += took * .015;
          if (!s.dry) { rub.carry = Math.min(1, rub.carry + took * .15); rub.from = s; RAG.wet = 1; }
        }
        // Clean to a tenth wherever it can be seen: the last faint film goes with the next wipe, and so does what ran off the screen.
        if (!s.active && s.spots.every(q => q.left < .1 || !seen(q))) {
          smears.splice(i, 1);
          s.g.style.transition = 'opacity .6s'; s.g.style.opacity = '0';
          setTimeout(() => { s.g.remove(); s.mask.remove(); }, 700);
        }
      }
      // Wet goo picked up at the front of the cloth is dragged along the stroke and left in streaks, thinner and thinner.
      const s = rub.from;
      if (rub.carry < .05 || !s || !smears.includes(s)) return;
      for (rub.since += d; rub.since > 9; rub.since -= 9) {
        const o = rnd(-.7, .7) * REACH, len = rnd(8, 18), x = b[0] - u[1] * o, y = b[1] + u[0] * o, r = s.dry ? .24 : .5;
        svgEl('path', { d: `M${n2(x - u[0] * len)} ${n2(y - u[1] * len)}L${n2(x)} ${n2(y)}`, fill: 'none', stroke: Math.random() < .3 ? GOO_DARK : GOO,
          'stroke-opacity': n2(rub.carry * .45), 'stroke-width': n2(rnd(1, 3.5)), 'stroke-linecap': 'round' }, s.g);
        const q = { x, y, left: Math.min(1, rub.carry * 1.2) * (1 - r) };   // this pass is already wiping over it
        s.spots.push(q); rub.touched.add(q);
        rub.carry *= .86;
      }
    }
    function rubEnd() { rub = null; }

    /* ── sound ── all of it made up on the spot with Web Audio, nothing to load. The listener sits EAR px in front of
       the glass: each fly's buzz grows louder and brighter as it comes up off the glass towards them, and moves from
       ear to ear with it. A page may only make sound once the user has clicked or typed on it, so it wakes then. */
    const VOLUME = .8, BUZZ = .1, SLAP = .9, RUB = .16, SQUEAK = .035;
    const EAR = 650, RISE = 260, APPROACH = 1600;   // px from the glass to the ear; how far towards it a flying fly comes; ms a newcomer is heard before it is seen
    let ac = null, master = null, room = null, rubbing = null, bufs = null;
    const live = () => ac && ac.state === 'running';
    const render = (sec, fn, rate) => { const b = ac.createBuffer(1, Math.ceil(sec * (rate || ac.sampleRate)), rate || ac.sampleRate); fn(b.getChannelData(0), b.sampleRate); return b; };
    const norm = d => { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m) for (let i = 0; i < d.length; i++) d[i] /= m; };
    const loop = buf => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; return s; };
    const panner = () => ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
    const setPan = (p, v, t) => { if (p.pan) t ? p.pan.setTargetAtTime(v, t, .03) : (p.pan.value = v); };
    const panAt = x => clamp((x - W / 2) / (W * .55), -1, 1) * .8;
    // Straight to the ears, and a little of it by way of the room.
    function send(node, wet) {
      node.connect(master);
      if (wet) { const g = ac.createGain(); g.gain.value = wet; node.connect(g).connect(room); }
    }
    function play(buf, x, gain, rate, wet) {
      if (!live()) return;
      const s = ac.createBufferSource(), g = ac.createGain(), p = panner();
      s.buffer = buf; s.playbackRate.value = rate || 1; g.gain.value = gain; setPan(p, panAt(x));
      s.connect(g).connect(p); send(p, wet);
      s.start();
    }

    function wake() {
      // only on a press the browser counts as the user's doing (a finger touching down is not one, its lifting is)
      if (!settings.sound || (navigator.userActivation && !navigator.userActivation.isActive)) return;
      if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = VOLUME;
      const limit = ac.createDynamicsCompressor();
      limit.threshold.value = -8; limit.knee.value = 4; limit.ratio.value = 12; limit.attack.value = .002; limit.release.value = .12;
      master.connect(limit).connect(ac.destination);

      // A small room: a few early reflections off the desk and the walls, then a short tail that darkens as it dies.
      const SR = ac.sampleRate, ir = ac.createBuffer(2, Math.round(SR * .7), SR);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < d.length; i++) {
          const t = i / SR;
          lp += (Math.random() * 2 - 1 - lp) * (.5 - .45 * Math.min(1, t / .5));
          d[i] = t < .006 ? 0 : lp * Math.exp(-t / .11);
        }
        for (const ms of [7, 11, 17, 23]) d[Math.round(SR * (ms + rnd(-1.5, 1.5)) / 1000)] += rnd(.3, .6) * (Math.random() < .5 ? -1 : 1);
      }
      room = ac.createConvolver(); room.buffer = ir;
      const roomOut = ac.createGain(); roomOut.gain.value = .5;
      room.connect(roomOut).connect(master);

      // Smooth random wandering between lo and hi Hz that loops without a seam: whole cycles in 4 s.
      const wobble = (lo, hi) => render(4, (d, sr) => {
        const parts = [];
        for (let k = 0; k < 10; k++) { const f = Math.max(.25, Math.round(rnd(lo, hi) * 4) / 4); parts.push([f, rnd(0, TAU), 1 / Math.sqrt(f)]); }
        for (let i = 0; i < d.length; i++) { const t = i / sr; let v = 0; for (const [f, ph, a] of parts) v += a * Math.sin(TAU * f * t + ph); d[i] = v; }
        norm(d);
      }, 22050);
      bufs = {
        noise: render(2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }),
        jitter: wobble(4, 45), shimmer: wobble(2, 30), stick: wobble(18, 70),
      };
      // Each fly gets its voice on its next frame. Its feet on the glass are left out: no one hears a fly walk.

      /* The rag on the glass: the hiss of cloth rubbing, grainy because it sticks and slips as it goes, higher the
         faster it is pulled, and duller and softer through wet goo. */
      const rubSrc = loop(bufs.noise), rubF = ac.createBiquadFilter(), rubL = ac.createBiquadFilter(), grain = ac.createGain(), rubG = ac.createGain(), rubP = panner();
      rubF.type = 'bandpass'; rubF.frequency.value = 1000; rubF.Q.value = .8;
      rubL.type = 'lowpass'; rubL.frequency.value = 4200;
      const stick = loop(bufs.stick), stickG = ac.createGain(); stickG.gain.value = .45;
      stick.connect(stickG).connect(grain.gain);
      rubG.gain.value = 0;
      rubSrc.connect(rubF).connect(rubL).connect(grain).connect(rubG).connect(rubP);
      send(rubP, .08);
      rubSrc.start(0, rnd(0, 1.5)); stick.start();
      rubbing = { f: rubF, g: rubG, pan: rubP };
    }
    ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'].forEach(t => addEventListener(t, wake, true));
    document.addEventListener('visibilitychange', () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });

    /* The wings: a strong fundamental and second harmonic (they push the air on the down and the up stroke alike), then
       a long tail of overtones that makes it a buzz rather than a hum; every fly's a little different. No two beats are
       quite alike, so the pitch jitters by a percent or two, and the loudness flutters as the fly turns its wings to
       and from the ear. */
    function makeVoice(f0) {
      const HARM = [0, 1, .86, .52, .44, .31, .24, .2, .15, .12, .1, .085, .07, .06, .05, .042, .036, .03, .026, .022];
      const re = new Float32Array(48), im = new Float32Array(48);
      for (let k = 1; k < 48; k++) { const a = (k < HARM.length ? HARM[k] : .42 / k) * rnd(.8, 1.2), ph = rnd(0, TAU); re[k] = a * Math.cos(ph); im[k] = a * Math.sin(ph); }
      const osc = ac.createOscillator();
      osc.setPeriodicWave(ac.createPeriodicWave(re, im)); osc.frequency.value = f0;
      const jitter = loop(bufs.jitter), jg = ac.createGain(); jg.gain.value = f0 * .016;
      jitter.connect(jg).connect(osc.frequency);
      const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = .5; tone.frequency.value = 3000;
      const trem = ac.createGain();
      const shimmer = loop(bufs.shimmer), sg = ac.createGain(); sg.gain.value = .14;
      shimmer.connect(sg).connect(trem.gain);
      // and the air the wings throw about, a soft rush under the tone
      const air = loop(bufs.noise), airF = ac.createBiquadFilter(), airG = ac.createGain();
      airF.type = 'bandpass'; airF.frequency.value = 420; airF.Q.value = .7; airG.gain.value = .05;
      air.connect(airF).connect(airG).connect(trem);
      const amp = ac.createGain(); amp.gain.value = 0;
      const pan = panner();
      osc.connect(tone).connect(trem).connect(amp).connect(pan);
      send(pan, .12);
      osc.start(); jitter.start(0, rnd(0, 4)); shimmer.start(0, rnd(0, 4)); air.start(0, rnd(0, 2));
      return {
        osc, jg, tone, amp, pan,
        stop() {
          const t = ac.currentTime;
          amp.gain.setTargetAtTime(0, t, .02);
          for (const s of [osc, jitter, shimmer, air]) s.stop(t + .2);
          setTimeout(() => pan.disconnect(), 400);
        },
      };
    }
    // The swing: air rushing through the mesh, rising in pitch and loudness as the head speeds up, cut off by the glass.
    function swish(x) {
      if (!live()) return;
      const t = ac.currentTime, t0 = t + T_WIND / 1000, t1 = t + STRIKE / 1000;
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), p = panner();
      s.buffer = bufs.noise; f.type = 'bandpass'; f.Q.value = 1.1;
      f.frequency.setValueAtTime(300, t); f.frequency.setValueAtTime(350, t0); f.frequency.exponentialRampToValueAtTime(rnd(1800, 2600), t1);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(SLAP * .025, t0); g.gain.exponentialRampToValueAtTime(SLAP * .22, t1);
      g.gain.setTargetAtTime(0, t1, .003);
      setPan(p, panAt(x));
      s.connect(f).connect(g).connect(p); send(p, .1);
      s.start(t, rnd(0, 1.5)); s.stop(t1 + .05);
    }
    /* The slap: a crack as the flat plastic meets the glass, the head ringing for a moment, a dull thump from the screen
       and the desk under it, a puff of air squeezed out from under the head, then the handle rattling in the hand as it
       springs back. Wet, a squelch, if there was a fly under it. Made afresh every time, so no two sound quite alike. */
    function slap(x, wet) {
      if (!live()) return;
      const modes = [[rnd(540, 700), .5, .026], [rnd(1150, 1450), .42, .018], [rnd(1900, 2400), .36, .013], [rnd(3000, 3700), .26, .01], [rnd(4600, 5600), .18, .007]];
      const thump = rnd(90, 135);
      const buf = render(.45, (d, sr) => {
        let hp = 0, prev = 0, lo = 0, mid = 0;
        for (let i = 0; i < d.length; i++) {
          const t = i / sr, n = Math.random() * 2 - 1;
          hp = .7 * (hp + n - prev); prev = n; lo += (n - lo) * .03; mid += (n - mid) * .25;
          let v = 1.3 * hp * Math.exp(-t / .003);
          for (const [f, a, tau] of modes) v += a * Math.sin(TAU * f * t) * Math.exp(-t / tau);
          v += .9 * Math.sin(TAU * thump * t * (1 - t * 2)) * Math.exp(-t / .05) * Math.min(1, t / .002);
          v += 2.2 * lo * Math.exp(-t / .012);
          const r = t - T_HOLD / 1000;
          if (r > 0) v += .35 * mid * Math.abs(Math.cos(TAU * 21 * r)) * Math.exp(-r / .07);
          if (wet) v += wet * 3 * lo * Math.exp(-t / .06) * Math.min(1, t / .004);
          d[i] = v;
        }
        norm(d);
      });
      play(buf, x, SLAP * rnd(.85, 1), rnd(.96, 1.04), .3);
    }
    // The rag's hiss, set every frame from how fast it is pulled and what is under it.
    function rubSound(dt) {
      const t = ac.currentTime, sp = RAG.speed;
      rubbing.g.gain.setTargetAtTime(RUB * Math.min(1, sp / 800) ** .7 * (RAG.wet > .2 ? .7 : 1), t, .025);
      rubbing.f.frequency.setTargetAtTime(RAG.wet > .2 ? 480 : 800 + Math.min(sp, 1500) * .5, t, .05);
      setPan(rubbing.pan, panAt(RAG.x), t);
      if (rub && RAG.wet < .05 && sp > 150 && sp < 900 && Math.random() < dt * .5) squeak(RAG.x);
    }
    // Clean glass squeaks now and then under a dry cloth: it sticks and slips a few thousand times a second.
    function squeak(x) {
      const t = ac.currentTime, len = rnd(.06, .2), f = rnd(1300, 2600);
      const o = ac.createOscillator(), v = ac.createOscillator(), vg = ac.createGain(), g = ac.createGain(), p = panner();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * rnd(.9, 1.12), t + len);
      v.frequency.value = rnd(25, 60); vg.gain.value = f * .03;
      v.connect(vg).connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(SQUEAK, t + .012); g.gain.setTargetAtTime(0, t + len, .015);
      setPan(p, panAt(x));
      o.connect(g).connect(p); send(p, .15);
      o.start(t); v.start(t); o.stop(t + len + .1); v.stop(t + len + .1);
    }

    /* ── a fly ── each its own body, legs, mind and voice; the tools, the smears and the pointer they share. */
    function makeFly() {
      const wrap = document.createElement('div');
      wrap.className = 'fly';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = FLY_SVG;
      if (hidden) wrap.style.visibility = 'hidden';
      root.appendChild(wrap);
      const q = s => wrap.querySelector(s);
      const bodyG = q('.fly-body'), headG = q('.fly-head'), underG = q('.fly-legs'), overG = q('.fly-over');
      const wingEls = wrap.querySelectorAll('.fly-wing'), fanEls = wrap.querySelectorAll('.fly-fan');
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

      const P = { x: 0, y: 0, a: 0, v: 0, w: 0, vT: 0, wT: 0, sway: 0, swayT: 0, head: 0, headT: 0, wingL: WING_REST, wingR: WING_REST, alt: 0, k: 1 };
      const seed = Math.random() * 100;
      let mode = 'still', until = 0, after = null, heading = 0, walkSpeed = 0, turnRate = 0;
      let twitchAt = 0, nudgeUntil = 0, lookUntil = 0, flickUntil = 0, waryUntil = 0, alarmUntil = 0, escapeAt = 0, escapeFrom = null;
      let seq = null, flight = null, lastTripod = 1, stillFor = 0, force = true;
      let deadAt = 0, deadWings = [0, 0], goo = null, entry = null, smear = null, retiring = false, destroyed = false;
      let voice = null, fBase = rnd(180, 215), kickAt = -1e9, lastV = [0, 0], effort = 0, flutter = 0, flutterT = 0, buzzing = false;

      const drawn = () => P.a + P.sway * DEG;
      const toWorld = l => { const c = Math.cos(drawn()), s = Math.sin(drawn()); return [P.x + (l[0] * c - l[1] * s) * S, P.y + (l[0] * s + l[1] * c) * S]; };
      const toLocal = w => { const c = Math.cos(drawn()), s = Math.sin(drawn()), dx = (w[0] - P.x) / S, dy = (w[1] - P.y) / S; return [dx * c + dy * s, dy * c - dx * s]; };
      const strain = L => Math.hypot(L.loc[0] - L.g.rest[0], L.loc[1] - L.g.rest[1]);
      const alive = () => mode !== 'dead' && mode !== 'gone';
      const others = () => flies.filter(f => f !== fly && f.alive() && f.mode !== 'flight');
      const jumpy = now => now < alarmUntil ? 1.4 : 1;   // for a while after a slap close by

      function place(x, y, a) {
        Object.assign(P, { x, y, a, v: 0, w: 0, vT: 0, wT: 0 });
        for (const L of legs) {
          L.mode = 'stance'; L.ank = null; setOver(L, false);
          L.loc = [L.g.rest[0] + rnd(-.4, .4), L.g.rest[1] + rnd(-.4, .4)];
          L.w = toWorld(L.loc);
        }
        force = true;
      }

      /* ── legs ── a planted foot stays where it is on the glass; the body walks over it until it lags too far */
      function lead(r) {
        const mx = P.v / S - P.w * r[1], my = P.w * r[0], m = Math.hypot(mx, my);
        if (m < .5) return [0, 0];
        const t = Math.min(.2, .85 * THR / m);
        return [mx * t, my * t];
      }
      function swing(L, jit, dur) { L.mode = 'swing'; L.t = 0; L.dur = dur; L.from = L.w.slice(); L.jit = jit; }
      function script(L, fn, over) { L.mode = 'script'; L.fn = fn; L.t0 = clock(); L.sFrom = L.loc.slice(); setOver(L, !!over); }
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
        if (mode === 'flight' || mode === 'dead' || legs.some(L => L.mode === 'swing')) return;
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
        const bend = L.splay ? (vx < 0 ? -1 : 1) * Math.sign(hy) : L.g.bend;
        const along = (lf * lf - lt * lt + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, lf * lf - along * along)) * bend;
        const kx = hx + vx * along - vy * h, ky = hy + vy * along + vx * h, tx = hx + vx * reach, ty = hy + vy * reach;
        L.fe.setAttribute('d', `M${n2(hx)} ${n2(hy)}L${n2(kx)} ${n2(ky)}`);
        L.ti.setAttribute('d', `M${n2(kx)} ${n2(ky)}L${n2(tx)} ${n2(ty)}`);
        // a dead fly's tarsi curl towards the head
        L.ta.setAttribute('d', L.splay ? `M${n2(tx)} ${n2(ty)}Q${n2((tx + fx) / 2 + 1.2)} ${n2((ty + fy) / 2)} ${n2(fx)} ${n2(fy)}` : `M${n2(tx)} ${n2(ty)}L${n2(fx)} ${n2(fy)}`);
      }

      /* ── behaviour ── a fly on a window is seldom quite still for long: it creeps a few steps, stops, walks a short bout,
         turns sharply, grooms; now and then it rests a while. It flies off when something comes at it, and keeps a little
         apart from the other flies. */
      function still(now, ms) { mode = 'still'; P.vT = P.wT = 0; until = now + (ms || (Math.random() < .15 ? rnd(2500, 6000) : rnd(500, 2200))); twitchAt = now + rnd(500, 2200); }
      function decide(now) {
        const r = Math.random();
        if (r < .015 * lv().hop) return hop(now);
        if (r < .45) return walk(now);
        if (r < .77) return walk(now, false, true);
        if (r < .85) return turn(now, chooseHeading(), n => Math.random() < .6 ? walk(n, false, true) : still(n, rnd(600, 2000)));
        if (r < .93) return groom(now, pick(SEQS));
        still(now);
      }
      // A bout of walking; slow, it creeps a few mm, the way a fly shifts about on the glass between other things.
      function walk(now, flee, slow) {
        const h = chooseHeading(flee);
        const go = n => {
          mode = 'walk'; heading = h;
          walkSpeed = flee ? rnd(85, 120) : slow ? rnd(10, 24) : rnd(28, 62);
          until = n + (flee ? rnd(450, 800) : slow ? rnd(400, 1600) : rnd(250, 1500));
        };
        if (Math.abs(angDiff(h, P.a)) > 35 * DEG) turn(now, h, go); else go(now);
      }
      function turn(now, h, then) { mode = 'turn'; heading = h; after = then; turnRate = rnd(3.5, 6.5); P.vT = rnd(0, 5); until = now + 1500; }
      function chooseHeading(flee) {
        let best = P.a, top = -Infinity;
        const near = others();
        for (let k = 0; k < 12; k++) {
          const h = P.a + (k ? rnd(-Math.PI, Math.PI) : 0), ex = P.x + Math.cos(h) * 120, ey = P.y + Math.sin(h) * 120;
          let s = Math.random() * .8 - Math.abs(angDiff(h, P.a)) * (flee ? .1 : .5);
          s -= (Math.max(0, 30 - ex) + Math.max(0, ex - W + 30) + Math.max(0, 30 - ey) + Math.max(0, ey - H + 30)) / 25;
          if (M.on) s -= Math.max(0, 280 - Math.hypot(ex - M.x, ey - M.y)) / (flee ? 30 : 70);
          for (const o of near) s -= Math.max(0, 70 - Math.hypot(ex - o.P.x, ey - o.P.y)) / 50;
          s += Math.max(Math.abs(ex / W - .5), Math.abs(ey / H - .5)) * .6;
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
        if (!kind) { seq = null; return still(now, rnd(500, 2500)); }
        const K = GROOM[kind], t0 = now;
        seq.cur = kind; seq.t0 = now; seq.end = now + (seq.short ? rnd(350, 800) : rnd(K.ms[0], K.ms[1]));
        K.legs.forEach(i => script(legs[i], n => K.pos(i, n - t0, P), K.over));
      }

      /* ── flight ── */
      function landing(hop) {
        let best = null, top = -Infinity;
        const near = others();
        for (let k = 0; k < 24; k++) {
          const x = rnd(40, W - 40), y = rnd(70, H - 40), dp = Math.hypot(x - P.x, y - P.y);
          if (dp < (hop ? 110 : 140) || (hop && dp > 380)) continue;
          const dm = M.on ? Math.hypot(x - M.x, y - M.y) : 700;
          if (dm < 260) continue;
          let s = Math.min(dm, 800) / 800 + Math.max(Math.abs(x / W - .5), Math.abs(y / H - .5)) * 1.8 + Math.random() * .6;
          for (const o of near) if (Math.hypot(x - o.P.x, y - o.P.y) < 80) s -= 1;
          if (s > top) { top = s; best = [x, y]; }
        }
        return best || [P.x < W / 2 ? W - 60 : 60, H - 60];
      }
      function launch(now, dest, dir, zig, v0 = 300) {
        stopGroom(); after = null; escapeAt = 0;
        const first = [clamp(P.x + dir[0] * rnd(50, 100) + rnd(-25, 25), 30, W - 30), clamp(P.y + dir[1] * rnd(50, 100) + rnd(-25, 25), 30, H - 30)], pts = [first];
        for (let k = 1; k <= zig; k++) {
          const t = k / (zig + 1), nx = first[1] - dest[1], ny = dest[0] - first[0], nl = Math.hypot(nx, ny) || 1, o = rnd(-150, 150);
          pts.push([clamp(first[0] + (dest[0] - first[0]) * t + nx / nl * o, 30, W - 30), clamp(first[1] + (dest[1] - first[1]) * t + ny / nl * o, 30, H - 30)]);
        }
        pts.push(dest);
        flight = { pts, idx: 0, vx: dir[0] * v0, vy: dir[1] * v0, t0: now, down: false };
        kickAt = now; lastV = [flight.vx, flight.vy];
        mode = 'flight'; P.v = P.w = P.vT = P.wT = 0; P.headT = 0;
        for (const L of legs) { const t = tuck(L.g); script(L, () => t, false); }
      }
      function takeoff(now, fx, fy, v0) {
        if (mode === 'flight' || !alive()) return;
        const d = Math.hypot(P.x - fx, P.y - fy), a = rnd(0, TAU);
        const dir = d > 5 ? [(P.x - fx) / d, (P.y - fy) / d] : [Math.cos(a), Math.sin(a)];
        launch(now, landing(false), dir, Math.floor(rnd(1, 4)), v0);
      }
      function hop(now) { launch(now, landing(true), [Math.cos(P.a), Math.sin(P.a)], 1); }
      function flightStep(now, dt) {
        const F = flight, [tx, ty] = F.pts[F.idx], last = F.idx === F.pts.length - 1;
        const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || .001;
        const vmax = last && !F.exit ? Math.min(850, 40 + d * 5.5) : 850;
        let ex = dx / d * vmax - F.vx, ey = dy / d * vmax - F.vy;
        const el = Math.hypot(ex, ey), acc = 6500 * dt;
        if (el > acc) { ex *= acc / el; ey *= acc / el; }
        F.vx += ex; F.vy += ey;
        const sp = Math.hypot(F.vx, F.vy) || 1;
        if (!last || d > 60) { const j = rnd(-1, 1) * 2400 * dt; F.vx -= F.vy / sp * j; F.vy += F.vx / sp * j; }
        P.x += F.vx * dt; P.y += F.vy * dt;
        const m = 38;   // the whole fly, wing blur included, stays on screen; it bounces off the edges
        if (F.enter && inside(P.x, P.y, m)) F.enter = false;   // except a newcomer, which flies in from beyond the edge,
        if (!F.enter && !F.exit) {                             // and one on its way out
          if (P.x < m || P.x > W - m) { P.x = clamp(P.x, m, W - m); F.vx = (P.x < W / 2 ? 1 : -1) * Math.abs(F.vx) * .6; }
          if (P.y < m || P.y > H - m) { P.y = clamp(P.y, m, H - m); F.vy = (P.y < H / 2 ? 1 : -1) * Math.abs(F.vy) * .6; }
        }
        if (sp > 30) P.a += angDiff(Math.atan2(F.vy, F.vx), P.a) * Math.min(1, dt * 14);
        if (!last && d < 45) F.idx++;
        P.alt = F.air ? 1 : clamp((now - F.t0) / 90, 0, 1);
        if (!last) return;
        if (F.exit) { if (d < 40 || !inside(P.x, P.y, -50)) destroy(); return; }
        P.alt = Math.min(P.alt, d / 70);
        if (d < 26 && !F.down) { F.down = true; for (const L of legs) script(L, () => L.g.rest, false); }
        if (d < 1.5 && sp < 70) land(now);
      }
      function land(now) {
        flight = null; P.alt = 0; P.v = P.w = P.vT = P.wT = 0; wrap.style.opacity = '';
        for (const L of legs) { L.mode = 'stance'; L.ank = null; setOver(L, false); L.w = toWorld(L.loc); }
        if (Math.random() < .35) groom(now, pick(SEQS), false, rnd(250, 700)); else still(now, rnd(400, 1800));
      }

      /* ── the swatter and the fly ── */
      // A swatter coming down near it: it may see it and be off before it lands, sooner the harder the level.
      function threat(now, x, y) {
        if (!alive() || mode === 'flight' || Math.hypot(P.x - x, P.y - y) > 160) return;
        const L = lv(), base = mode === 'groom' ? .2 : mode === 'still' ? .35 : .5;
        if (Math.random() < Math.min(.92, base * L.see * jumpy(now))) { escapeAt = now + rnd(L.react[0], L.react[1]); escapeFrom = [x, y]; }
      }
      function under(x, y) {
        const dx = P.x - x, dy = P.y - y, c = Math.cos(SWAT_TILT * DEG), s = Math.sin(SWAT_TILT * DEG);
        return Math.abs(dx * c - dy * s) < 41 && Math.abs(dx * s + dy * c) < 46;
      }
      // The swatter has come down at (x, y). Under it, the fly is hit, and the goo it gives up is returned; close by,
      // the slap may send it off, and it stays jumpy for a while.
      function struck(now, x, y) {
        if (mode === 'gone') return 0;
        if (under(x, y)) {
          if (alive()) { die(now); return .5; }
          const w = goo.amount * .8;
          squash(now);
          return w;
        }
        const d = Math.hypot(P.x - x, P.y - y);
        if (!alive() || d > 260) return 0;
        alarmUntil = now + 12000;
        if (Math.random() < lv().startle * (1 - d / 520)) takeoff(now, x, y);
        return 0;
      }
      function die(now) {
        stopGroom(); flight = null; after = null; escapeAt = 0;
        Object.assign(P, { alt: 0, k: 1, v: 0, w: 0, vT: 0, wT: 0, sway: 0, swayT: 0, headT: rnd(-15, 15), a: P.a + rnd(-.6, .6) });
        mode = 'dead'; deadAt = now;
        goo = { slip: false, until: now + rnd(3500, 5000), v: 0, target: 0, start: 0, dx: rnd(-.15, .15), rot: rnd(-.003, .003), amount: 1, hits: 0, shaken: now };
        smear = startSmear(P.x, P.y);
        splash(smear, P.x, P.y, 1);
        deadWings = [rnd(55, 100), rnd(55, 100)];
        wrap.classList.add('fly-dead'); wrap.style.opacity = '';
        wingEls.forEach(w => bodyG.insertBefore(w, bodyG.firstChild));
        for (const L of legs) {
          overG.append(L.fe, L.ti, L.ta); L.over = true; L.splay = true;
          L.fe.setAttribute('stroke-width', .8); L.ti.setAttribute('stroke-width', .56); L.ta.setAttribute('stroke-width', .38);
          script(L, n => curl(L, n - now), true);
        }
      }
      // Hit again: it sprays, keeps less goo, is pressed flatter and sticks to the glass for a while before it slides on.
      function squash(now) {
        const before = goo.amount;
        goo.hits++; goo.amount = Math.max(.08, goo.amount * .62);
        goo.slip = false; goo.v = goo.target = 0; goo.until = now + rnd(2000, 4000); goo.shaken = now;
        P.k = Math.min(1.15, 1 + .05 * goo.hits);
        deadWings = deadWings.map(w => clamp(w + rnd(-12, 12), 50, 110));
        for (const L of legs) script(L, n => curl(L, n - now, .6), true);
        splatAt(smear, P.x, P.y, before * .7);
        splash(smear, P.x, P.y, before);
      }
      // Stuck to the glass by its own goo, it slides down in fits: the goo holds, lets go, holds again, and it speeds up as the goo runs out.
      function deadStep(now, dt) {
        if (now > goo.until) {
          goo.slip = !goo.slip;
          if (goo.slip && !goo.start) goo.start = now;
          goo.until = now + (goo.slip ? rnd(600, 2400) : rnd(250, 1300));
          goo.target = goo.slip ? rnd(16, 48) * (1 + (now - goo.start) / 15000) * (1.5 - .5 * goo.amount) : 0;
        }
        goo.v = approach(goo.v, goo.target, dt, .3);
        const moving = goo.v > .3;
        if (moving) {
          goo.dx = clamp(goo.dx + rnd(-.02, .02), -.2, .2);
          P.y += goo.v * dt; P.x += goo.v * dt * goo.dx; P.a += goo.v * dt * goo.rot;
          growSmear(smear, P.x, P.y, goo.amount);
        }
        if (now - goo.shaken < 3800 || moving) {
          P.head = approach(P.head, P.headT, dt, .1);
          P.wingL = approach(P.wingL, deadWings[0], dt, .05); P.wingR = approach(P.wingR, deadWings[1], dt, .05);
          stepLegs(dt, now);
          draw();
        }
        if (P.y - 30 > H) gone(now);
      }
      // Slid off the screen or wiped up with the rag: another comes in five seconds, unless it is one too many.
      function gone(now) {
        mode = 'gone'; wrap.style.display = 'none'; until = now + 5000; smear = endSmear(smear, now);
        if (retiring) return destroy();
        // where the next one will come in, chosen now so that it can be heard coming before it is seen
        entry = anyEdge(); fBase = rnd(180, 215);
      }
      function revive() {
        wrap.classList.remove('fly-dead');
        wingEls.forEach(w => bodyG.insertBefore(w, overG));
        for (const L of legs) {
          underG.append(L.fe, L.ti, L.ta); L.over = false; L.splay = false;
          L.fe.setAttribute('stroke-width', 1.05); L.ti.setAttribute('stroke-width', .72); L.ta.setAttribute('stroke-width', .46);
        }
        wrap.style.display = ''; wrap.style.opacity = '';
        smear = endSmear(smear, clock());
      }
      function respawn(now) {
        revive();
        const [x, y] = entryAt(entry || anyEdge(), 0);
        place(x, y, 0);
        const dest = landing(false);
        P.a = Math.atan2(dest[1] - P.y, dest[0] - P.x);
        launch(now, dest, [Math.cos(P.a), Math.sin(P.a)], 1, 600);
        flight.enter = flight.air = true; P.alt = 1;
      }
      // No longer wanted: it flies off over the nearest edge, or, dead, is let go once it has slid off or been wiped up.
      function retire() {
        retiring = true;
        if (mode === 'gone') return destroy();
        if (mode === 'dead') return;
        const edges = [P.x, W - P.x, P.y, H - P.y], side = edges.indexOf(Math.min(...edges));
        const e = { side, u: clamp(side < 2 ? (P.y - 60) / (H - 120) : (P.x - 60) / (W - 120), 0, 1) };
        const [x, y] = entryAt(e, 100), d = Math.hypot(x - P.x, y - P.y) || 1;
        launch(clock(), [x, y], [(x - P.x) / d, (y - P.y) / d], 0, 400);
        flight.exit = true;
      }
      function destroy() {
        if (destroyed) return;
        destroyed = true;
        wrap.remove();
        smear = endSmear(smear, clock());
        if (voice) voice.stop();
        const i = flies.indexOf(fly);
        if (i >= 0) flies.splice(i, 1);
      }

      /* ── senses ── */
      function perceive(now) {
        if (!M.on || mode === 'flight') return;
        const dx = P.x - M.x, dy = P.y - M.y, d = Math.hypot(dx, dy) || 1;
        const toward = now - M.t < 100 ? (M.vx * dx + M.vy * dy) / d : 0;
        if (tool === 'swatter') {
          // A swatter held still or moved slowly does not bother it; one that swoops at it may.
          const L = lv();
          if (d < 230 && toward > L.swoop && now > waryUntil) { waryUntil = now + 700; if (Math.random() < L.shy * jumpy(now)) takeoff(now, M.x, M.y); }
          return;
        }
        const big = tool === 'rag' ? 1.5 : 1;   // a hand with a cloth in it looms larger
        if (d < 70 * big || (d < 220 * big && toward > 450)) return takeoff(now, M.x, M.y);
        if (d < 150 * big && mode !== 'walk' && mode !== 'turn' && now > waryUntil) { waryUntil = now + 1200; stopGroom(); walk(now, true); }
      }

      /* ── frame ── */
      function behave(now, dt) {
        if (mode === 'still') {
          if (now > nudgeUntil) P.wT = 0;
          if (now > lookUntil) P.headT = 0;
          if (now > twitchAt) twitch(now);
          if (now > until) decide(now);
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
          const ax = P.x + Math.cos(P.a) * 45, ay = P.y + Math.sin(P.a) * 45;
          if (!inside(ax, ay, 30) || (walkSpeed < 80 && M.on && Math.hypot(ax - M.x, ay - M.y) < 150) ||
            others().some(o => Math.hypot(ax - o.P.x, ay - o.P.y) < 30)) {
            P.vT = 0;
            return turn(now, chooseHeading(), n => Math.random() < .6 ? walk(n) : still(n));
          }
          if (now > until) {
            P.vT = 0;
            const r = Math.random();
            if (r < .4) still(now, rnd(300, 1800)); else if (r < .67) walk(now); else if (r < .93) walk(now, false, true); else groom(now, pick(SEQS));
          }
        } else if (mode === 'groom') groomStep(now);
        else if (mode === 'flight') flightStep(now, dt);
      }
      function draw() {
        wrap.style.transform = `translate3d(${n2(P.x - HALF)}px,${n2(P.y - HALF)}px,0)`;
        bodyG.setAttribute('transform', `rotate(${(drawn() / DEG).toFixed(3)}) scale(${n2(P.k)})`);
        headG.setAttribute('transform', `rotate(${n2(P.head)} 6.9 0)`);
        [P.wingL, P.wingR].forEach((deg, i) => {
          const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), sg = i ? 1 : -1;
          wingEls[i].setAttribute('transform', `matrix(${n2(-c)} ${n2(s * sg)} ${n2(s)} ${n2(c * sg)} ${ROOT[0]} ${ROOT[1] * sg})`);
          wingEls[i].style.opacity = P.alt ? n2(1 - P.alt * .6) : '';
          fanEls[i].style.opacity = n2(P.alt);
        });
        const a = P.alt;
        wrap.style.filter = a > .01 ? `blur(${n2(a * .4)}px) drop-shadow(0 0 .4px rgba(255,255,255,.5)) drop-shadow(${n2(a * 6)}px ${n2(1 + a * 10)}px ${n2(1.1 + a * 2.5)}px rgba(0,0,0,${n2(.3 - a * .17)}))` : '';
        legs.forEach(drawLeg);
      }
      function tick(now, dt) {
        if (escapeAt && now >= escapeAt) { escapeAt = 0; takeoff(now, escapeFrom[0], escapeFrom[1], 950); }
        if (mode === 'dead') return deadStep(now, dt);
        if (mode === 'gone') { if (now > until) respawn(now); return; }
        perceive(now);
        behave(now, dt);
        if (destroyed) return;
        if (mode !== 'flight') {
          P.v = approach(P.v, P.vT, dt, .05); P.w = approach(P.w, P.wT, dt, .04);
          P.a += P.w * dt;
          P.x = clamp(P.x + Math.cos(P.a) * P.v * dt, 20, W - 20);
          P.y = clamp(P.y + Math.sin(P.a) * P.v * dt, 20, H - 20);
        }
        P.head = approach(P.head, P.headT, dt, .06);
        P.sway = approach(P.sway, P.swayT, dt, .03); P.swayT = approach(P.swayT, 0, dt, .07);
        P.k = 1 + .3 * P.alt;
        if (mode === 'flight') { const b = rnd(18, 100); P.wingL = b + rnd(-4, 4); P.wingR = b + rnd(-4, 4); }
        else {
          const base = WING_REST + (now < flickUntil ? 18 : 0), g = seq && seq.cur && GROOM[seq.cur].wing;
          P.wingL = approach(P.wingL, base + (g === 0 ? 8 : 0), dt, .035);
          P.wingR = approach(P.wingR, base + (g === 1 ? 8 : 0), dt, .035);
        }
        stepLegs(dt, now);
        const busy = mode !== 'still' || P.alt > 0 || Math.abs(P.v) > .05 || Math.abs(P.w) > .002 || Math.abs(P.head - P.headT) > .05 ||
          Math.abs(P.sway) > .01 || Math.abs(P.wingL - WING_REST) > .05 || Math.abs(P.wingR - WING_REST) > .05 || legs.some(L => L.mode !== 'stance');
        if (busy || force) { draw(); force = false; }
      }
      // The buzz, set every frame from where the fly is and what it is doing.
      function sing(now, dt) {
        if (!voice) voice = makeVoice(fBase);
        let on = !hidden && mode === 'flight', x = P.x, y = P.y, z = P.alt, fade = 1;
        if (!hidden && mode === 'gone' && entry && now > until - APPROACH) {   // the next one, still out of sight, coming closer
          const k = (until - now) / APPROACH;
          [x, y] = entryAt(entry, 2600 * k); z = 1; on = true; fade = Math.min(1, (1 - k) * 5);
        }
        const t = ac.currentTime, F = flight;
        let f = fBase;
        if (F) {
          effort = approach(effort, clamp(Math.hypot(F.vx - lastV[0], F.vy - lastV[1]) / Math.max(dt, .001) / 6500, 0, 1), dt, .06);
          lastV = [F.vx, F.vy];
          f *= .96 + .045 * Math.min(1, Math.hypot(F.vx, F.vy) / 850) + .04 * effort;   // it beats a little faster when it works harder
        }
        f *= 1 + .07 * Math.exp(-(now - kickAt) / 160);   // and hardest of all as it takes off
        if (Math.random() < dt * 9) flutterT = rnd(-1, 1);
        flutter = approach(flutter, flutterT, dt, .05);
        const near = EAR / Math.hypot(x - W / 2, y - H / 2, EAR - z * RISE);
        const level = on ? BUZZ * near * (1 + .18 * flutter) * fade : 0;
        voice.amp.gain.setTargetAtTime(level, t, on ? (buzzing ? .03 : .005) : .018);   // wings start at full beat, and stop almost as fast
        voice.osc.frequency.setTargetAtTime(f, t, .03);
        voice.jg.gain.setTargetAtTime(f * .016, t, .1);
        voice.tone.frequency.setTargetAtTime(clamp(1400 + 2600 * near ** 1.5 + 500 * flutter, 900, 7000), t, .04);
        setPan(voice.pan, panAt(x), t);
        buzzing = on;
      }

      const fly = {
        P, wrap, alive, tick, sing, threat, struck, gone, retire,
        get mode() { return mode; },
        get legs() { return legs.map(L => L.mode); },
        get retiring() { return retiring; },
        // already on the glass when the page opens
        settle() { const s = landing(false); place(s[0], s[1], rnd(0, TAU)); still(clock(), rnd(800, 2500)); },
        // heard coming, then flying in from beyond an edge at the time given
        arrive(at) { mode = 'gone'; wrap.style.display = 'none'; until = at; entry = anyEdge(); },
        // a press close by sends it off
        startle(x, y) { if (Math.hypot(x - P.x, y - P.y) < 250) takeoff(clock(), x, y); },
        fit() { if (alive() && mode !== 'flight' && !inside(P.x, P.y, 16)) place(clamp(P.x, 40, W - 40), clamp(P.y, 60, H - 40), P.a); },
        pin(x, y, deg) {
          stopGroom(); flight = null; after = null; escapeAt = 0; alarmUntil = 0; P.alt = 0;
          revive(); place(x, y, (deg || 0) * DEG);
          P.wingL = P.wingR = WING_REST; P.head = P.headT = 0;
          still(clock(), 60000);
        },
        groom: kind => groom(clock(), [kind]),
        walk: () => walk(clock()),
        hop: () => hop(clock()),
      };
      return fly;
    }

    /* ── how many, how hard ── */
    // Bring the flies to the number asked for: newcomers are heard coming and fly in from beyond an edge one after
    // another, flies no longer wanted fly off.
    function muster(initial) {
      const staying = flies.filter(f => !f.retiring), now = clock();
      for (let k = staying.length; k < settings.flies; k++) {
        const f = makeFly();
        flies.push(f);
        if (initial) f.settle(); else f.arrive(now + APPROACH + (k - staying.length) * rnd(600, 1400));
      }
      for (let k = staying.length - 1; k >= settings.flies; k--) staying[k].retire();
    }
    function configure(o) {
      if (o.level && LEVELS[o.level]) settings.level = o.level;
      if (o.flies !== undefined && +o.flies === +o.flies) { settings.flies = clamp(Math.round(+o.flies), 1, MAX_FLIES); muster(); }
      if (o.sound !== undefined) {
        settings.sound = !!o.sound;
        if (settings.sound) wake();
        if (master) master.gain.setTargetAtTime(settings.sound ? VOLUME : 0, ac.currentTime, .05);
      }
      save();
      syncPanel();
    }

    /* ── input ── */
    addEventListener('pointermove', e => {
      const now = clock(), dt = Math.max(.008, (now - M.t) / 1000);
      if (M.on && now - M.t < 200) { M.vx = M.vx * .5 + (e.clientX - M.x) / dt * .5; M.vy = M.vy * .5 + (e.clientY - M.y) / dt * .5; }
      else M.vx = M.vy = 0;
      M.x = e.clientX; M.y = e.clientY; M.t = now; M.on = true;
      M.ui = e.target === host;   // over the buttons or the panel the tool is put by, and the pointer shows
      if (rub) { if (e.buttons & 1) rubMove(e.clientX, e.clientY); else rubEnd(); }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { M.on = false; rubEnd(); });
    addEventListener('blur', rubEnd);
    addEventListener('pointerdown', e => {
      if (hidden || tool === 'swatter' || e.target === host) return;
      for (const f of flies) f.startle(e.clientX, e.clientY);
    }, true);
    // While a tool is out, a press swats or rubs instead of reaching the page; the buttons and the panel still work.
    const onToolEvent = e => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (panel && (path.includes(panel) || path.includes(settingsBtn))) return;
      const btn = path.find(n => n.hasAttribute && (n.hasAttribute('data-fly-swatter') || n.hasAttribute('data-fly-rag')));
      if (btn) {
        if (e.type === 'click') { e.preventDefault(); const t = btn.hasAttribute('data-fly-rag') ? 'rag' : 'swatter'; take(tool === t ? null : t); }
        return;
      }
      if (!tool) return;
      e.preventDefault(); e.stopPropagation();
      if (e.type === 'contextmenu') return take(null);
      if (e.type === 'pointerup' || e.type === 'pointercancel') return rubEnd();
      if (e.type !== 'pointerdown' || e.button !== 0) return;
      // a finger does not hover before it touches: the tool comes down where it does
      if (!M.on) M.vx = M.vy = 0;
      Object.assign(M, { x: e.clientX, y: e.clientY, t: clock(), on: true, ui: false });
      if (tool === 'swatter') strike(clock(), e.clientX, e.clientY); else rubStart(e.clientX, e.clientY);
    };
    ['pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach(t => addEventListener(t, onToolEvent, true));
    // A press anywhere else closes the settings.
    addEventListener('pointerdown', e => {
      if (panel && !panel.hidden && !e.composedPath().some(n => n === panel || n === settingsBtn)) openPanel(false);
    }, true);
    addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (panel && !panel.hidden) { e.preventDefault(); e.stopPropagation(); openPanel(false); settingsBtn.focus(); }
      else if (tool) { e.preventDefault(); e.stopPropagation(); take(null); }
    }, true);
    addEventListener('keydown', e => {
      if (e.code !== 'KeyF' || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      hide(!hidden);
    });
    addEventListener('resize', () => {
      W = innerWidth; H = innerHeight;
      for (const f of flies) f.fit();
    });

    /* ── frame ── */
    let last = clock();
    function frame() {
      requestAnimationFrame(frame);
      const now = clock(), dt = clamp((now - last) / 1000, 0, .05);
      tick(now, dt);
      if (live() && bufs) { for (const f of flies) f.sing(now, dt); rubSound(dt); }
      last = now;
    }
    function tick(now, dt) {
      drawSwatter(now, dt);
      drawRag(now, dt);
      if (hidden) return;
      swatStep(now);
      drySmears(now);
      stepDrops(dt);
      for (const f of flies.slice()) f.tick(now, dt);
    }

    muster(true);
    syncPanel();
    requestAnimationFrame(frame);

    function hide(on) {
      hidden = on;
      for (const f of flies) f.wrap.style.visibility = on ? 'hidden' : '';
      smearLayer.style.visibility = on ? 'hidden' : '';
    }

    // defineProperties, not assign: assign would freeze the getters into today's values
    Object.defineProperties(window.flyWatermark, Object.getOwnPropertyDescriptors({
      hide: on => hide(on !== false),
      root,
      // { flies: 1..8, level: 'easy' | 'normal' | 'hard', sound: true | false }, any of them
      set: o => configure(o || {}),
      get settings() { return Object.assign({}, settings); },
      get count() { return flies.length; },
      arm: on => take(on !== false ? 'swatter' : null),
      take: t => take(t === 'swatter' || t === 'rag' ? t : null),
      get tool() { return tool; },
      get smears() { return smears.length; },
      sound: on => configure({ sound: on !== false }),
      swat: (x, y) => strike(clock(), x, y),
      // the first fly, for trying things out
      place: (x, y, deg) => { if (flies[0]) flies[0].pin(x, y, deg); },
      groom: kind => { if (flies[0]) flies[0].groom(kind); },
      walk: () => { if (flies[0]) flies[0].walk(); },
      takeoff: () => { if (flies[0]) flies[0].hop(); },
      advance: ms => { for (let t = 0; t < ms; t += 16) { skew += 16; last = clock(); tick(last, .016); } },
      get mode() { return flies[0] ? flies[0].mode : 'gone'; },
      get modes() { return flies.map(f => f.mode); },
      get legs() { return flies[0] ? flies[0].legs : []; },
    }));
  }
})();
