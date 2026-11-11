/* Helpani Town · original runtime art. Stylized virtual habitat, no wildlife footage. */
const WIDTH = 1600;
const HEIGHT = 1000;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const copy = (value) => structuredClone(value);
const nodes = {
  clearing: { x: 380, y: 846 },
  bamboo: { x: 220, y: 812 },
  root: { x: 601, y: 788 },
  landing: { x: 610, y: 526 },
  fork: { x: 650, y: 432 },
  branch: { x: 906, y: 417 },
  trunk: { x: 766, y: 526 },
  approach: { x: 1002, y: 851 },
  ramp: { x: 1043, y: 844 },
  rampTop: { x: 1124, y: 756 },
  edge: { x: 1180, y: 756 },
  farBranch: { x: 1244, y: 425 },
};
const edges = [
  ['clearing', 'bamboo', 'walk'], ['clearing', 'root', 'walk'],
  ['root', 'landing', 'climb'], ['landing', 'fork', 'climb'],
  ['fork', 'branch', 'walk'], ['landing', 'trunk', 'walk'],
  ['clearing', 'approach', 'walk'], ['approach', 'ramp', 'walk'],
  ['ramp', 'rampTop', 'ramp'], ['rampTop', 'edge', 'walk'],
  ['branch', 'farBranch', 'bridge'],
];
const labels = {
  sniff: '竹竹停下脚步，闻闻落叶间的新气味。', walk: '竹竹沿着熟悉的小路慢慢探索。',
  climb: '脚掌抓稳树皮，尾巴帮助竹竹保持平衡。', ramp: '竹竹踏上斜坡，去看看林缘的新角落。',
  bridge: '竹竹轻轻跨过木道，尾巴随步伐摆动。', settle: '竹竹先站稳，再慢慢伏下身体。',
  'tree-rest': '竹竹趴在枝杈上，把尾巴垂到树荫里。',
  'platform-rest': '竹竹自主来到休息平台，安心地伸展身体。',
  rise: '竹竹撑起前爪，准备继续看看这片林地。',
};
function rng(seed) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}
function path(ctx, d, fill, stroke, width = 1) {
  const p = new Path2D(d);
  if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(p); }
}
function ellipse(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = color; ctx.fill();
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function leaf(ctx, x, y, size, angle, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(size * .2, -size * .7, size, -size * .45, size * 1.25, 0);
  ctx.bezierCurveTo(size * .8, size * .35, size * .3, size * .5, 0, 0);
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function fern(ctx, x, y, size, color, seed = 4) {
  const random = rng(seed);
  for (let frond = -2; frond <= 2; frond++) {
    const endX = x + frond * size * .27;
    const endY = y - size * (1 - Math.abs(frond) * .13);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + frond * size * .1, y - size * .8, endX, endY);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const px = lerp(x, endX, t * t), py = lerp(y, endY, t);
      const s = size * .14 * Math.sin(t * Math.PI) * (1 + random() * .2);
      leaf(ctx, px, py, s, -2.8 + frond * .1, color);
      leaf(ctx, px, py, s, -.3 + frond * .1, color);
    }
  }
}
function makeCanvas() { const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT; return canvas; }

