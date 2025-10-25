/* ==========================================================
   SANTUARIO · Lluvia de runas + Portal + Alternancia A/B sin cortes
   A = primer_canto.mp3   ·   B = segundo_canto.mp3
   Secuencia: A → B → A → B → ... (con micro-crossfade)
   Anti-autoplay: arranque tras recarga sin quedarnos mudos
   ========================================================== */

/* ---------- LLUVIA DE RUNAS (segura: no duplica) ---------- */
const RUNES = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ","ᚻ","ᚾ","ᛁ","ᛃ","ᛇ","ᛉ","ᛊ","ᛋ","ᛏ","ᛒ","ᛖ","ᛗ","ᛚ","ᛜ","ᛞ","ᛟ"];

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
let sfxClick = null;

let audioCtx = null, masterGain = null;
let bufferA = null, bufferB = null;       // A: primer_canto · B: segundo_canto
let current = null, nextUp = null;         // { source, gain, label, startTime, duration }
let timers = [];                           // para limpiar setTimeouts al salir

const FADE = 0.06; // segundos de crossfade

function clearTimers(){
  timers.forEach(id => clearTimeout(id));
  timers = [];
}

function makeSource(buffer, label){
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = false; // alternamos manualmente
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  source.connect(gain).connect(masterGain);
  return { source, gain, label, startTime: 0, duration: buffer.duration };
}

async function setupAudio(){
  try{
    sfxClick = new Audio('medios/audio/campanita.mp3');
    sfxClick.preload = 'auto';
    sfxClick.volume = 0.9;
  }catch{}

  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(audioCtx.destination);

  async function loadToBuffer(url){
    const resp = await fetch(url, { cache: 'force-cache' });
    const arr  = await resp.arrayBuffer();
    return await audioCtx.decodeAudioData(arr);
  }

  try{
    [bufferA, bufferB] = await Promise.all([
      loadToBuffer('medios/audio/primer_canto.mp3'),
      loadToBuffer('medios/audio/segundo_canto.mp3')
    ]);
  }catch(e){
    console.warn('Error decodificando audio:', e);
  }
}

/* Alternancia A↔B programada con crossfade */
function scheduleAlternation(startWith = 'A'){
  if(!bufferA || !bufferB || !audioCtx) return;

  stopMusicOnly();
  clearTimers();

  current = (startWith === 'A')
    ? makeSource(bufferA, 'A')
    : makeSource(bufferB, 'B');

  const startNow = () => {
    const now = audioCtx.currentTime;
    current.startTime = now;
    try { current.source.start(now); } catch(e){}
    programNextCrossfade();
  };

  // Reanuda el contexto si está suspendido
  audioCtx.resume().then(startNow).catch(()=>{
    // si falla (autoplay), lo intentaremos tras un gesto del usuario
  });
}

function programNextCrossfade(){
  if(!current) return;

  const now = audioCtx.currentTime;
  const endTime   = current.startTime + current.duration;
  const crossTime = Math.max(now + 0.01, endTime - FADE);

  const comingLabel = (current.label === 'A') ? 'B' : 'A';
  const comingBuf   = (comingLabel === 'A') ? bufferA : bufferB;

  nextUp = makeSource(comingBuf, comingLabel);
  nextUp.gain.gain.setValueAtTime(0, now);

  const startNext = () => {
    try {
      nextUp.source.start(crossTime);
      // crossfade
      current.gain.gain.setValueAtTime(current.gain.gain.value, crossTime);
      current.gain.gain.linearRampToValueAtTime(0, crossTime + FADE);

      nextUp.gain.gain.setValueAtTime(0, crossTime);
      nextUp.gain.gain.linearRampToValueAtTime(1, crossTime + FADE);
    } catch(e){}
  };

  const swapAndContinue = () => {
    try { current.source.stop(); } catch(e){}
    try { current.source.disconnect(); current.gain.disconnect(); } catch(e){}
    current = nextUp;
    current.startTime = crossTime;
    nextUp = null;
    programNextCrossfade();
  };

  const msToStart = Math.max(0, (crossTime - now) * 1000);
  const msToSwap  = Math.max(0, (crossTime + FADE - now) * 1000);

  timers.push(setTimeout(startNext, msToStart));
  timers.push(setTimeout(swapAndContinue, msToSwap));
}

/* Detiene solo música (mantiene contexto por si reanudamos) */
function stopMusicOnly(){
  try{
    if(current){
      try{ current.source.stop(); }catch{}
      try{ current.source.disconnect(); current.gain.disconnect(); }catch{}
      current = null;
    }
    if(nextUp){
      try{ nextUp.source.stop(); }catch{}
      try{ nextUp.source.disconnect(); nextUp.gain.disconnect(); }catch{}
      nextUp = null;
    }
  }catch{}
}

