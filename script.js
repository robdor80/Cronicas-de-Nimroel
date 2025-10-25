/* ==========================================================
   SANTUARIO · Lluvia de runas + Portal + Audio sin microcortes
   ========================================================== */

/* ---------- LLUVIA DE RUNAS (segura: no duplica) ---------- */
const RUNES = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ","ᚻ","ᚾ","ᛁ","ᛃ","ᛇ","ᛈ","ᛉ","ᛊ","ᛋ","ᛏ","ᛒ","ᛖ","ᛗ","ᛚ","ᛜ","ᛞ","ᛟ"];

function initRuneRain(){
  const layer = document.getElementById('runeRain');
  if(!layer || layer.childElementCount > 0) return;

  const small = matchMedia('(max-width:768px)').matches;
  const COLS = small ? 11 : 20;
  const ROWS = small ? 12 : 18;
  const SPEED_MIN = 12, SPEED_MAX = 20;
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);

  for (let i = 0; i < COLS; i++) {
    const col = document.createElement('div');
    col.className = 'column';
    col.style.left = (Math.random() * vw) + 'px';

    const dur = (SPEED_MIN + Math.random()*(SPEED_MAX - SPEED_MIN)).toFixed(1) + 's';
    const delay = (-Math.random()*parseFloat(dur)).toFixed(2) + 's';
    col.style.setProperty('--dur', dur);
    col.style.setProperty('--delay', delay);

    for (let r = 0; r < ROWS; r++) {
      const g = document.createElement('span');
      g.className = 'glyph';
      g.style.fontFamily = '"Noto Sans Runic","Segoe UI Symbol","Arial Unicode MS",serif';
      g.textContent = RUNES[(Math.random()*RUNES.length) | 0];
      g.style.setProperty('--gdelay', (Math.random()*2).toFixed(2) + 's');
      const base = small ? 26 : 24;
      g.style.fontSize = (base + Math.random()*10) + 'px';
      col.appendChild(g);
    }
    layer.appendChild(col);
  }

  setInterval(() => {
    const nodes = document.querySelectorAll('#runeRain .glyph');
    for (let i = 0; i < Math.min(14, nodes.length); i++) {
      const n = nodes[(Math.random()*nodes.length) | 0];
      n.textContent = RUNES[(Math.random()*RUNES.length) | 0];
    }
  }, 1800);
}

/* ---------- PORTAL (recuerdo de sesión) ---------- */
const GATE_KEY = 'nimroel_gate';
const TTL_MIN  = 30;
function gateIsValid(){
  try{
    const raw = sessionStorage.getItem(GATE_KEY);
    if(!raw) return false;
    const { t } = JSON.parse(raw);
    return (Date.now() - t) < TTL_MIN * 60 * 1000;
  }catch{ return false; }
}
function markGate(){
  try{ sessionStorage.setItem(GATE_KEY, JSON.stringify({ t: Date.now() })); }catch{}
}

/* ---------- AUDIO ---------- */
/* campanita → HTMLAudio (sencillo)
   canto → Web Audio API (sin cortes) */
let sfxClick = null;

// Contexto de audio (Web Audio API)
let audioCtx, gainNode, bgBuffer = null, bgSource = null, bgReady = false;

async function setupAudio(){
  // Efecto click
  try{
    sfxClick = new Audio('medios/audio/campanita.mp3');
    sfxClick.preload = 'auto';
    sfxClick.volume = 0.9;
  }catch{}

  // Contexto y cadena
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.5; // volumen del fondo
  gainNode.connect(audioCtx.destination);

  // Descarga + decodificación del mp3 (en memoria)
  try{
    const resp = await fetch('medios/audio/canto_index.mp3', { cache: 'force-cache' });
    const buf  = await resp.arrayBuffer();
    bgBuffer   = await audioCtx.decodeAudioData(buf);
    bgReady    = true;
  }catch(e){
    console.warn('No se pudo decodificar canto_index.mp3:', e);
  }
}

// Arranca el loop sin cortes
function startBgLoop(options = {}){
  if(!audioCtx || !bgBuffer) return;
  if(bgSource){ try{ bgSource.stop(); }catch{} bgSource.disconnect(); bgSource = null; }

  bgSource = audioCtx.createBufferSource();
  bgSource.buffer = bgBuffer;
  bgSource.loop = true;

  // Si conoces puntos de loop exactos (para MP3 con silencios), descomenta:
  // bgSource.loopStart = 0.00;  // segundos
  // bgSource.loopEnd   = bgBuffer.duration; // o un valor menor si tu archivo tiene cola

  bgSource.connect(gainNode);

  // Algunos navegadores inician contexto en "suspended" → resume al gesto
  const startNow = () => {
    audioCtx.resume().then(()=>{
      bgSource.start(0);
    }).catch(()=>{});
  };
  // Si ya venimos de una interacción (click en runa), esto será inmediato:
  startNow();
}

/* ---------- LÓGICA DEL PORTAL ---------- */
async function unlockGate(){
  // campanita
  if(sfxClick){ try{ await sfxClick.play(); }catch{} }

  // marca sesión
  markGate();

  // oculta portal
  const gate = document.getElementById('gate');
  if(gate) gate.classList.add('hidden');

  // Inicia canto sin cortes (ya decodificado)
  if(bgReady){ startBgLoop(); }

  document.body.classList.add('crystal-awake');
}

function initGate(){
  const gate = document.getElementById('gate');
  const btn  = document.getElementById('gateBtn');
  if(!gate || !btn) return;

  if(gateIsValid()){
    gate.classList.add('hidden');
    if(bgReady){ startBgLoop(); }
  }

  btn.addEventListener('click', unlockGate);
  btn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault(); unlockGate();
    }
  });

  addEventListener('keydown', (e)=>{
    if(gate.classList.contains('hidden')) return;
    if(e.key === 'Enter'){ unlockGate(); }
  });
}

/* ---------- INICIO ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  initRuneRain();
  await setupAudio();  // decodifica el canto en memoria
  initGate();
});
