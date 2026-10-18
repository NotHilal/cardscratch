// Put your real gift codes here. Each new card picks one at random.
// If the list is empty, a random demo code is generated instead.
const CODES = ["RA-DYDSGS7E42NYHCWC"];

const REVEAL_THRESHOLD = 0.55; // fraction scratched before auto-reveal
const BLOCK = 16;               // pixel size of the "grass block" texture
const BRUSH = 22;               // scratch radius in CSS pixels

const card = document.getElementById("card");
const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d");
const codeEl = document.getElementById("code");
const copyBtn = document.getElementById("copyBtn");
const resetBtn = document.getElementById("resetBtn");
const progressEl = document.getElementById("progress");
const hintEl = document.getElementById("hint");
const particles = document.getElementById("particles");

let scratching = false;
let revealed = false;
let last = null;
let checkPending = false;

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const group = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${group()}-${group()}-${group()}-${group()}`;
}

function pickCode() {
  return CODES.length ? CODES[Math.floor(Math.random() * CODES.length)] : randomCode();
}

// Draws a grass-block style cover: green top band, dirt below, random pixel noise.
function drawCover() {
  const rect = card.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = false;

  const w = rect.width;
  const h = rect.height;
  const grassRows = Math.max(2, Math.round(h / BLOCK / 3));
  const grass = ["#5fa62b", "#6dbb34", "#4f9323", "#7cc63f"];
  const dirt = ["#8b5a2b", "#7a4e24", "#9b6a38", "#6b4219", "#a67644"];
  const stone = ["#8f8f8f", "#7a7a7a", "#a3a3a3"];

  for (let y = 0; y * BLOCK < h; y++) {
    for (let x = 0; x * BLOCK < w; x++) {
      let palette;
      if (y < grassRows) palette = grass;
      else if (y === grassRows && Math.random() < 0.5) palette = grass; // jagged grass edge
      else palette = Math.random() < 0.06 ? stone : dirt;
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
    }
  }

  // Sprinkle a few ore pixels for fun
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(Math.random() * (w / BLOCK)) * BLOCK;
    const y = (grassRows + 1 + Math.floor(Math.random() * Math.max(1, h / BLOCK - grassRows - 1))) * BLOCK;
    ctx.fillStyle = Math.random() < 0.5 ? "#ffd83d" : "#4ee6e0";
    ctx.fillRect(x + 4, y + 4, BLOCK / 2, BLOCK / 2);
  }

  // Label
  ctx.font = `${Math.max(12, Math.round(w / 26))}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.fillText("SCRATCH HERE!", w / 2 + 3, h * 0.62 + 3);
  ctx.fillStyle = "#fff";
  ctx.fillText("SCRATCH HERE!", w / 2, h * 0.62);
}

function pointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// Erase in chunky square "pixels" so the scratch looks blocky.
function scratchAt(p) {
  ctx.globalCompositeOperation = "destination-out";
  const step = 8;
  for (let dx = -BRUSH; dx <= BRUSH; dx += step) {
    for (let dy = -BRUSH; dy <= BRUSH; dy += step) {
      if (dx * dx + dy * dy <= BRUSH * BRUSH) {
        const gx = Math.floor((p.x + dx) / step) * step;
        const gy = Math.floor((p.y + dy) / step) * step;
        ctx.fillRect(gx, gy, step, step);
      }
    }
  }
}

function scratchLine(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    scratchAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
}

function scratchedFraction() {
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let clear = 0, total = 0;
  for (let i = 3; i < data.length; i += 4 * 16) { // sample every 16th pixel
    total++;
    if (data[i] === 0) clear++;
  }
  return clear / total;
}

function scheduleCheck() {
  if (checkPending) return;
  checkPending = true;
  requestAnimationFrame(() => {
    checkPending = false;
    const frac = scratchedFraction();
    progressEl.style.width = `${Math.min(100, (frac / REVEAL_THRESHOLD) * 100)}%`;
    if (!revealed && frac >= REVEAL_THRESHOLD) reveal();
  });
}

function spawnDirt(p) {
  const rect = canvas.getBoundingClientRect();
  const colors = ["#5fa62b", "#8b5a2b", "#6b4219", "#7cc63f"];
  for (let i = 0; i < 2; i++) {
    burstParticle(rect.left + p.x, rect.top + p.y, colors, 60, 500);
  }
}

function burstParticle(x, y, colors, spread, duration) {
  const el = document.createElement("div");
  el.className = "particle";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.background = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 8;
  el.style.width = el.style.height = `${size}px`;
  particles.appendChild(el);

  const dx = (Math.random() - 0.5) * spread * 2;
  const dy = -Math.random() * spread - 20;
  el.animate(
    [
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 180}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx * 1.4}px, ${dy + spread * 3}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ],
    { duration: duration + Math.random() * duration, easing: "cubic-bezier(.2,.6,.4,1)" }
  ).onfinish = () => el.remove();
}

function celebrate() {
  const rect = card.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ["#ffd83d", "#4ee6e0", "#ffffff", "#7fd12e", "#ff5555"];
  for (let i = 0; i < 70; i++) burstParticle(cx, cy, colors, 220, 900);
}

function reveal() {
  revealed = true;
  canvas.classList.add("done");
  card.classList.add("revealed");
  progressEl.style.width = "100%";
  copyBtn.disabled = false;
  hintEl.textContent = "Diamonds! You found a gift code!";
  celebrate();
}

function newCard() {
  revealed = false;
  last = null;
  canvas.classList.remove("done");
  card.classList.remove("revealed");
  copyBtn.disabled = true;
  copyBtn.textContent = "COPY CODE";
  progressEl.style.width = "0%";
  hintEl.innerHTML = "Click &amp; drag (or swipe) to dig through the grass.";
  codeEl.textContent = pickCode();
  drawCover();
}

canvas.addEventListener("pointerdown", (e) => {
  if (revealed) return;
  scratching = true;
  canvas.setPointerCapture(e.pointerId);
  last = pointFromEvent(e);
  scratchAt(last);
  scheduleCheck();
});

canvas.addEventListener("pointermove", (e) => {
  if (!scratching || revealed) return;
  const p = pointFromEvent(e);
  scratchLine(last, p);
  if (Math.random() < 0.5) spawnDirt(p);
  last = p;
  scheduleCheck();
});

["pointerup", "pointercancel", "pointerleave"].forEach((type) =>
  canvas.addEventListener(type, () => { scratching = false; last = null; })
);

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(codeEl.textContent);
    copyBtn.textContent = "COPIED!";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(codeEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    copyBtn.textContent = "SELECTED";
  }
  setTimeout(() => (copyBtn.textContent = "COPY CODE"), 1500);
});

resetBtn.addEventListener("click", newCard);

let resizeTimer;
window.addEventListener("resize", () => {
  if (revealed) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawCover, 150); // redraw resets the scratch, which is fine on resize
});

// Wait for the pixel font so the "SCRATCH HERE!" label renders in it.
(document.fonts ? document.fonts.ready : Promise.resolve()).then(newCard);
