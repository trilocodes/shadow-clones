// ─── clones.js ───────────────────────────────────────────────────────────────

const ClonesEngine = (() => {

  // Depth: back clones are darker, mid clones slightly less dark
  const CLONE_LAYOUT = [
    { offsetX: -0.22, scale: 0.86, opacity: 0.75, darkness: 0.72, layer: 'back' },
    { offsetX:  0.22, scale: 0.86, opacity: 0.75, darkness: 0.72, layer: 'back' },
    { offsetX: -0.11, scale: 0.93, opacity: 0.88, darkness: 0.52, layer: 'mid'  },
    { offsetX:  0.11, scale: 0.93, opacity: 0.88, darkness: 0.52, layer: 'mid'  },
  ];

  let personCanvas = null;
  let bgCanvas     = null;
  // One tinted canvas per clone (different darkness levels)
  let tintedCanvases = [];

  let hasSnapshot  = false;
  let cloneState   = 'idle';
  let animProgress = 0;
  let glowPulse    = 0;
  let CW = 0, CH = 0;

  // ── Particles (smoke) ──────────────────────────────────────────────────────
  let smokeParticles = [];

  // ── Lightning ──────────────────────────────────────────────────────────────
  let lightningBolts = [];
  let lightningTimer = 0;

  function _canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function init(width, height) {
    CW = width; CH = height;
    personCanvas   = _canvas(CW, CH);
    bgCanvas       = _canvas(CW, CH);
    tintedCanvases = CLONE_LAYOUT.map(() => _canvas(CW, CH));
    smokeParticles = [];
    lightningBolts = [];
  }

  function updateSegmentation(videoEl, maskCanvas) {
    if (!personCanvas || !videoEl) return;
    const W = CW, H = CH;

    const temp = _canvas(W, H);
    const tCtx = temp.getContext('2d');
    tCtx.save();
    tCtx.translate(W, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(videoEl, 0, 0, W, H);
    tCtx.restore();

    // Background
    const bCtx = bgCanvas.getContext('2d');
    bCtx.clearRect(0, 0, W, H);
    bCtx.drawImage(temp, 0, 0);
    bCtx.save();
    bCtx.globalCompositeOperation = 'destination-out';
    bCtx.drawImage(maskCanvas, 0, 0, W, H);
    bCtx.restore();

    // Person only
    const pCtx = personCanvas.getContext('2d');
    pCtx.clearRect(0, 0, W, H);
    pCtx.drawImage(maskCanvas, 0, 0, W, H);
    pCtx.save();
    pCtx.globalCompositeOperation = 'source-in';
    pCtx.drawImage(temp, 0, 0);
    pCtx.restore();
  }

  function captureSnapshot() {
    if (!personCanvas) return;
    const W = CW, H = CH;

    // Bake a tinted version for each clone with its own darkness level
    CLONE_LAYOUT.forEach((cfg, i) => {
      const tCtx = tintedCanvases[i].getContext('2d');
      tCtx.clearRect(0, 0, W, H);
      tCtx.drawImage(personCanvas, 0, 0);

      // Dark overlay — deeper for back clones
      tCtx.fillStyle = `rgba(0, 5, 30, ${cfg.darkness})`;
      tCtx.fillRect(0, 0, W, H);
      tCtx.save();
      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(personCanvas, 0, 0);
      tCtx.restore();

      // Blue tint
      tCtx.fillStyle = 'rgba(0, 60, 180, 0.12)';
      tCtx.fillRect(0, 0, W, H);
      tCtx.save();
      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(personCanvas, 0, 0);
      tCtx.restore();

      // ── Sharingan eyes ──────────────────────────────────────────────────
      // We scan a horizontal band near top-third of person for eye region
      // and paint two red glowing dots
      _paintSharingan(tCtx, W, H, cfg.darkness);
    });

    hasSnapshot = true;
    _spawnSmokeBurst();
    console.log('✅ Snapshot with depth + sharingan');
  }

  // Paint red sharingan-style eye glows on the tinted canvas
  function _paintSharingan(tCtx, W, H, darkness) {
    // Eyes are roughly at 28-35% from top, ±10% from center horizontally
    const eyeY  = H * 0.30;
    const leftX  = W * 0.44;
    const rightX = W * 0.56;
    const radius = W * 0.018;
    const alpha  = Math.max(0.4, darkness); // more visible on darker clones

    for (const ex of [leftX, rightX]) {
      // Outer glow
      const grad = tCtx.createRadialGradient(ex, eyeY, 0, ex, eyeY, radius * 3.5);
      grad.addColorStop(0, `rgba(255, 0, 0, ${alpha * 0.9})`);
      grad.addColorStop(0.3, `rgba(200, 0, 0, ${alpha * 0.6})`);
      grad.addColorStop(1, 'rgba(180, 0, 0, 0)');
      tCtx.save();
      tCtx.globalCompositeOperation = 'source-over';
      tCtx.globalAlpha = 1;
      tCtx.fillStyle = grad;
      tCtx.beginPath();
      tCtx.arc(ex, eyeY, radius * 3.5, 0, Math.PI * 2);
      tCtx.fill();

      // Pupil
      tCtx.fillStyle = `rgba(255, 30, 30, ${alpha})`;
      tCtx.beginPath();
      tCtx.arc(ex, eyeY, radius, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.restore();
    }
  }

  function clearSnapshot() { hasSnapshot = false; }

  function setState(s) {
    if (s === cloneState) return;
    console.log(`Clone: ${cloneState} → ${s}`);
    cloneState = s;
    animProgress = 0;
    if (s === 'idle') {
      smokeParticles = [];
      lightningBolts = [];
    }
  }

  function getState() { return cloneState; }

  // ── Smoke ────────────────────────────────────────────────────────────────
  function _spawnSmokeBurst() {
    for (let i = 0; i < 40; i++) {
      smokeParticles.push({
        x:     CW * (0.1 + Math.random() * 0.8),
        y:     CH * 0.85 + Math.random() * CH * 0.15,
        vx:    (Math.random() - 0.5) * 1.2,
        vy:    -(0.8 + Math.random() * 1.6),
        r:     20 + Math.random() * 50,
        alpha: 0.18 + Math.random() * 0.22,
        life:  1.0,
        decay: 0.004 + Math.random() * 0.006,
      });
    }
  }

  function _updateSmoke(dt) {
    smokeParticles = smokeParticles.filter(p => p.life > 0);
    for (const p of smokeParticles) {
      p.x    += p.vx;
      p.y    += p.vy;
      p.r    += 0.4;
      p.life -= p.decay;
      p.vx   *= 0.99;
      p.vy   *= 0.99;
    }
    // Keep spawning while clones are visible
    if ((cloneState === 'visible' || cloneState === 'glowing') && Math.random() < 0.15) {
      smokeParticles.push({
        x:     CW * (0.05 + Math.random() * 0.9),
        y:     CH * 0.90 + Math.random() * CH * 0.1,
        vx:    (Math.random() - 0.5) * 0.6,
        vy:    -(0.3 + Math.random() * 0.8),
        r:     10 + Math.random() * 25,
        alpha: 0.08 + Math.random() * 0.12,
        life:  1.0,
        decay: 0.006 + Math.random() * 0.008,
      });
    }
  }

  function _drawSmoke(ctx) {
    for (const p of smokeParticles) {
      const a = p.alpha * p.life;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `rgba(180, 200, 255, ${a})`);
      grad.addColorStop(1, 'rgba(100, 120, 200, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Lightning ────────────────────────────────────────────────────────────
  function _spawnLightning() {
    // Connect clones: pick two random adjacent clone positions
    const positions = CLONE_LAYOUT.map(cfg => ({
      x: CW / 2 + cfg.offsetX * CW,
      y: CH * 0.3,
    }));
    // Pick random pair
    const a = positions[Math.floor(Math.random() * positions.length)];
    const b = positions[Math.floor(Math.random() * positions.length)];
    if (a === b) return;
    lightningBolts.push({
      x1: a.x, y1: a.y,
      x2: b.x, y2: b.y,
      life: 1.0,
      decay: 0.08 + Math.random() * 0.12,
      segments: _makeLightningPath(a.x, a.y, b.x, b.y, 8),
    });
  }

  function _makeLightningPath(x1, y1, x2, y2, splits) {
    let points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    for (let s = 0; s < splits; s++) {
      const next = [];
      for (let i = 0; i < points.length - 1; i++) {
        next.push(points[i]);
        const mx = (points[i].x + points[i+1].x) / 2 + (Math.random() - 0.5) * 60;
        const my = (points[i].y + points[i+1].y) / 2 + (Math.random() - 0.5) * 60;
        next.push({ x: mx, y: my });
      }
      next.push(points[points.length - 1]);
      points = next;
    }
    return points;
  }

  function _updateLightning(dt) {
    lightningTimer -= dt;
    if (lightningTimer <= 0 && (cloneState === 'visible' || cloneState === 'glowing' || cloneState === 'appearing')) {
      _spawnLightning();
      lightningTimer = 0.15 + Math.random() * 0.35;
    }
    lightningBolts = lightningBolts.filter(b => b.life > 0);
    for (const b of lightningBolts) b.life -= b.decay;
  }

  function _drawLightning(ctx) {
    for (const bolt of lightningBolts) {
      const a = bolt.life;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = `rgba(180, 230, 255, ${a})`;
      ctx.shadowColor  = 'cyan';
      ctx.shadowBlur   = 18;
      ctx.lineWidth    = 1.5;
      ctx.beginPath();
      ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
      for (let i = 1; i < bolt.segments.length; i++) {
        ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
      }
      ctx.stroke();
      // Bright core
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.8})`;
      ctx.lineWidth   = 0.5;
      ctx.shadowBlur  = 4;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Main draw ────────────────────────────────────────────────────────────
  function drawFrame(ctx, W, H, dt) {
    glowPulse += dt * 3.0;

    if (cloneState === 'appearing') {
      animProgress = Math.min(1, animProgress + dt * 1.4);
      if (animProgress >= 1) cloneState = 'visible';
    }
    if (cloneState === 'merging') {
      animProgress = Math.min(1, animProgress + dt * 1.2);
      if (animProgress >= 1) {
        cloneState = 'idle';
        hasSnapshot = false;
        smokeParticles = [];
        lightningBolts = [];
      }
    }

    _updateSmoke(dt);
    _updateLightning(dt);

    // 1. Background
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);

    // 2. Smoke behind clones
    _drawSmoke(ctx);

    // 3. Clones
    if (hasSnapshot && cloneState !== 'idle') {
      const isGlowing   = cloneState === 'glowing';
      const isMerging   = cloneState === 'merging';
      const isAppearing = cloneState === 'appearing';

      for (const layer of ['back', 'mid']) {
        CLONE_LAYOUT.forEach((cfg, i) => {
          if (cfg.layer !== layer) return;
          _drawClone(ctx, W, H, cfg, i, isAppearing, isGlowing, isMerging);
        });
      }
    }

    // 4. Lightning on top of clones
    _drawLightning(ctx);

    // 5. Live person on top of everything
    if (personCanvas) ctx.drawImage(personCanvas, 0, 0, W, H);
  }

  function _drawClone(ctx, W, H, cfg, idx, isAppearing, isGlowing, isMerging) {
    const eOut = easeOutCubic(animProgress);
    const eIn  = easeInCubic(animProgress);

    const cloneW = W * cfg.scale;
    const cloneH = H * cfg.scale;
    const baseX  = (W - cloneW) / 2;
    const baseY  = (H - cloneH) / 2;
    const offX   = cfg.offsetX * W;

    let drawX, drawY, alpha, blurPx;

    if (isAppearing) {
      drawX  = baseX + offX * eOut;
      drawY  = baseY;
      alpha  = cfg.opacity * eOut;
      blurPx = (1 - eOut) * 8;
    } else if (isMerging) {
      drawX  = baseX + offX * (1 - eIn);
      drawY  = baseY;
      alpha  = cfg.opacity * (1 - eIn);
      blurPx = eIn * 12;
    } else {
      drawX  = baseX + offX;
      drawY  = baseY;
      alpha  = cfg.opacity;
      blurPx = 0;
    }

    const src = isGlowing ? personCanvas : tintedCanvases[idx];

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    if (isGlowing) {
      const pulse = 0.5 + 0.5 * Math.sin(glowPulse + cfg.offsetX * 4);
      const g = 14 + pulse * 18;
      ctx.filter = `blur(${blurPx}px) drop-shadow(0 0 ${g}px cyan) drop-shadow(0 0 ${g * 2}px rgba(0,150,255,0.5))`;
    } else if (blurPx > 0.1) {
      ctx.filter = `blur(${blurPx}px)`;
    }

    ctx.drawImage(src, drawX, drawY, cloneW, cloneH);
    ctx.restore();
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t)  { return t * t * t; }

  return {
    init, updateSegmentation, captureSnapshot,
    clearSnapshot, setState, getState, drawFrame
  };
})();
