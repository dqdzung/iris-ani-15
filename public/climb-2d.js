// <iris-climb-2d> — 2D layered mountain-climb progress scene (Modernist)
// API:  el.setProgress(0..1) · el.nextStage() · el.reset() · el.stageCount
// Events: 'stage' {index,name,progress} · 'summit'
(function () {
if (customElements.get('iris-climb-2d')) return;
const NS = 'http://www.w3.org/2000/svg';
const W = 1600, H = 900;

const mk = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const poly = pts => pts.map(p => p.join(',')).join(' ');
const smooth = pts => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
};

// natural mountain shape (peak at x=860); the viewBox is shifted right by 60 below
// so this peak sits centered without distorting the silhouette
const SUMMIT = [860, 150];
const OUTLINE = [[60, 780], [330, 520], [430, 585], [600, 330], [700, 395], SUMMIT,
  [1010, 410], [1120, 350], [1290, 600], [1420, 520], [1560, 780]];
const SPINE = [SUMMIT, [830, 300], [846, 470], [812, 780]];
// route: a pronounced convex arc up from the lower-left — same endpoints as the short
// version (so length is kept) but the middle bows well out to the right — then a
// switchback zigzag centered under the summit
const ROUTE = [[800, 770], [878, 726], [900, 658], [880, 590],
  [792, 516], [906, 444], [822, 372], [908, 300], [862, 222], SUMMIT];

class IrisClimb2D extends HTMLElement {
  constructor() {
    super();
    this.stages = ['Khởi hành', 'Vách đá', 'Sườn băng', 'Đỉnh IRIS'];
    this.progress = 0; this._shown = 0; this._stage = 0; this._flakes = [];
  }
  get stageCount() { return this.stages.length; }

  connectedCallback() {
    if (this._built) return; this._built = true;
    if (this.getAttribute('stages')) this.stages = this.getAttribute('stages').split('|');
    this.accent = this.getAttribute('accent') || '#ec3013';
    this.style.cssText = 'display:block;position:relative;width:100%;height:100%;overflow:hidden;background:#f3f2f2';
    this._build();
    this._raf = requestAnimationFrame(this._loop);
  }
  disconnectedCallback() { cancelAnimationFrame(this._raf); }

  _build() {
    const svg = mk('svg', {
      viewBox: `60 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice',
      width: '100%', height: '100%', style: 'display:block'
    }, this);
    this.svg = svg;

    const defs = mk('defs', {}, svg);
    const sky = mk('linearGradient', { id: 'ic-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    mk('stop', { offset: 0, 'stop-color': '#79b7e6' }, sky);
    mk('stop', { offset: .55, 'stop-color': '#a9d3ef' }, sky);
    mk('stop', { offset: 1, 'stop-color': '#dcecf7' }, sky);

    // (grain feTurbulence removed — re-rasterizing it full-screen every frame while
    // the camera animates was the main cause of lag on large/hi-dpi screens)
    const blur = mk('filter', { id: 'ic-haze', x: '-20%', y: '-60%', width: '140%', height: '260%' }, defs);
    mk('feGaussianBlur', { stdDeviation: 9 }, blur);

    const clip = mk('clipPath', { id: 'ic-mtn' }, defs);
    mk('polygon', { points: poly(OUTLINE.concat([[1560, 900], [60, 900]])) }, clip);

    // sky + sun
    mk('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#ic-sky)' }, svg);
    mk('circle', { cx: 1210, cy: 176, r: 74, fill: '#ffffff', opacity: .95 }, svg);
    mk('circle', { cx: 1210, cy: 176, r: 128, fill: '#ffffff', opacity: .5, filter: 'url(#ic-haze)' }, svg);

    // camera group (everything that parallaxes / zooms)
    const cam = mk('g', {}, svg);
    this.cam = cam;

    // far ranges
    const far = mk('g', { opacity: .55 }, cam);
    mk('polygon', { points: poly([[-140, 800], [180, 470], [330, 560], [520, 400], [700, 560], [860, 470], [1080, 600], [1240, 500], [1500, 700], [1760, 560], [1760, 900], [-140, 900]]), fill: '#d9d6d3' }, far);
    this.far = far;
    const mid = mk('g', { opacity: .85 }, cam);
    mk('polygon', { points: poly([[-120, 840], [220, 600], [420, 700], [640, 520], [880, 690], [1100, 570], [1330, 720], [1600, 620], [1760, 840], [1760, 900], [-120, 900]]), fill: '#c6c2be' }, mid);
    this.mid = mid;

    // haze band
    const haze = mk('g', {}, cam);
    this.haze = haze;
    [[520, .5, 40], [660, .4, 30]].forEach(([y, o, h]) => {
      // no blur filter here — re-blurring these big ellipses every frame (they ride
      // the animated camera) was costly; large low-opacity ellipses read soft anyway
      mk('ellipse', { cx: 700, cy: y, rx: 900, ry: h, fill: '#ffffff', opacity: o }, haze);
    });

    // main massif
    const mtn = mk('g', {}, cam);
    this.mtn = mtn;
    mk('polygon', { points: poly(OUTLINE.concat([[1560, 900], [60, 900]])), fill: '#b3afab' }, mtn);
    mk('polygon', {
      points: poly([SUMMIT, [700, 395], [600, 330], [430, 585], [330, 520], [60, 780], [60, 900], [812, 900]].concat(SPINE.slice().reverse())),
      fill: '#cfcbc7'
    }, mtn);
    mk('polygon', {
      points: poly([SUMMIT, [1010, 410], [1120, 350], [1290, 600], [1420, 520], [1560, 780], [1560, 900], [812, 900]].concat(SPINE.slice().reverse())),
      fill: '#9d9995'
    }, mtn);

    const inner = mk('g', { 'clip-path': 'url(#ic-mtn)' }, mtn);
    // snow cap
    mk('polygon', {
      points: poly([[860, 150], [946, 300], [910, 306], [956, 356], [886, 330], [852, 372], [812, 316], [792, 348], [806, 250]]),
      fill: '#fbfaf9'
    }, inner);
    mk('polygon', { points: poly([[600, 330], [652, 420], [620, 412], [648, 452], [566, 420], [578, 386]]), fill: '#f4f2f1' }, inner);
    mk('polygon', { points: poly([[1120, 350], [1176, 452], [1140, 444], [1080, 430], [1092, 392]]), fill: '#efedec' }, inner);
    // contour lines
    for (let i = 0; i < 16; i++) {
      const y = 210 + i * 46;
      const pts = [];
      for (let x = 40; x <= 1580; x += 110) pts.push([x, y + Math.sin(x / 150 + i) * 11 + Math.sin(x / 47 + i * 2) * 4]);
      mk('path', { d: smooth(pts), fill: 'none', stroke: '#201e1d', 'stroke-width': 1.1, opacity: i % 4 === 0 ? .2 : .1 }, inner);
    }
    // crevasse / rock cracks
    [[[880, 300], [854, 420], [880, 520], [846, 640]], [[1080, 470], [1130, 560], [1108, 660]],
     [[420, 620], [470, 700], [440, 790]], [[660, 420], [700, 520], [672, 620]]].forEach(p => {
      mk('path', { d: smooth(p), fill: 'none', stroke: '#201e1d', 'stroke-width': 2.2, opacity: .16, 'stroke-linecap': 'round' }, inner);
    });

    // route
    const routeD = smooth(ROUTE);
    mk('path', { d: routeD, fill: 'none', stroke: '#ffffff', 'stroke-width': 11, opacity: .5, 'stroke-linecap': 'round' }, cam);
    mk('path', { d: routeD, fill: 'none', stroke: '#6e6a66', 'stroke-width': 3.4, 'stroke-dasharray': '10 12', 'stroke-linecap': 'round', opacity: .75 }, cam);
    const done = mk('path', {
      d: routeD, fill: 'none', stroke: this.accent, 'stroke-width': 6, 'stroke-linecap': 'round',
      style: 'transition:stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)'
    }, cam);
    this.route = done;
    this.len = done.getTotalLength();
    done.setAttribute('stroke-dasharray', this.len);
    done.setAttribute('stroke-dashoffset', this.len);
    this.measure = mk('path', { d: routeD, fill: 'none', stroke: 'none' }, defs);

    // stage markers
    this.markers = this.stages.map((name, i) => {
      const t = (i + 1) / this.stages.length;
      const p = this.measure.getPointAtLength(this.len * t);
      const g = mk('g', { transform: `translate(${p.x} ${p.y})` }, cam);
      const last = i === this.stages.length - 1;
      if (!last) {
        mk('line', { x1: 0, y1: 0, x2: 0, y2: -34, stroke: '#201e1d', 'stroke-width': 3.5 }, g);
        const flag = mk('polygon', { points: '0,-34 34,-27 0,-20', fill: '#c9c5c1', style: 'transition:fill .4s' }, g);
        g.__flag = flag;
      }
      const lab = mk('g', { opacity: 0, style: 'transition:opacity .45s', display: last ? 'none' : '' }, g);
      const tw = name.length * 9.4 + 20;
      const rect = mk('rect', { x: -tw / 2, y: -74, width: tw, height: 25, fill: '#201e1d' }, lab);
      const tx = mk('text', {
        x: -tw / 2 + 10, y: -56, fill: '#fff',
        style: 'font:700 13px/1 Archivo,Helvetica,sans-serif;letter-spacing:.12em'
      }, lab);
      tx.textContent = name.toUpperCase();
      g.__lab = lab;
      return { g, t, name, last, x: p.x, rect, tx, tw };
    });

    // summit flag
    const sf = mk('g', { transform: `translate(${SUMMIT[0]} ${SUMMIT[1]})`, opacity: 0, style: 'transition:opacity .5s' }, cam);
    mk('line', { x1: 0, y1: 4, x2: 0, y2: -78, stroke: '#201e1d', 'stroke-width': 5 }, sf);
    this.cloth = mk('path', { d: '', fill: this.accent }, sf);
    const st = mk('text', { x: 16, y: -51, fill: '#fff', style: 'font:700 18px/1 Archivo,Helvetica,sans-serif;letter-spacing:.12em' }, sf);
    st.textContent = 'IRIS';
    this.summitFlag = sf; this.summitText = st;

    // climber — dressed up: jacket (torso + arms), pants (legs), backpack, helmeted
    // head and an ice axe. Limbs stay lines so the clamber animation still drives them.
    const cl = mk('g', {}, cam);
    this.climber = cl;
    const JACKET = this.accent, PANTS = '#22314f', PACK = '#1c2740', SKIN = '#e8a06a', HELMET = '#f2c94c';
    const limb = (w, color) => ({ stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none' });
    mk('rect', { x: -13, y: -31, width: 9, height: 16, rx: 2.5, fill: PACK }, cl);       // backpack
    this.legA = mk('line', { x1: 0, y1: -14, x2: -7, y2: 0, ...limb(6, PANTS) }, cl);
    this.legB = mk('line', { x1: 0, y1: -14, x2: 7, y2: 0, ...limb(6, PANTS) }, cl);
    mk('line', { x1: 0, y1: -30, x2: 0, y2: -12, ...limb(10, JACKET) }, cl);             // torso/jacket
    this.armA = mk('line', { x1: 0, y1: -26, x2: -10, y2: -16, ...limb(5, JACKET) }, cl);
    this.armB = mk('line', { x1: 0, y1: -26, x2: 11, y2: -34, ...limb(5, JACKET) }, cl);
    mk('circle', { cx: 0, cy: -37, r: 6.5, fill: SKIN }, cl);                            // head
    mk('path', { d: 'M -7.5 -37 A 7.5 7.5 0 0 0 7.5 -37 Z', fill: HELMET }, cl);         // helmet dome
    // hiking pole: from the hand down to a planted tip on the ground
    this.axe = mk('line', { x1: 11, y1: -34, x2: 22, y2: 2, stroke: '#5a5a5a', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, cl);

    // snow
    const snow = mk('g', {}, svg);
    this.snowG = snow;
    for (let i = 0; i < 40; i++) {
      const r = 1.4 + Math.random() * 2.6;
      const f = mk('circle', { cx: Math.random() * W, cy: Math.random() * H, r, fill: '#ffffff', opacity: .35 + Math.random() * .5 }, snow);
      this._flakes.push({ n: f, x: Math.random() * W, y: Math.random() * H, s: 12 + Math.random() * 34, d: Math.random() * 6.28, r });
    }

    this.confettiG = mk('g', {}, svg);
    this._confetti = [];
    this.fwG = mk('g', {}, this.cam); // fireworks live inside the camera group
    this._fw = []; this._fwLeft = 0; this._fwGap = 0;
  }

  setProgress(p, opts = {}) {
    p = Math.min(1, Math.max(0, p));
    this.progress = p;
    if (opts.instant) this._shown = p;
    this.route.setAttribute('stroke-dashoffset', this.len * (1 - p));
    const idx = Math.round(p * this.stages.length);
    if (idx !== this._stage) {
      this._stage = idx;
      this.dispatchEvent(new CustomEvent('stage', { detail: { index: idx, name: this.stages[idx - 1] || null, progress: p } }));
    }
    this.markers.forEach(m => {
      const on = p >= m.t - 0.001;
      if (m.g.__flag) m.g.__flag.setAttribute('fill', on ? this.accent : '#c9c5c1'); // red once reached
      m.g.__lab.setAttribute('opacity', on ? 1 : 0);
    });
    this.summitFlag.setAttribute('opacity', p > .995 ? 1 : 0);
    if (p >= 1 && !this._done) { this._done = true; this._burst(); this._fireworks(); this.dispatchEvent(new CustomEvent('summit')); }
    if (p < 1) { this._done = false; this._fwLeft = 0; }
    return this;
  }
  nextStage() { return this.setProgress(Math.min(1, (Math.floor(this.progress * this.stages.length + 1e-4) + 1) / this.stages.length)); }
  reset() { this._done = false; return this.setProgress(0); }
  setSnow(v) { this.snowG.style.display = v ? '' : 'none'; }

  _burst() {
    for (let i = 0; i < 60; i++) {
      const s = 5 + Math.random() * 8;
      const n = mk('rect', { x: -s / 2, y: -s / 2, width: s, height: s, fill: i % 3 ? this.accent : '#201e1d' }, this.confettiG);
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.1, v = 380 + Math.random() * 460;
      this._confetti.push({ n, x: SUMMIT[0], y: SUMMIT[1] - 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 360, vr: (Math.random() - .5) * 700, life: 0 });
    }
  }

  // fireworks: schedule several bursts high in the sky above the peak
  _fireworks() { this._fwLeft = 8; this._fwGap = 0; }
  _launchBurst() {
    const COLORS = ['#ec3013', '#f2c94c', '#4a90d9', '#e85aa0', '#7ed957', '#ff8c42'];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const cx = 640 + Math.random() * 440, cy = 20 + Math.random() * 180;
    const N = 22 + Math.floor(Math.random() * 12);
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.25;
      const v = 110 + Math.random() * 95;
      const n = mk('circle', { cx, cy, r: 2.2 + Math.random() * 1.8, fill: color }, this.fwG);
      this._fw.push({ n, x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0 });
    }
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    const now = performance.now(), dt = Math.min(.05, (now - (this._last || now)) / 1000);
    this._last = now; this._t = (this._t || 0) + dt;
    const t = this._t;

    this._shown += (this.progress - this._shown) * Math.min(1, dt * 2.2);
    const p = this._shown, moving = Math.abs(this.progress - p) > .0015;

    // climber along the route
    const at = this.measure.getPointAtLength(this.len * Math.min(.9995, p));
    const nx = this.measure.getPointAtLength(this.len * Math.min(1, p + .004));
    const ang = Math.atan2(nx.y - at.y, nx.x - at.x) * 180 / Math.PI;
    const bob = moving ? Math.abs(Math.sin(t * 9)) * 2.2 : Math.sin(t * 1.6) * .8;
    this.climber.setAttribute('transform', `translate(${at.x} ${at.y - bob}) rotate(${Math.max(-16, Math.min(16, ang + 90))}) scale(1.25)`);
    const sw = moving ? Math.sin(t * 9) : Math.sin(t * 1.5) * .12;
    this.legA.setAttribute('x2', -7 + sw * 5); this.legA.setAttribute('y2', -Math.abs(sw) * 4);
    this.legB.setAttribute('x2', 7 - sw * 5); this.legB.setAttribute('y2', -Math.abs(sw) * 2);
    this.armA.setAttribute('x2', -10 - sw * 3); this.armA.setAttribute('y2', -16 - sw * 4);
    this.armB.setAttribute('x2', 11 + sw * 2); this.armB.setAttribute('y2', -34 + sw * 3);
    this.axe.setAttribute('x1', 11 + sw * 2); this.axe.setAttribute('y1', -34 + sw * 3); // top follows the hand
    this.axe.setAttribute('x2', 22); this.axe.setAttribute('y2', 2);                     // tip planted on the ground

    // camera: zoom in as the climb progresses, but keep the (centered) peak fixed
    // horizontally instead of following the climber, so the framing always matches
    // the initial centered view — including every return to the overworld.
    const PEAK_CX = 860; // horizontal center of the shifted viewBox
    const s = 1 + p * .42;
    let tx = PEAK_CX * (1 - s), ty = H * .62 - at.y * s;
    ty = Math.min(0, Math.max(H * (1 - s), ty));
    this._cx = this._cx == null ? tx : this._cx + (tx - this._cx) * Math.min(1, dt * 2.2);
    this._cy = this._cy == null ? ty : this._cy + (ty - this._cy) * Math.min(1, dt * 2.2);
    this._cs = this._cs == null ? s : this._cs + (s - this._cs) * Math.min(1, dt * 2.2);
    const drift = Math.sin(t * .22) * 9;
    this._drift = drift;
    this.cam.setAttribute('transform', `translate(${this._cx + drift} ${this._cy}) scale(${this._cs})`);
    this.far.setAttribute('transform', `translate(${Math.sin(t * .16) * 26 - (this._cx) * .05} ${8 * Math.sin(t * .13)})`);
    this.mid.setAttribute('transform', `translate(${Math.sin(t * .2 + 1) * 16 - (this._cx) * .03} 0)`);
    this.haze.setAttribute('transform', `translate(${(t * 9) % 1800 - 900} ${Math.sin(t * .3) * 6})`);

    // keep stage labels inside the visible world rect
    const vw = this.clientWidth || 1, vh = this.clientHeight || 1;
    const vsc = Math.max(vw / W, vh / H);
    const offX = (vw - W * vsc) / 2;
    const left = ((-offX) / vsc - this._cx - drift) / this._cs;
    const right = ((vw - offX) / vsc - this._cx - drift) / this._cs;
    const inset = 12 / (vsc * this._cs);
    for (const m of this.markers) {
      if (m.last) continue;
      let shift = 0;
      if (m.x + m.tw / 2 > right - inset) shift = right - inset - (m.x + m.tw / 2);
      else if (m.x - m.tw / 2 < left + inset) shift = left + inset - (m.x - m.tw / 2);
      m.rect.setAttribute('x', -m.tw / 2 + shift);
      m.tx.setAttribute('x', -m.tw / 2 + 10 + shift);
    }

    // summit flag cloth wave — the IRIS text rides the same wave (bob + skew)
    if (this.summitFlag.getAttribute('opacity') !== '0') {
      const w1 = Math.sin(t * 4) * 5, w2 = Math.sin(t * 4 + 1.4) * 7;
      this.cloth.setAttribute('d', `M 0 -78 C 30 ${-80 + w1} 46 ${-66 + w2} 76 ${-72 + w1} L 76 ${-34 + w2} C 46 ${-30 + w1} 30 ${-42 + w2} 0 ${-38} Z`);
      const bob = (w1 + w2) / 2 * 0.8, sway = Math.sin(t * 4) * 1.6, skew = Math.sin(t * 4 + 0.7) * 3.5;
      this.summitText.setAttribute('transform', `translate(${sway} ${bob}) skewX(${skew})`);
    }

    // snow
    for (const f of this._flakes) {
      f.y += f.s * dt * 3; f.d += dt;
      f.x += Math.sin(f.d) * 12 * dt;
      if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
      f.n.setAttribute('cx', f.x); f.n.setAttribute('cy', f.y);
    }

    // confetti
    for (let i = this._confetti.length - 1; i >= 0; i--) {
      const c = this._confetti[i];
      c.life += dt; c.vy += 900 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      const world = this._cs, sx = c.x * world + this._cx, sy = c.y * world + this._cy;
      c.n.setAttribute('transform', `translate(${sx} ${sy}) rotate(${c.rot}) scale(${world})`);
      c.n.setAttribute('opacity', Math.max(0, 1 - c.life / 2.6));
      if (c.life > 2.6) { c.n.remove(); this._confetti.splice(i, 1); }
    }

    // fireworks — staggered bursts, then radial sparks with a little gravity (in
    // camera-space coords, since fwG is inside the cam group)
    if (this._fwLeft > 0) {
      this._fwGap -= dt;
      if (this._fwGap <= 0) { this._launchBurst(); this._fwLeft--; this._fwGap = 0.38 + Math.random() * 0.5; }
    }
    for (let i = this._fw.length - 1; i >= 0; i--) {
      const s = this._fw[i];
      s.life += dt; s.vy += 55 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.n.setAttribute('cx', s.x); s.n.setAttribute('cy', s.y);
      s.n.setAttribute('opacity', Math.max(0, 1 - s.life / 1.45));
      if (s.life > 1.45) { s.n.remove(); this._fw.splice(i, 1); }
    }
  };
}

customElements.define('iris-climb-2d', IrisClimb2D);
})();
