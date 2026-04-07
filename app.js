// ─── app.js ──────────────────────────────────────────────────────────────────

const video  = document.getElementById('inputVideo');
const canvas = document.getElementById('mainCanvas');
const ctx    = canvas.getContext('2d');

const jutsuText    = document.getElementById('jutsuText');
const gestureIcon  = document.getElementById('gestureIcon');
const gestureLabel = document.getElementById('gestureLabel');
const kanjiFlash   = document.getElementById('kanjiFlash');

const dots = {
  idle:   document.getElementById('dot-idle'),
  clones: document.getElementById('dot-clones'),
  glow:   document.getElementById('dot-glow'),
  merge:  document.getElementById('dot-merge'),
};

const maskCanvas = document.createElement('canvas');
const maskCtx    = maskCanvas.getContext('2d');

// Flash overlay state
let flashAlpha = 0;

function resizeCanvas() {
  canvas.width      = window.innerWidth;
  canvas.height     = window.innerHeight;
  maskCanvas.width  = canvas.width;
  maskCanvas.height = canvas.height;
  ClonesEngine.init(canvas.width, canvas.height);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ─── State ───────────────────────────────────────────────────────────────────
let appState               = 'IDLE';
let lastTime               = performance.now();
let gestureLockout         = false;
let currentDetectedGesture = 'none';
let gestureHoldCount       = 0;
let lastGesture            = 'none';
const HOLD_FRAMES          = 6;

// ─── HUD ─────────────────────────────────────────────────────────────────────
function setHUD(icon, label) {
  gestureIcon.textContent  = icon;
  gestureLabel.textContent = label;
}
function setActiveDot(name) {
  Object.entries(dots).forEach(([k, el]) =>
    el.classList.toggle('active', k === name));
}
function flashKanji() {
  kanjiFlash.classList.remove('hidden', 'flash');
  void kanjiFlash.offsetWidth;
  kanjiFlash.classList.add('flash');
  setTimeout(() => kanjiFlash.classList.add('hidden'), 1300);
}
function showJutsuText(show) {
  jutsuText.classList.toggle('visible', show);
  jutsuText.classList.toggle('hidden', !show);
}

// ─── State transitions ───────────────────────────────────────────────────────
function transitionTo(newState) {
  if (appState === newState) return;
  console.log(`App: ${appState} → ${newState}`);
  appState = newState;

  switch (newState) {
    case 'IDLE':
      ClonesEngine.setState('idle');
      ClonesEngine.clearSnapshot();
      showJutsuText(false);
      setHUD('✌️', 'Show ninja sign to begin');
      setActiveDot('idle');
      gestureLockout = false;
      lastGesture    = 'none';
      break;

    case 'CLONES_ACTIVE':
      ClonesEngine.init(canvas.width, canvas.height);
      ClonesEngine.captureSnapshot();
      ClonesEngine.setState('appearing');
      showJutsuText(true);
      flashKanji();
      flashAlpha = 0.7;   // white flash on spawn
      setHUD('🖐️', 'Open palm to charge chakra');
      setActiveDot('clones');
      gestureLockout = true;
      setTimeout(() => { gestureLockout = false; lastGesture = 'none'; }, 1200);
      break;

    case 'GLOWING':
      ClonesEngine.setState('glowing');
      setHUD('✊', 'Close fist to merge clones');
      setActiveDot('glow');
      gestureLockout = true;
      setTimeout(() => { gestureLockout = false; lastGesture = 'none'; }, 800);
      break;

    case 'MERGING':
      ClonesEngine.setState('merging');
      showJutsuText(false);
      flashAlpha = 0.4;
      setHUD('✌️', 'Show ninja sign again');
      setActiveDot('merge');
      gestureLockout = true;
      setTimeout(() => transitionTo('IDLE'), 1800);
      break;
  }
}

// ─── Gesture detection ───────────────────────────────────────────────────────
function isUp(lm, tip, mcp) {
  return lm[tip].y < lm[mcp].y - 0.025;
}
function detectGesture(lm) {
  const indexUp  = isUp(lm, 8,  5);
  const middleUp = isUp(lm, 12, 9);
  const ringUp   = isUp(lm, 16, 13);
  const pinkyUp  = isUp(lm, 20, 17);
  const total    = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'ninja';
  if (total >= 4)  return 'open';
  if (total === 0) return 'fist';
  return 'none';
}
function processGesture(raw) {
  if (gestureLockout) return;
  if (raw === currentDetectedGesture) {
    gestureHoldCount++;
  } else {
    currentDetectedGesture = raw;
    gestureHoldCount = 1;
  }
  if (gestureHoldCount < HOLD_FRAMES) return;
  if (raw === lastGesture) return;
  lastGesture = raw;
  if (raw === 'ninja' && appState === 'IDLE')                                      transitionTo('CLONES_ACTIVE');
  if (raw === 'open'  && appState === 'CLONES_ACTIVE')                             transitionTo('GLOWING');
  if (raw === 'fist'  && (appState === 'GLOWING' || appState === 'CLONES_ACTIVE')) transitionTo('MERGING');
}

// ─── MediaPipe Hands ─────────────────────────────────────────────────────────
let latestLandmarks = null;

const hands = new Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.6,
});
hands.onResults(results => {
  latestLandmarks = results.multiHandLandmarks || [];
  let best = 'none';
  for (const lm of latestLandmarks) {
    const g = detectGesture(lm);
    if (g !== 'none') { best = g; break; }
  }
  processGesture(best);
});

// ─── MediaPipe Selfie Segmentation ───────────────────────────────────────────
const selfieSegmentation = new SelfieSegmentation({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
});
selfieSegmentation.setOptions({ modelSelection: 1 });
selfieSegmentation.onResults(results => {
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.drawImage(results.segmentationMask, 0, 0, maskCanvas.width, maskCanvas.height);
  ClonesEngine.updateSegmentation(video, maskCanvas);
});

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
    await selfieSegmentation.send({ image: video });
  },
  width: 1280,
  height: 720,
  facingMode: 'user',
});
camera.start();

// ─── Vignette helper ─────────────────────────────────────────────────────────
function drawVignette(W, H) {
  const grad = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ─── Render loop ─────────────────────────────────────────────────────────────
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function drawSkeleton(W, H) {
  if (!latestLandmarks || latestLandmarks.length === 0) return;
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const lm of latestLandmarks) {
    ctx.strokeStyle = '#00cfff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ctx.moveTo((1 - lm[a].x) * W, lm[a].y * H);
      ctx.lineTo((1 - lm[b].x) * W, lm[b].y * H);
    }
    ctx.stroke();
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc((1 - p.x) * W, p.y * H, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }
  ctx.restore();
}

function render(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // 1. Scene: background + clones + live person
  ClonesEngine.drawFrame(ctx, W, H, dt);

  // 2. Vignette on top for cinematic framing
  drawVignette(W, H);

  // 3. Hand skeleton
  drawSkeleton(W, H);

  // 4. White flash overlay (fades out quickly)
  if (flashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle   = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    flashAlpha = Math.max(0, flashAlpha - dt * 3.5);
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