/* Limpia TODO al salir de la página */
function stopBgAudio(){
  clearTimers();
  stopMusicOnly();
  try{
    if(masterGain){ masterGain.disconnect(); masterGain = null; }
    if(audioCtx){ const ctx = audioCtx; audioCtx = null; ctx.close().catch(()=>{}); }
  }catch{}
  bufferA = bufferB = null;
}

/* ---- Anti-autoplay tras RECARGA con sesión válida ---- */
let armedAutoplayFix = false;
function armAutoplayBypass(startLabel = 'A'){
  if(armedAutoplayFix) return;
  armedAutoplayFix = true;

  const kick = () => {
    // reanuda contexto y lanza la alternancia
    if(audioCtx && audioCtx.state !== 'running'){
      audioCtx.resume().catch(()=>{});
    }
    scheduleAlternation(startLabel);

    // limpiar escuchas
    document.removeEventListener('pointerdown', kick);
    document.removeEventListener('keydown', kick);
    document.removeEventListener('touchstart', kick);
  };

  document.addEventListener('pointerdown', kick, { once:true });
  document.addEventListener('keydown', kick, { once:true });
  document.addEventListener('touchstart', kick, { once:true });
}

/* ---------- LÓGICA DEL PORTAL ---------- */
async function unlockGate(){
  if(sfxClick){ try{ await sfxClick.play(); }catch{} }
  markGate();

  const gate = document.getElementById('gate');
  if(gate) gate.classList.add('hidden');

  document.body.classList.remove('lock-scroll'); // <- habilita scroll ya

  scheduleAlternation('A');
  document.body.classList.add('crystal-awake');
}

function initGate(){
  const gate = document.getElementById('gate');
  const btn  = document.getElementById('gateBtn');
  if(!gate || !btn) return;

  // Bloquea scroll si el portal está activo
  if(!gate.classList.contains('hidden')){
    document.body.classList.add('lock-scroll');
  }

  if(gateIsValid()){
    gate.classList.add('hidden');
    document.body.classList.remove('lock-scroll'); // <- no bloquees si ya está verificado
    scheduleAlternation('A');
    if(audioCtx && audioCtx.state !== 'running'){ armAutoplayBypass('A'); }
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

/* ---------- LIMPIEZA AL NAVEGAR A OTRA PÁGINA ---------- */
window.addEventListener('pagehide', stopBgAudio);
window.addEventListener('beforeunload', stopBgAudio);

/* ---------- INICIO ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  initRuneRain();
  await setupAudio();   // decodifica A y B
  initGate();           // si la sesión es válida, intenta arrancar A→B (con bypass gestual si hace falta)
});


/* ==========================================================
   TARJETAS DE CRISTAL · Revelado, flotación y parallax
   (pegar al final de script.js)
   ========================================================== */
(function cardsFX(){
  const terminal   = document.getElementById('terminal');
  const cardsWrap  = document.querySelector('.cards');
  if(!terminal || !cardsWrap) return;
  const cards = Array.from(cardsWrap.querySelectorAll('.card-glass'));
  if(!cards.length) return;

  let revealed = false;
  let rafId = null;

  // --- 1) Revelado escalonado cuando body gana 'crystal-awake'
  function revealCards(){
    if(revealed) return;
    revealed = true;
    const baseDelay = 100; // ms entre tarjeta y tarjeta
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px) scale(0.98)';
      card.style.transition = 'opacity .7s ease, transform .7s ease, box-shadow .3s ease';

      setTimeout(()=>{
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
      }, i * baseDelay + 150);
    });
  }

  // Observa el body para saber cuándo aparece 'crystal-awake' (sin tocar tu código existente)
  const mo = new MutationObserver(() => {
    if(document.body.classList.contains('crystal-awake')){
      revealCards();
      mo.disconnect();
    }
  });
  mo.observe(document.documentElement, { attributes:true, subtree:true, attributeFilter:['class'] });

  // Si ya está activa al cargar (sesión recordada), dispara también
  if(document.body.classList.contains('crystal-awake')) {
    revealCards();
    mo.disconnect();
  }

  // --- 2) Flotación suave (idle bobbing) + 3) Parallax con el ratón
  const floats = cards.map((card, i) => ({
    el: card,
    seed: Math.random() * Math.PI * 2,
    amp: 2 + Math.random() * 2,       // amplitud en px
    speed: 0.4 + Math.random() * 0.5, // velocidad
    baseX: 0,
    baseY: 0,
    parX: 0,
    parY: 0
  }));

  // Parallax solo desktop
  let targetParX = 0, targetParY = 0;
  const desktop = matchMedia('(pointer:fine)').matches;
  if(desktop){
    window.addEventListener('mousemove', (e)=>{
      const cx = window.innerWidth  * 0.5;
      const cy = window.innerHeight * 0.5;
      const dx = (e.clientX - cx) / cx;   // -1 .. 1
      const dy = (e.clientY - cy) / cy;   // -1 .. 1
      // máx ~6px lateral, ~4px vertical
      targetParX = dx * 6;
      targetParY = dy * 4;
    });
  }

  function tick(t){
    floats.forEach((f, i) => {
      // easing hacia el objetivo de parallax (suave)
      f.parX += (targetParX - f.parX) * 0.06;
      f.parY += (targetParY - f.parY) * 0.06;

      // flotación sinusoidal individual
      const y = Math.sin((t/1000) * f.speed + f.seed) * f.amp;
      const x = Math.cos((t/1100) * (f.speed*0.85) + f.seed) * (f.amp * 0.35);

      f.el.style.transform = `translate3d(${(x + f.parX).toFixed(2)}px, ${(y + f.parY).toFixed(2)}px, 0)`;
    });
    rafId = requestAnimationFrame(tick);
  }

  // Arranca animaciones cuando el terminal esté visible
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        if(!rafId) rafId = requestAnimationFrame(tick);
      }else{
        if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
      }
    });
  }, { threshold: 0.05 });
  io.observe(terminal);

  // Limpieza al salir de la página
  window.addEventListener('pagehide', ()=>{
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    io.disconnect();
    mo.disconnect();
  });
})();

