/* ==========================================================
   SANTUARIO · Lluvia de runas + Portal + Secuencia de cantos
   ========================================================== */

/* ---------- LLUVIA DE RUNAS ---------- */
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

/* ---------- PORTAL Y AUDIO ---------- */
const GATE_KEY = 'nimroel_gate';
const TTL_MIN  = 30;

let sfxClick = null;
let canto1 = null;
let canto2 = null;
let currentCanto = null;

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

function preloadAudio(){
  try{
    sfxClick = new Audio('medios/audio/campanita.mp3');
    sfxClick.preload = 'auto';
    sfxClick.volume = 0.9;

    canto1 = new Audio('medios/audio/primer_canto.mp3');
    canto1.preload = 'auto';
    canto1.volume = 0.5;

    canto2 = new Audio('medios/audio/segundo_canto.mp3');
    canto2.preload = 'auto';
    canto2.volume = 0.5;

    // Enlazamos la secuencia: cuando termina uno, suena el otro
    canto1.addEventListener('ended', () => {
      currentCanto = canto2;
      canto2.currentTime = 0;
      canto2.play().catch(()=>{});
    });

    canto2.addEventListener('ended', () => {
      currentCanto = canto1;
      canto1.currentTime = 0;
      canto1.play().catch(()=>{});
    });
  }catch(e){
    console.warn('Audio no disponible:', e);
  }
}

async function startCantos(){
  if (!canto1 || !canto2) return;
  try{
    currentCanto = canto1;
    canto1.currentTime = 0;
    await canto1.play();
  }catch(e){
    // En algunos navegadores necesita gesto del usuario
    const kick = () => {
      canto1.play().catch(()=>{});
      document.removeEventListener('click', kick);
      document.removeEventListener('keydown', kick);
      document.removeEventListener('touchstart', kick);
    };
    document.addEventListener('click', kick, { once:true });
    document.addEventListener('keydown', kick, { once:true });
    document.addEventListener('touchstart', kick, { once:true });
  }
}

async function unlockGate(){
  if(sfxClick){
    try{ await sfxClick.play(); }catch{}
  }
  markGate();

  const gate = document.getElementById('gate');
  if(gate) gate.classList.add('hidden');

  await startCantos(); // inicia la secuencia canto1 → canto2 → bucle
  document.body.classList.add('crystal-awake');
}

function initGate(){
  const gate = document.getElementById('gate');
  const btn  = document.getElementById('gateBtn');
  if(!gate || !btn) return;

  if(gateIsValid()){
    gate.classList.add('hidden');
    startCantos();
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

  // Detiene cantos al salir de la página
  window.addEventListener('beforeunload', ()=>{
    [canto1, canto2].forEach(a=>{
      if(a){ a.pause(); a.currentTime = 0; }
    });
  });
}

/* ---------- INICIO ---------- */
window.addEventListener('DOMContentLoaded', () => {
  preloadAudio();
  initRuneRain();
  initGate();
});