export class WoodlandScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.camera = { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1 };
    this.layout = { platform: null, bridge: false };
    this.layoutVersion = -1;
    this.targetState = null;
    this.preview = null;
    this.time = 0;
    this.paused = false;
    this.visible = false;
    this.lowMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.destroyed = false;
    this.reported = new Set();
    this.random = rng(Date.now());
    this.actor = { x: nodes.clearing.x, y: nodes.clearing.y, facing: 1, angle: 0, phase: 0, posture: 0, mode: 'sniff', duration: 1.8, elapsed: 0, node: 'clearing', goal: null, route: [], segment: null, usingFacility: null };
    this.nextPlatformVisit = false;
    this.nextBridgeVisit = false;
    this.visitCount = 0;
    this.background = makeCanvas();
    this.drawBackground(this.background.getContext('2d'));
    this.foreground = makeCanvas();
    this.drawForeground(this.foreground.getContext('2d'));
    this.pointers = new Map();
    this.boundDown = (e) => this.pointerDown(e);
    this.boundMove = (e) => this.pointerMove(e);
    this.boundUp = (e) => this.pointerUp(e);
    this.boundWheel = (e) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * .001)); };
    this.boundKey = (e) => this.keyDown(e);
    canvas.addEventListener('pointerdown', this.boundDown);
    canvas.addEventListener('pointermove', this.boundMove);
    canvas.addEventListener('pointerup', this.boundUp);
    canvas.addEventListener('pointercancel', this.boundUp);
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    canvas.addEventListener('keydown', this.boundKey);
    canvas.style.touchAction = 'none';
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.lastFrame = performance.now();
    this.tick = (now) => {
      if (this.destroyed) return;
      const dt = Math.min((now - this.lastFrame) / 1000, .06);
      this.lastFrame = now;
      if (!this.paused && !document.hidden) { this.time += dt; this.advance(dt); }
      if (!document.hidden && this.visible) this.paint(this.canvas, this.getFrame(), false, true);
      this.frameId = requestAnimationFrame(this.tick);
    };
    this.status('sniff');
    this.frameId = requestAnimationFrame(this.tick);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.visible = Boolean(rect.width && rect.height);
    if (!this.visible) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
  }
  status(mode) { this.callbacks.onStatus?.(labels[mode] || labels.walk); }
  setPaused(value) { this.paused = Boolean(value); }
  interact(kind = 'touch') {
    this.interaction = { kind, elapsed:0, active:false };
    this.callbacks.onStatus?.(this.actor.segment ? '竹竹注意到了你，等停稳后再慢慢回应。' : kind === 'feed' ? '竹竹收到了这份虚拟照护粮。' : '竹竹看了看你，尾巴轻轻晃动。');
  }
  setPreview(slotId, facilityId = 'rest-platform') { this.preview = slotId ? { slotId, facilityId } : null; }
  resetCamera() { this.camera = { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1 }; }
  clampCamera() {
    const halfW = WIDTH / this.camera.zoom / 2, halfH = HEIGHT / this.camera.zoom / 2;
    this.camera.x = clamp(this.camera.x, halfW, WIDTH - halfW);
    this.camera.y = clamp(this.camera.y, halfH, HEIGHT - halfH);
  }
  zoomBy(factor) { this.camera.zoom = clamp(this.camera.zoom * factor, 1, 2.8); this.clampCamera(); }
  focusAnimal() { this.camera.zoom = Math.max(1.8, this.camera.zoom); this.camera.x = this.actor.x; this.camera.y = this.actor.y - 90; this.clampCamera(); }
  pointerDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.style.cursor = 'grabbing';
  }
  pointerMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const old = this.pointers.get(e.pointerId), next = { x: e.clientX, y: e.clientY };
    if (this.pointers.size === 2) {
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const before = distance(old, other), after = distance(next, other);
      if (before > 10) this.zoomBy(after / before);
    } else {
      const bounds = this.canvas.getBoundingClientRect();
      this.camera.x -= (next.x - old.x) * WIDTH / bounds.width / this.camera.zoom;
      this.camera.y -= (next.y - old.y) * HEIGHT / bounds.height / this.camera.zoom;
      this.clampCamera();
    }
    this.pointers.set(e.pointerId, next);
  }
  pointerUp(e) { this.pointers.delete(e.pointerId); this.canvas.style.cursor = 'grab'; }
  keyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = (e.shiftKey ? 120 : 60) / this.camera.zoom;
    switch (e.key) {
      case 'ArrowLeft': this.camera.x -= step; break;
      case 'ArrowRight': this.camera.x += step; break;
      case 'ArrowUp': this.camera.y -= step; break;
      case 'ArrowDown': this.camera.y += step; break;
      case '+': case '=': this.zoomBy(1.15); break;
      case '-': case '_': this.zoomBy(1 / 1.15); break;
      case '0': this.resetCamera(); break;
      default: return;
    }
    e.preventDefault();
    this.clampCamera();
  }

  updateLayout(state) {
    if (!state || state.layoutVersion < (this.targetState?.layoutVersion ?? -1)) return;
    this.targetState = copy(state);
    if (this.layoutVersion === -1) {
      this.layout = copy(state.layout);
      this.layoutVersion = state.layoutVersion;
      this.nextPlatformVisit = Boolean(this.layout.platform);
      this.nextBridgeVisit = Boolean(this.layout.bridge);
      if (state.appliedVersion !== state.layoutVersion) this.callbacks.onLayoutApplied?.(state.layoutVersion);
    } else this.applyIfSafe();
  }
  isFacilityBusy() {
    const a = this.actor;
    return Boolean(a.usingFacility || a.goal === 'trunk' || a.goal === 'edge'
      || ['trunk', 'edge', 'rampTop'].includes(a.node) || a.segment?.kind === 'ramp');
  }
  applyIfSafe() {
    const state = this.targetState;
    if (!state || state.layoutVersion <= this.layoutVersion || this.isFacilityBusy()) return false;
    const platformChanged = this.layout.platform !== state.layout.platform;
    const bridgeAdded = !this.layout.bridge && state.layout.bridge;
    this.layout = copy(state.layout);
    this.layoutVersion = state.layoutVersion;
    if (platformChanged && this.layout.platform) this.nextPlatformVisit = true;
    if (bridgeAdded) this.nextBridgeVisit = true;
    this.callbacks.onLayoutApplied?.(state.layoutVersion);
    return true;
  }
  report(behavior, facilityId = null) {
    const key = `${behavior}:${facilityId || ''}:${facilityId ? this.layoutVersion : 0}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.callbacks.onObserve?.({ behavior, facilityId, layoutVersion: this.layoutVersion });
  }
  neighbors(id) {
    return edges.filter(([a, b, kind]) => {
      if (kind === 'bridge' && !this.layout.bridge) return false;
      if ((a === 'trunk' || b === 'trunk') && this.layout.platform !== 'trunk') return false;
      if ((a === 'edge' || b === 'edge') && this.layout.platform !== 'edge') return false;
      return a === id || b === id;
    }).map(([a, b, kind]) => ({ id: a === id ? b : a, kind }));
  }
  route(from, to) {
    const queue = [[from]], seen = new Set([from]);
    while (queue.length) {
      const current = queue.shift();
      if (current.at(-1) === to) return current.slice(1);
      for (const next of this.neighbors(current.at(-1))) {
        if (!seen.has(next.id)) { seen.add(next.id); queue.push([...current, next.id]); }
      }
    }
    return [];
  }
  go(to) {
    const a = this.actor;
    a.route = this.route(a.node, to);
    a.goal = to;
    if (!a.route.length) { this.arrive(); return; }
    this.beginSegment();
  }
  beginSegment() {
    const a = this.actor, endId = a.route.shift();
    const target = nodes[endId];
    const kind = this.neighbors(a.node).find((n) => n.id === endId)?.kind || 'walk';
    a.segment = { start: { x: a.x, y: a.y }, end: target, endId, kind, duration: Math.max(.8, distance(a, target) / (kind === 'climb' ? 67 : kind === 'ramp' ? 82 : 96)) };
    a.elapsed = 0; a.mode = kind; a.duration = a.segment.duration;
    const dy = target.y - a.y;
    a.targetAngle = kind === 'climb' ? Math.atan2(-Math.abs(dy), dy < 0 ? target.x - a.x : a.x - target.x) : Math.atan2(dy * (target.x >= a.x ? 1 : -1), Math.abs(target.x - a.x));
    a.targetFacing = kind === 'climb' ? (dy < 0 ? 1 : -1) : (target.x >= a.x ? 1 : -1);
    this.status(kind);
  }
  action(mode, duration) { const a = this.actor; a.mode = mode; a.duration = duration; a.elapsed = 0; a.segment = null; this.status(mode); }
  arrive() {
    const a = this.actor;
    a.segment = null;
    if (a.node === 'trunk' || a.node === 'edge') {
      a.usingFacility = 'rest-platform'; this.nextPlatformVisit = false;
      this.action('settle', 1.35);
    } else if (a.node === 'branch' || a.node === 'farBranch') {
      a.usingFacility = a.node === 'farBranch' ? 'woodland-bridge' : null;
      this.action('settle', 1.35);
    } else {
      a.goal = null; a.usingFacility = null;
      this.applyIfSafe();
      this.report('ground-explore');
      this.action('sniff', 1.3 + this.random() * 1.7);
    }
  }
  chooseGoal() {
    const a = this.actor;
    this.applyIfSafe();
    if (this.nextBridgeVisit && this.layout.bridge) { this.go('farBranch'); return; }
    if (this.nextPlatformVisit && this.layout.platform) { this.go(this.layout.platform); return; }
    // A newly placed platform is explored promptly, while ordinary visits retain variation.
    this.visitCount++;
    let goal;
    if (this.layout.bridge && this.visitCount % 3 === 1) goal = 'farBranch';
    else if (this.visitCount % 3 === 1) goal = 'branch';
    else if (this.layout.platform && this.random() < .65) goal = this.layout.platform;
    else goal = a.node === 'bamboo' ? 'clearing' : (this.random() < .5 ? 'bamboo' : 'clearing');
    this.go(goal);
  }
  advance(dt) {
    const a = this.actor;
    if(this.interaction && (!a.segment || this.interaction.active)) {
      this.interaction.active=true;this.interaction.elapsed+=dt;
      if(this.interaction.elapsed>3)this.interaction=null;
    }
    a.elapsed += dt;
    if (a.segment) {
      const s = a.segment, t = clamp(a.elapsed / s.duration, 0, 1);
      // Ease only at contact changes; a constant central stride keeps planted paws credible.
      const easeTravel = t < .12 ? t * t / .24 : t > .88 ? .88 - (1 - t) ** 2 / .24 : t - .06;
      const p = clamp(easeTravel / .88, 0, 1);
      const previous = {x: a.x, y: a.y};
      a.x = lerp(s.start.x, s.end.x, p); a.y = lerp(s.start.y, s.end.y, p);
      if (s.kind === 'walk' && s.start.y > 780 && s.end.y > 780) a.y += Math.sin(p * Math.PI) * 8;
      const turn = 1 - Math.exp(-dt * 10);
      a.angle = lerp(a.angle, a.targetAngle, turn);
      a.facing = lerp(a.facing, a.targetFacing, turn);
      a.posture = lerp(a.posture, 0, turn);
      const stride = s.kind === 'walk' || s.kind === 'bridge' ? 28 : 24;
      a.phase += distance(previous, a) * (.63 * TAU) / (2 * stride * .94);
      if (t >= 1) {
        a.x = s.end.x; a.y = s.end.y; a.node = s.endId;
        if (s.kind === 'climb') this.report('climb');
        if (s.kind === 'bridge') { this.nextBridgeVisit = false; this.report('bridge-cross', 'woodland-bridge'); }
        if (a.route.length) this.beginSegment(); else this.arrive();
      }
      return;
    }
    const p = clamp(a.elapsed / a.duration, 0, 1);
    a.angle = lerp(a.angle, 0, 1 - Math.exp(-dt * 8));
    if (a.mode === 'settle') a.posture = smooth(p);
    else if (a.mode === 'rise') a.posture = 1 - smooth(p);
    if (a.elapsed < a.duration) return;
    if (a.mode === 'settle') {
      const mode = a.usingFacility === 'rest-platform' ? 'platform-rest' : 'tree-rest';
      this.action(mode, 8 + this.random() * 4);
      this.report(mode, a.usingFacility === 'rest-platform' ? 'rest-platform' : null);
    } else if (a.mode === 'platform-rest' || a.mode === 'tree-rest') {
      this.action('rise', 1.4);
    } else if (a.mode === 'rise') {
      a.usingFacility = null;
      // Leave an occupied/approached platform before applying its replacement.
      if (a.node === 'trunk') this.go('root');
      else if (a.node === 'edge') this.go('approach');
      else this.go('root');
    } else this.chooseGoal();
  }

  getFrame() { return { time: this.time, actor: copy(this.actor), layout: copy(this.layout), layoutVersion: this.layoutVersion, camera: copy(this.camera), preview: copy(this.preview),interaction: this.interaction ? copy(this.interaction):null }; }
  snapshot() {
    const a = this.actor;
    return { species:'red-panda',interaction:this.interaction?copy(this.interaction):null,time: Number(this.time.toFixed(3)), mode: a.mode, position: { x: Number(a.x.toFixed(2)), y: Number(a.y.toFixed(2)) }, node: a.node, goal: a.goal, facing: Number(a.facing.toFixed(3)), angle: Number(a.angle.toFixed(3)), posture: Number(a.posture.toFixed(3)), gaitPhase: Number(a.phase.toFixed(3)), usingFacility: a.usingFacility, layoutVersion: this.layoutVersion, layout: copy(this.layout), pendingVersion: this.targetState?.layoutVersion > this.layoutVersion ? this.targetState.layoutVersion : null, camera: copy(this.camera), paused: this.paused };
  }
  capture({ watermark = true } = {}) {
    const canvas = makeCanvas();
    this.paint(canvas, this.getFrame(), watermark, false);
    return canvas;
  }
  paint(canvas, frame, watermark = false, preview = false) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(w / WIDTH * frame.camera.zoom, h / HEIGHT * frame.camera.zoom); ctx.translate(-frame.camera.x, -frame.camera.y);
    ctx.drawImage(this.background, 0, 0);
    this.drawAmbient(ctx, frame);
    if (frame.layout.bridge) this.drawBridge(ctx);
    if (frame.layout.platform) this.drawPlatform(ctx, frame.layout.platform);
    this.drawAnimal(ctx, frame.actor, frame.time, frame.layout);
    if(frame.interaction?.active){
      const reaction=frame.interaction,up=reaction.elapsed*15,alpha=Math.min(1,reaction.elapsed*3,3-reaction.elapsed);
      ctx.save();ctx.globalAlpha=Math.max(0,alpha);ctx.fillStyle=reaction.kind==='feed'?'#dcca88':'#f1c6a4';
      const x=frame.actor.x+frame.actor.facing*68,y=frame.actor.y-125-up;
      if(reaction.kind==='feed'){ellipse(ctx,x,y,14,7,'#a9bd70');line(ctx,[[x-12,y+2],[x+11,y-2]],'#6b814c',2);}else{ctx.beginPath();ctx.moveTo(x,y+9);ctx.bezierCurveTo(x-26,y-4,x-17,y-23,x,y-11);ctx.bezierCurveTo(x+17,y-23,x+26,y-4,x,y+9);ctx.fill();}
      ctx.restore();
    }
    this.drawContactFoliage(ctx, frame);
    ctx.drawImage(this.foreground, 0, 0);
    if (preview && frame.preview) this.drawPreview(ctx, frame.preview, frame.time);
    ctx.restore();
    if (watermark) {
      ctx.save(); ctx.scale(w / WIDTH, h / HEIGHT);
      const gradient = ctx.createLinearGradient(0, 880, 0, 1000); gradient.addColorStop(0, '#102b2600'); gradient.addColorStop(1, '#102b26c9');
      ctx.fillStyle = gradient; ctx.fillRect(0, 880, WIDTH, 120);
      ctx.fillStyle = '#fff9e9'; ctx.font = '500 27px "PingFang SC", sans-serif'; ctx.fillText('小熊猫 · 竹竹', 52, 950);
      ctx.font = '21px "PingFang SC", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#f2eedbcc'; ctx.fillText('小镇影像 · 虚拟场景', 1548, 950); ctx.restore();
    }
  }

  drawBackground(ctx) {
    const random = rng(27182);
    const sky = ctx.createLinearGradient(0, 0, 0, 1000);
    sky.addColorStop(0, '#819c91'); sky.addColorStop(.42, '#b1c4a9'); sky.addColorStop(.71, '#c6c89b'); sky.addColorStop(1, '#61715b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Distant forest dissolves into pale morning mist.
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 24; i++) {
        const x = random() * WIDTH, width = 7 + random() * 22;
        ctx.fillStyle = ['#5b80704a', '#426e5b48', '#3c69554a'][layer];
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + width, 0); ctx.lineTo(x + width * .4 + 30, 710 + layer * 35); ctx.lineTo(x - 10, 710 + layer * 35); ctx.fill();
        const forkY = 130 + random() * 330, direction = random() > .5 ? 1 : -1;
        line(ctx, [[x + width / 2, forkY + 100], [x + direction * (45 + random() * 90), forkY]], ['#63877555', '#4c735c55', '#52756366'][layer], width * .35);
      }
    }
    const mist = ctx.createLinearGradient(0, 340, 0, 745);
    mist.addColorStop(0, '#e0dfb900'); mist.addColorStop(.5, '#d9dec46b'); mist.addColorStop(1, '#b8c69e00');
    ctx.fillStyle = mist; ctx.fillRect(0, 300, WIDTH, 470);
    path(ctx, 'M0 729 Q180 655 410 717 Q640 648 860 703 Q1070 645 1280 685 Q1440 665 1600 698 L1600 1000H0Z', '#4d735e');
    path(ctx, 'M0 799 Q230 727 450 793 Q680 725 876 788 Q1190 715 1600 753 V1000H0Z', '#6b8561');
    const floor = ctx.createLinearGradient(0, 740, 0, 1000); floor.addColorStop(0, '#81906b'); floor.addColorStop(.5, '#8d9a71'); floor.addColorStop(1, '#3a5d4d');
    path(ctx, 'M0 824 Q200 783 420 815 Q690 764 840 800 Q1170 755 1600 796 V1000H0Z', floor);
    // Soft path curves between the tree and the lower platform.
    path(ctx, 'M0 891 Q140 861 315 831 Q486 806 595 795 Q785 816 1005 846 Q1230 855 1600 812 L1600 859 Q1220 920 990 892 Q780 861 572 837 Q402 862 260 888 Q130 930 0 951Z', '#afaa7f');
    path(ctx, 'M0 898 Q310 821 586 808 Q819 831 1000 860 Q1230 885 1600 830', null, '#cac49a70', 7);
    for (let i = 0; i < 610; i++) {
      const x = random() * WIDTH, y = 742 + random() * 258;
      const colors = ['#d4c99877', '#445c4577', '#839266aa', '#ac9e6988'];
      ellipse(ctx, x, y, .7 + random() * 2.5, .5 + random() * 1.1, colors[i % colors.length], random());
    }
    // Right-hand tree anchors the future canopy connection.
    const bark2 = ctx.createLinearGradient(1190, 0, 1310, 0); bark2.addColorStop(0, '#3c5546'); bark2.addColorStop(.45, '#6e7252'); bark2.addColorStop(1, '#314c40');
    path(ctx, 'M1193 0H1272Q1243 200 1270 355Q1309 567 1287 777L1340 812Q1275 844 1203 809L1224 773Q1248 587 1206 385Q1189 204 1193 0Z', bark2);
    path(ctx, 'M1247 397Q1356 299 1489 291L1508 306Q1364 332 1265 432Z', '#485944');
    path(ctx, 'M1233 425Q1184 443 1116 432L1112 414Q1189 424 1233 402Z', '#647357');
    for (let i = 0; i < 15; i++) line(ctx, [[1205 + random() * 60, 30 + i * 45], [1210 + random() * 60, 70 + i * 45]], '#b1af7560', 2);
    // Main climbing trunk: broad tree with a left bark contact surface.
    const bark = ctx.createLinearGradient(580, 0, 729, 0); bark.addColorStop(0, '#495d47'); bark.addColorStop(.2, '#7c7750'); bark.addColorStop(.5, '#8c8058'); bark.addColorStop(.8, '#5d6849'); bark.addColorStop(1, '#354f3d');
    path(ctx, 'M590 0H714Q674 159 683 274Q687 354 717 426L689 513Q654 625 667 750L719 806Q654 834 560 816L596 772Q601 688 597 613Q594 553 610 489Q621 412 606 317Q581 166 590 0Z', bark);
    path(ctx, 'M642 327Q532 234 421 212L412 232Q537 266 624 368Z', '#586448');
    path(ctx, 'M657 434Q793 386 1014 411L1034 427Q864 432 704 461L648 465Z', '#536348');
    path(ctx, 'M667 435Q824 406 1012 420', null, '#c0ac75', 7);
    path(ctx, 'M649 447Q820 421 977 429', null, '#435b3d', 9);
    path(ctx, 'M645 433Q772 404 849 412', null, '#a6af6e', 9);
    // Moss, grooves, knots and lichen make the actual climbing plane legible.
    for (let i = 0; i < 30; i++) {
      const x = 615 + random() * 55, y = random() * 760;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 9, y + 20, x + 8, y + 37, x + 2, y + 57);
      ctx.strokeStyle = i % 3 ? '#344b3866' : '#c8b78066'; ctx.lineWidth = 1 + random() * 3; ctx.stroke();
    }
    ellipse(ctx, 657, 334, 18, 31, '#526244', -.15);
    ellipse(ctx, 658, 336, 9, 20, '#384c36', -.15);
    path(ctx, 'M602 511Q595 627 607 722Q595 762 576 791', null, '#8e9a68aa', 10);
    for (let i = 0; i < 38; i++) ellipse(ctx, 607 + random() * 48, random() * 780, 2 + random() * 7, 1 + random() * 5, '#b9bd8c55');
    // Bamboo at the woodland edge, separated from the navigable path.
    for (let i = 0; i < 14; i++) {
      const x = 25 + i * 17, y = 740 + random() * 55, top = 220 + random() * 220;
      line(ctx, [[x, y], [x + (random() - .4) * 50, top]], i % 2 ? '#476a4d' : '#66805a', 5 + random() * 4);
      for (let j = 0; j < 5; j++) {
        const yy = lerp(y, top, j / 5), xx = x + j * 2;
        line(ctx, [[xx - 4, yy], [xx + 7, yy - 1]], '#b4b48a66', 2);
        leaf(ctx, xx, yy, 25 + random() * 20, -.8, '#496d4b');
        leaf(ctx, xx, yy, 22 + random() * 20, -2.5, '#5d7d52');
      }
    }
    // Rock, fallen wood and leaf litter remain independent resting/exploration scenery.
    path(ctx, 'M1373 817Q1351 775 1394 758Q1444 744 1480 789L1493 821Q1430 838 1373 817Z', '#6e7d69');
    path(ctx, 'M1389 779Q1438 756 1471 792', null, '#b4b99a', 4);
    path(ctx, 'M84 893Q137 870 191 885L225 908Q141 934 81 912Z', '#426045');
    line(ctx, [[132, 901], [252, 919]], '#655c40', 24);
    line(ctx, [[137, 891], [251, 909]], '#9c9262', 6);
    for (let i = 0; i < 78; i++) {
      const x = random() * WIDTH, y = 790 + random() * 180;
      leaf(ctx, x, y, 3 + random() * 7, random() * TAU, ['#b19759', '#cfbc78', '#657449', '#92764a'][i % 4]);
    }
    for (const [x, y, size] of [[73, 853, 92], [327, 899, 57], [522, 801, 63], [709, 830, 74], [1450, 857, 85], [1300, 856, 55]]) fern(ctx, x, y, size, '#446b4a', x);
    for (let i = 0; i < 15; i++) {
      const x = 1350 + random() * 185, y = 855 + random() * 56;
      line(ctx, [[x, y], [x + 2, y - 15]], '#64815a', 1.7);
      ellipse(ctx, x + 2, y - 17, 2, 3, '#e1d6ac');
    }
    // Sunlight catches the open platform location, while the tree side stays cool.
    const light = ctx.createRadialGradient(1060, 280, 20, 1050, 410, 610);
    light.addColorStop(0, '#fff1c43d'); light.addColorStop(.5, '#f3e9ba18'); light.addColorStop(1, '#fff1c400'); ctx.fillStyle = light; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Fine translucent grain is deterministic, inexpensive and only drawn once.
    for (let i = 0; i < 5300; i++) { ctx.fillStyle = i % 2 ? '#fff7d507' : '#173b2f07'; ctx.fillRect(random() * WIDTH, random() * HEIGHT, 1, 1); }
  }

  drawForeground(ctx) {
    const random = rng(109);
    // Dark upper canopy forms a photographic frame without hiding travel paths.
    for (let i = 0; i < 150; i++) {
      const x = random() * WIDTH, y = -65 + random() * 180;
      if (x > 800 && x < 1190 && y > 28) continue;
      ellipse(ctx, x, y, 28 + random() * 65, 12 + random() * 34, ['#234d3e', '#345c43', '#426849', '#557751'][i % 4], random() * .6);
      leaf(ctx, x, y + 12, 16 + random() * 35, random() * TAU, ['#79956588', '#4f7751', '#698956'][i % 3]);
    }
    for (let i = 0; i < 10; i++) fern(ctx, 30 + i * 176, 1030 + random() * 25, 80 + random() * 85, '#244f3e', 81 + i);
    path(ctx, 'M0 925Q74 932 123 1000H0Z', '#234d3e');
    path(ctx, 'M1600 871Q1541 924 1516 1000H1600Z', '#31573f');
    for (let i = 0; i < 25; i++) {
      leaf(ctx, -15 + random() * 120, 840 + random() * 170, 24 + random() * 27, -.6 - random(), '#355d42');
      leaf(ctx, 1560 + random() * 90, 835 + random() * 170, 24 + random() * 27, -2 - random(), '#3d6646');
    }
  }
  drawAmbient(ctx, frame) {
    const t = frame.time;
    ctx.save();
    for (let i = 0; i < (this.lowMotion ? 0 : 13); i++) {
      const x = 350 + ((i * 137 + Math.sin(t * .12 + i) * 18) % 1150);
      const y = 200 + ((i * 83 + t * (1 + i % 3)) % 610);
      ellipse(ctx, x, y, 1.4 + Math.sin(t + i) * .5, 1.4, '#f4e5a655');
    }
    const shaft = ctx.createLinearGradient(1120, 100, 730, 930);
    shaft.addColorStop(0, '#fff3cd00'); shaft.addColorStop(.4, '#fff5ce0a'); shaft.addColorStop(1, '#fff5ce00');
    path(ctx, 'M1120 50L1240 50L820 1000L590 1000Z', shaft);
    ctx.restore();
  }
  drawPlatform(ctx, slot, ghost = false) {
    ctx.save();
    if (ghost) ctx.globalAlpha = .58;
    const high = slot === 'trunk', x = high ? 682 : 1117, y = high ? 526 : 756, width = high ? 193 : 190;
    const ground = high ? 685 : 852;
    line(ctx, [[x + 25, y + 9], [x + 27, ground]], '#5e6245', 12);
    line(ctx, [[x + width - 23, y + 9], [x + width - 18, ground - 2]], '#6e6947', 12);
    line(ctx, [[x + 25, y + 110], [x + width - 28, y + 15]], '#7d7752', 8);
    if (high) line(ctx, [[617, 608], [x + width - 13, y + 13]], '#626b49', 11);
    // The bark landing and raised deck share a continuous, level access tread.
    if (high) {
      const entry = nodes.landing.x - 10, overlap = x + 20;
      path(ctx, `M${entry} ${y - 4}H${overlap}L${overlap + 10} ${y + 12}H${entry - 4}Z`, '#b79e6c', '#616247', 2);
      path(ctx, `M${entry - 4} ${y + 12}H${overlap + 10}V${y + 21}H${entry - 4}Z`, '#88774f');
      for (let px = entry + 15; px < overlap; px += 18) line(ctx, [[px, y - 3], [px + 7, y + 10]], '#85734d', 2);
      line(ctx, [[entry, y - 4], [overlap, y - 4]], '#e3ce96', 3);
    }
    path(ctx, `M${x - 8} ${y - 4}L${x + width - 2} ${y - 4}L${x + width + 14} ${y + 12}L${x - 10} ${y + 12}Z`, '#c8ad77', '#616247', 2);
    path(ctx, `M${x - 10} ${y + 12}H${x + width + 14}V${y + 23}H${x - 10}Z`, '#88774f');
    for (let i = 1; i < 10; i++) line(ctx, [[x + i * width / 10, y - 3], [x + i * width / 10 + 10, y + 10]], '#8b7b53', 2);
    line(ctx, [[x - 6, y - 4], [x + width - 2, y - 4]], '#eee0aa', 3);
    // A low timber ramp is the real access route to the sunny location.
    if (!high) {
      const bottom = nodes.ramp, top = nodes.rampTop;
      path(ctx, `M${bottom.x - 11} ${bottom.y - 4}L${top.x - 11} ${top.y - 4}L${top.x + 11} ${top.y + 4}L${bottom.x + 11} ${bottom.y + 4}Z`, '#a68d5e', '#6b6546', 2);
      for (let i = 0; i < 9; i++) {
        const p = i / 9, px = lerp(bottom.x, top.x, p), py = lerp(bottom.y, top.y, p);
        line(ctx, [[px - 9, py - 3], [px + 9, py + 3]], '#d5be86', 3);
      }
    }
    // Hemp ties and a small moss edge make it belong to the forest.
    for (const px of [x + 25, x + width - 23]) {
      for (let i = 0; i < 3; i++) line(ctx, [[px - 8, y + 19 + i * 4], [px + 8, y + 19 + i * 4]], '#d1c693', 2);
    }
    ellipse(ctx, x + width * .63, y + 14, width * .24, 3, '#d5bd8988');
    ctx.restore();
  }
  drawBridge(ctx, ghost = false) {
    ctx.save(); if (ghost) ctx.globalAlpha = .55;
    // Deck and rope hand-lines follow the same endpoints used by navigation.
    line(ctx, [[968, 415], [1246, 423]], '#626246', 14);
    for (let i = 0; i <= 19; i++) {
      const x = 971 + i * 14, y = 415 + (x - 971) / 278 * 8;
      line(ctx, [[x, y - 5], [x + 3, y + 10]], i % 2 ? '#b29a69' : '#ccb481', 10);
    }
    for (const x of [978, 1108, 1238]) line(ctx, [[x, 426], [x, 382]], '#6b684a', 5);
    ctx.beginPath(); ctx.moveTo(978, 382); ctx.quadraticCurveTo(1108, 404, 1238, 382); ctx.strokeStyle = '#b8ac7c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  drawContactFoliage(ctx, frame) {
    const a = frame.actor, t = frame.time;
    // A foreground twig and vines cause genuine, localized occlusion near the bark.
    line(ctx, [[649, 100], [638, 186], [653, 260]], '#4b7049', 3);
    for (let i = 0; i < 8; i++) leaf(ctx, 640 + Math.sin(i) * 8, 142 + i * 15, 12, i % 2 ? -2 : -.3, '#668254');
    const nearby = a.mode === 'climb' || (a.y < 560 && a.x < 800);
    const sway = this.lowMotion ? 0 : Math.sin(t * (nearby ? 4 : .8)) * (nearby ? .09 : .018);
    for (let i = 0; i < 6; i++) {
      leaf(ctx, 650 + i * 15, 449 - i * 4, 23, -.1 + sway, '#6d8554');
      leaf(ctx, 657 + i * 15, 445 - i * 4, 17, -2.6 + sway, '#8c9b62');
    }
    if (!this.lowMotion && a.mode === 'walk' && a.y > 790) {
      const phase = (a.phase / TAU) % 1;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * .45;
      leaf(ctx, a.x - a.facing * phase * 18, a.y + 4 - Math.sin(phase * Math.PI) * 9, 7, phase * 3, '#b9ab71');
      ctx.globalAlpha = 1;
    }
  }
  drawPreview(ctx, preview, time) {
    const bridge = preview.facilityId === 'woodland-bridge';
    const target = bridge ? { x: 1110, y: 425 } : nodes[preview.slotId];
    if (!target) return;
    ctx.save(); ctx.strokeStyle = '#fff2ae'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -time * 12;
    ctx.beginPath();
    const route = bridge ? ['branch', 'farBranch'] : preview.slotId === 'trunk' ? ['root', 'landing', 'trunk'] : ['clearing', 'approach', 'ramp', 'rampTop', 'edge'];
    route.forEach((id, i) => { const p = nodes[id]; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.stroke(); ctx.setLineDash([]);
    if (bridge) this.drawBridge(ctx, true); else this.drawPlatform(ctx, preview.slotId, true);
    ellipse(ctx, target.x, target.y + 8, bridge ? 110 : 83, 17, '#fff3b933');
    ctx.restore();
  }

  drawAnimal(ctx, a, time, layout = this.layout) {
    const moving = Boolean(a.segment), climb = a.mode === 'climb';
    const breath = Math.sin(time * 2) * (this.lowMotion ? .2 : .8);
    const p = a.posture;
    const scale = .94;
    if (!climb) {
      const shadow = ctx.createRadialGradient(a.x - 15, a.y + 5, 3, a.x - 15, a.y + 5, 101);
      shadow.addColorStop(0, '#203e3750'); shadow.addColorStop(1, '#203e3700');
      ctx.save(); ctx.translate(a.x - 20, a.y + 6); ctx.scale(1, .18); ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle);
    // Project the shoulders continuously; a signed minimum width used to snap
    // the neck to the opposite side while the head was still facing forward.
    const turnScale = clamp(a.facing, -1, 1) || 1e-6;
    ctx.scale(scale * turnScale, scale);
    const bob = moving ? Math.sin(a.phase * 2) * 1.6 : breath * .4;
    ctx.translate(0, bob);
    // Ringed tail is built along a curved spine and counterbalances climbing.
    const tailDrop = lerp(0, 33, p), tailWave = moving ? Math.sin(a.phase * .55) * 8 : Math.sin(time * .8) * 3;
    ctx.save();
    const tail = new Path2D(); tail.moveTo(-63, -56 + p * 27);
    tail.bezierCurveTo(-103, -53 + p * 21, -113, -30 + tailWave, -147, -37 + tailDrop);
    tail.bezierCurveTo(-171, -43 + tailDrop, -179, -73 + tailDrop + tailWave, -163, -80 + tailDrop);
    tail.bezierCurveTo(-147, -84 + tailDrop, -138, -63 + tailDrop, -119, -66 + tailDrop);
    tail.bezierCurveTo(-99, -68 + p * 13, -81, -78 + p * 26, -64, -71 + p * 28); tail.closePath();
    const tailColor = ctx.createLinearGradient(-180, -70, -65, -30); tailColor.addColorStop(0, '#a65434'); tailColor.addColorStop(.55, '#b9663b'); tailColor.addColorStop(1, '#d58b4a');
    ctx.fillStyle = tailColor; ctx.fill(tail); ctx.save(); ctx.clip(tail);
    for (let i = 0; i < 7; i++) {
      const x = -173 + i * 18;
      ctx.beginPath(); ctx.moveTo(x, -113); ctx.bezierCurveTo(x - 7, -65, x + 1, -25, x + 19, 4);
      ctx.strokeStyle = i % 2 ? '#e5ac65' : '#8f472f'; ctx.lineWidth = 12; ctx.stroke();
    }
    ctx.restore(); ctx.strokeStyle = '#643f2b88'; ctx.lineWidth = 1.2; ctx.stroke(tail); ctx.restore();
    const bodyY = -56 + p * 25;
    const leg = (front, far) => {
      const hip = { x: front ? 39 : -53, y: bodyY + (front ? 2 : 4) };
      const phase = a.phase + (front ? 0 : Math.PI) + (far ? Math.PI : 0);
      const cycle = ((phase / TAU) % 1 + 1) % 1;
      const stride = a.mode === 'walk' || a.mode === 'bridge' ? 28 : 24;
      let footX = hip.x, footY = (far ? -5 : 0) - bob;
      if (moving) {
        if (cycle < .63) footX += stride * (1 - cycle / .63 * 2);
        else { const swing = (cycle - .63) / .37; footX += lerp(-stride, stride, swing); footY -= Math.sin(swing * Math.PI) * 16; }
      }
      if (p > .01) { footX = lerp(footX, hip.x + (front ? 27 : -6), p); footY = lerp(footY, -2, p); }
      const yaw = clamp(a.facing, -1, 1);
      const lateral = (far ? -1 : 1) * 14 * Math.sqrt(Math.max(0, 1 - yaw * yaw));
      const projectX = (x) => x * yaw + lateral;
      let footRotation = 0;
      const lowAccess = layout.platform === 'edge' && moving && cycle < .63
        && ['approach', 'ramp', 'rampTop', 'edge'].includes(a.node)
        && a.x > nodes.approach.x - 20 && a.x < nodes.edge.x + 40
        && (a.segment.kind === 'walk' || a.segment.kind === 'ramp');
      if (lowAccess) {
        // A planted paw can straddle the ramp/deck junction while the body
        // continues its turn. Project that paw onto its own support plane;
        // swing legs, body motion and the far-side depth remain unchanged.
        const cos = Math.cos(a.angle), sin = Math.sin(a.angle), depth = far ? -5 : 0;
        const localY = footY + bob - depth;
        const point = { x: a.x + scale * (cos * projectX(footX) - sin * localY), y: a.y + scale * (sin * projectX(footX) + cos * localY) };
        const groundSlope = (nodes.ramp.y - nodes.approach.y) / (nodes.ramp.x - nodes.approach.x);
        const support = [{ x: 900, y: nodes.approach.y + (900 - nodes.approach.x) * groundSlope }, nodes.ramp, nodes.rampTop, { x: 1340, y: nodes.rampTop.y }];
        let nearest = null, nearestDistance = Infinity;
        for (let i = 1; i < support.length; i++) {
          const from = support[i - 1], to = support[i], dx = to.x - from.x, dy = to.y - from.y;
          const along = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy), 0, 1);
          const candidate = { x: from.x + along * dx, y: from.y + along * dy }, d = distance(point, candidate);
          if (d < nearestDistance) { nearest = { ...candidate, angle: Math.atan2(dy, dx) }; nearestDistance = d; }
        }
        if (Math.abs(nearest.angle - a.angle) > .05) footRotation = nearest.angle - a.angle;
        if (nearestDistance > 4 && Math.abs(yaw) > .2) {
          const dx = nearest.x - point.x, dy = nearest.y - point.y;
          footX += (cos * dx + sin * dy) / (scale * yaw);
          footY += (-sin * dx + cos * dy) / scale;
        }
      }
      const kneeX = lerp(hip.x, footX, .5) + (front ? -8 : 9), kneeY = lerp(hip.y, footY, .5) - 2;
      ctx.save(); ctx.scale(1 / turnScale, 1);
      ctx.beginPath(); ctx.moveTo(projectX(hip.x), hip.y); ctx.quadraticCurveTo(projectX(kneeX), kneeY, projectX(footX), footY - 4);
      ctx.strokeStyle = far ? '#3d3b31' : '#493d30'; ctx.lineWidth = front ? 16 : 20; ctx.lineCap = 'round'; ctx.stroke();
      ellipse(ctx, projectX(footX + 3), footY - 3, front ? 12 : 13, 5, far ? '#34382f' : '#39392d', footRotation);
      if (!far) line(ctx, [[projectX(footX + 7), footY - 3], [projectX(footX + 13), footY - 3]], '#b9af8666', 1.2);
      ctx.restore();
    };
    leg(false, true); leg(true, true);
    // Main torso retains volume in standing and stretched resting postures.
    const coat = ctx.createLinearGradient(0, bodyY - 36, 0, bodyY + 34);
    coat.addColorStop(0, '#db9756'); coat.addColorStop(.42, '#c8793e'); coat.addColorStop(1, '#955536');
    ctx.beginPath(); ctx.moveTo(-69, bodyY + 4);
    ctx.bezierCurveTo(-82, bodyY - 24, -52, bodyY - 42 + breath, -15, bodyY - 36 + breath);
    ctx.bezierCurveTo(16, bodyY - 34 + breath, 51, bodyY - 28, 57, bodyY - 4);
    ctx.bezierCurveTo(66, bodyY + 18, 40, bodyY + 31 - p * 7, -6, bodyY + 28 - p * 9);
    ctx.bezierCurveTo(-41, bodyY + 28 - p * 9, -65, bodyY + 23, -69, bodyY + 4); ctx.fillStyle = coat; ctx.fill();
    path(ctx, `M-66 ${bodyY + 5}Q-15 ${bodyY + 9} 51 ${bodyY - 1}Q65 ${bodyY + 28} 7 ${bodyY + 29}Q-46 ${bodyY + 32}-66 ${bodyY + 5}Z`, '#65442e');
    // Sparse guard-hair strokes, all attached to the moving body.
    for (let i = 0; i < 18; i++) {
      const x = -64 + i * 6.2, yy = bodyY - 25 - Math.sin(i / 18 * Math.PI) * 7;
      line(ctx, [[x, yy], [x + 5, yy + 6]], i % 3 ? '#e9ab6344' : '#6e412744', 1.4);
    }
    leg(false, false); leg(true, false);
    ctx.restore();
    // A frontal chest bridges the two side views instead of flattening the neck.
    const facing = clamp(a.facing, -1, 1);
    const front = 1 - smooth(clamp(Math.abs(facing) / .65, 0, 1));
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle); ctx.scale(scale, scale);
    ctx.translate(0, bob);
    if (front > .001) {
      ctx.save(); ctx.globalAlpha *= front;
      ellipse(ctx, 0, -37 + p * 19, 23, 29 - p * 8, '#67452e');
      ellipse(ctx, 0, -53 + p * 24, 21, 16, '#bd743f');
      ctx.restore();
    }
    const headX = (57 + p * 17) * facing;
    const headY = -70 + p * 48 + (a.mode === 'sniff' ? Math.sin(time * 4) * 1.2 : 0);
    ctx.translate(headX, headY);
    this.drawHead(ctx, a, time);
    ctx.restore();
  }

  drawHead(ctx, a, time) {
    const facing = clamp(a.facing, -1, 1), profile = Math.abs(facing);
    const direction = facing < 0 ? -1 : 1;
    const posture = clamp(a.posture, 0, 1);
    const sleep = smooth(clamp((posture - .30) / .65, 0, 1));
    const blinkPhase = time % 6.8;
    const blink = blinkPhase > 6.5 ? Math.sin((blinkPhase - 6.5) / .3 * Math.PI) ** 2 : 0;
    const open = 1 - Math.max(sleep, blink);
    const nod = a.mode === 'sniff' ? .05 + Math.sin(time * 4) * .025
      : a.segment ? Math.sin(a.phase) * .014 : 0;
    ctx.save(); ctx.rotate((posture * .05 + nod) * facing); ctx.scale(direction, 1);
    const point = (frontX, frontY, sideX, sideY) => [lerp(frontX, sideX, profile), lerp(frontY, sideY, profile)];
    // Front and side contours share their anatomy, not two eyes pasted onto a
    // fixed round head. In profile the muzzle extends ahead of the eye socket.
    const contour = (front, side) => {
      const result = new Path2D();
      front.forEach(([op, ...values], index) => {
        const args = values.map((value, i) => lerp(value, side[index][i + 1], profile));
        if (op === 'M') result.moveTo(...args);
        else if (op === 'L') result.lineTo(...args);
        else if (op === 'C') result.bezierCurveTo(...args);
        else if (op === 'Q') result.quadraticCurveTo(...args);
        else result.closePath();
      });
      return result;
    };
    // Ear roots attach to the upper sides/rear of the skull. The far ear is
    // smaller and sits behind its crown; neither is a full circle on top.
    const ears = [
      { root: point(-26, -16, -6, -23), size: lerp(1, .56, profile), angle: lerp(-.23, .12, profile) },
      { root: point(26, -16, -23, -15), size: 1, angle: lerp(.23, -.27, profile) },
    ];
    for (const ear of ears) {
      ctx.save(); ctx.translate(...ear.root); ctx.rotate(ear.angle); ctx.scale(ear.size, ear.size);
      path(ctx, 'M-12 8Q-15-1-10-16Q-7-23-3-23Q2-23 10-10Q17 0 11 8Z', '#f1e4c6', '#8a5d3c', 1);
      path(ctx, 'M-7 3Q-10-3-6-13Q-4-17-1-15Q5-9 8-2L6 5Z', '#827460');
      path(ctx, 'M-10 5L-6 1L-4 5L0 2L4 6L9 3L10 9H-10Z', '#f5e9cf');
      ctx.restore();
    }
    const outline = contour([
      ['M', 0, -29], ['C', 16, -30, 29, -23, 32, -10],
      ['C', 34, -3, 33, 4, 37, 10], ['L', 32, 12],
      ['C', 28, 24, 14, 28, 0, 27], ['C', -14, 28, -28, 24, -32, 12],
      ['L', -37, 10], ['C', -33, 4, -34, -3, -32, -10],
      ['C', -29, -23, -16, -30, 0, -29], ['Z'],
    ], [
      ['M', -8, -29], ['C', 7, -30, 18, -21, 23, -9],
      ['C', 25, -5, 30, 0, 35.8, 5.5], ['L', 34.8, 10],
      ['C', 33, 23, 13, 27, -3, 24], ['C', -17, 26, -29, 20, -32, 13],
      ['L', -37, 10], ['C', -32, 4, -34, -3, -32, -11],
      ['C', -28, -24, -20, -29, -8, -29], ['Z'],
    ]);
    const coat = ctx.createLinearGradient(-30, -26, 30, 22);
    coat.addColorStop(0, '#d69153'); coat.addColorStop(.6, '#c47a41'); coat.addColorStop(1, '#a86137');
    ctx.fillStyle = coat; ctx.fill(outline);
    ctx.save(); ctx.clip(outline);
    // One connected facial mask becomes one cheek in profile. Hiding the far
    // eye must not leave its large white eye-shaped patch on the side of the head.
    const mask = contour([
      ['M', 0, -8], ['C', 7, -20, 20, -17, 27, -8],
      ['C', 32, -2, 33, 4, 31, 10], ['L', 36, 13],
      ['C', 28, 25, 12, 28, 0, 25], ['C', -12, 28, -28, 25, -36, 13],
      ['L', -31, 10], ['C', -33, 4, -32, -2, -27, -8],
      ['C', -20, -17, -7, -20, 0, -8], ['Z'],
    ], [
      ['M', 11, -13], ['C', 18, -15, 24, -9, 27, -3],
      ['C', 28, 0, 32, 1, 37, 5], ['L', 34, 11],
      ['C', 32, 21, 16, 25, -3, 22], ['C', -15, 22, -23, 15, -27, 10],
      ['L', -22, 9], ['C', -21, 2, -16, -4, -8, -7],
      ['C', -3, -12, 4, -15, 11, -13], ['Z'],
    ]);
    ctx.fillStyle = '#efe2c5'; ctx.fill(mask);
    const eyeSockets = [
      { anchor: point(-15, 0, 0, -3), visibility: 1 - smooth(clamp((profile - .32) / .30, 0, 1)), width: lerp(1, .8, profile), side: -1 },
      { anchor: point(15, 0, 7, -1), visibility: 1, width: 1, side: 1 },
    ];
    for (const socket of eyeSockets) {
      ctx.save(); ctx.globalAlpha *= socket.visibility; ctx.translate(...socket.anchor); ctx.scale(socket.width, 1);
      ellipse(ctx, 0, 0, 4.6, 4.3, '#8b5135');
      const slant = socket.side * (1 - profile) + profile;
      path(ctx, `M-3 2Q${2 * slant} 5 ${3 * slant} 13Q${-3 * slant} 10-4 4Z`, '#9b603e');
      if (open > .025) {
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 2.9 * open, 0, 0, TAU); ctx.clip();
        ellipse(ctx, 0, 0, 2.5, 2.9, '#27342b');
        ellipse(ctx, -.65 * direction, -.9, .6, .7, '#fff7df'); ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(-2.7, -.35 * open);
      ctx.quadraticCurveTo(0, -3.2 * open + 1.1 * (1 - open), 2.7, -.35 * open);
      ctx.strokeStyle = '#43382c'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();
    }
    // Muzzle and lips belong to the same face silhouette as the eye mask.
    // Keep this clip active: a separate unmasked oval previously protruded
    // beyond the profile jaw and painted over its outline.
    const muzzle = point(0, 17, 23, 13), nose = point(0, 12, 32, 6);
    ellipse(ctx, ...muzzle, lerp(14, 10, profile), lerp(8, 6.5, profile), '#f5e9d1');
    ellipse(ctx, ...nose, lerp(4.8, 3.7, profile), 3.2, '#2f362d');
    const stem = point(0, 20, 31, 11.5);
    const left = point(-6, 21, 22.5, 16.5), right = point(6, 21, 31, 11.5);
    const lip = point(0, 22, 27, 17);
    line(ctx, [[nose[0], nose[1] + 2], stem], '#66543d', 1.1);
    ctx.beginPath(); ctx.moveTo(...left); ctx.quadraticCurveTo(...lip, ...right);
    ctx.strokeStyle = '#66543d'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    // Trace the complete jaw last so highlights cannot erase its boundary.
    ctx.strokeStyle = '#87533544'; ctx.lineWidth = .8; ctx.stroke(outline);

    ctx.restore();
  }

  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.frameId); this.resizeObserver.disconnect();
    for (const [event, listener] of [['pointerdown', this.boundDown], ['pointermove', this.boundMove], ['pointerup', this.boundUp], ['pointercancel', this.boundUp], ['wheel', this.boundWheel], ['keydown', this.boundKey]]) this.canvas.removeEventListener(event, listener);
  }
}