/* ==========================================================
   TOGGLE MÚSICA (ARPA) — ON/OFF por ganancia global
   ========================================================== */
(function musicToggle(){
  const btn = document.getElementById('musicToggle');
  if(!btn) return;

  // Debe coincidir con el volumen "ON" que pones en setupAudio()
  const TARGET_GAIN = 0.55;

  let muted = false;
  let pending = false; // si el usuario pulsa antes de que masterGain exista

  function applyVolume() {
    if(!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime + 0.05;
    const dest = muted ? 0.0 : TARGET_GAIN;

    try {
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.linearRampToValueAtTime(dest, t + 0.35);
    } catch(e) {}
  }

  // Si todavía no hay masterGain, esperamos a que aparezca
  const waiter = setInterval(() => {
    if(typeof masterGain !== 'undefined' && masterGain){
      clearInterval(waiter);
      if(pending) { applyVolume(); pending = false; }
      // Sincroniza el estado visual del botón con el volumen real
      const gv = (masterGain.gain && typeof masterGain.gain.value === 'number') ? masterGain.gain.value : TARGET_GAIN;
      muted = gv < 0.05;
      btn.classList.toggle('off', muted);
    }
  }, 120);

  btn.addEventListener('click', ()=>{
    // Alterna estado
    muted = !muted;
    btn.classList.toggle('off', muted);

    if(masterGain){
      applyVolume();
    }else{
      // Aún no está listo; aplica cuando esté
      pending = true;
    }
  });

  // Si la música arranca más tarde (por desbloqueo/recarga), vuelve a aplicar el estado del toggle
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && masterGain){
      // re-aplica volumen por si el contexto cambió estado
      applyVolume();
      btn.classList.toggle('off', muted);
    }
  });
})();


// ---------------- PWA Install (captura consistente) ----------------
let deferredPrompt = null;
const installBtn = document.getElementById('pwaInstall');

// Registrar el listener lo antes posible
window.addEventListener('beforeinstallprompt', (e) => {
  // Evita la mini-infobar de Chrome
  e.preventDefault();
  deferredPrompt = e;
  // Muestra tu botón
  installBtn?.classList.remove('hidden');
}, { once: true });

// Al pulsar tu botón, muestra el prompt nativo
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBtn.disabled = true;
  try {
    const choice = await deferredPrompt.prompt();
    // Opcional: choice.outcome => 'accepted' | 'dismissed'
  } catch (_) {
    // Ignora
  } finally {
    deferredPrompt = null;
    installBtn.classList.add('hidden');
    installBtn.disabled = false;
  }
});

// Si ya está instalada, oculta el botón
function hideIfStandalone() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true; // iOS
  if (isStandalone) installBtn?.classList.add('hidden');
}
hideIfStandalone();

// También ocúltalo cuando se complete la instalación
window.addEventListener('appinstalled', () => {
  installBtn?.classList.add('hidden');
});
