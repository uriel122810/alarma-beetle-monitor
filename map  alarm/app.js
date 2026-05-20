// ============================================
// ALARMA BEETLE MONITOR — app.js
// Producción: WebSockets Seguros (wss://)
// All UI is inline HTML/CSS — NO prompt/alert
// ============================================
(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // ▼▼▼ CONFIGURACIÓN DE PRODUCCIÓN — MODIFICAR AQUÍ ▼▼▼
  // ═══════════════════════════════════════════════════════════════
  // Línea 14: Reemplaza con el dominio de tu broker MQTT en la nube
  //           Ejemplos: 'broker.hivemq.com', 'tu-vps.ejemplo.com'
  const MQTT_HOST = 'db72239584ec47deab6d2e788db07a49.s1.eu.hivemq.cloud';

  // Línea 17: Puerto para WebSockets con SSL/TLS
  //           HiveMQ Cloud: 8884 | Mosquitto con TLS: 8084 | EMQX: 8084
  const MQTT_PORT = 8884;

  // Línea 20-21: Credenciales de autenticación del broker
  const MQTT_USER = 'telemetria';
  const MQTT_PASS = 'Seguridad2026';

  // Línea 23: Tópico MQTT (el + es un wildcard de un nivel)
  const MQTT_TOPIC = 'sensores/alarmas/+/estado';
  // ═══════════════════════════════════════════════════════════════
  // ▲▲▲ FIN DE CONFIGURACIÓN — NO MODIFICAR DEBAJO ▲▲▲
  // ═══════════════════════════════════════════════════════════════

  const MQTT_CFG = {
    url: `wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`,
    topic: MQTT_TOPIC,
    opts: {
      protocol: 'wss',
      port: MQTT_PORT,
      clientId: 'beetle_monitor_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 5000,
      username: MQTT_USER,
      password: MQTT_PASS,
    },
  };

  const ALARMAS_INICIALES = [
    { id: 'AL-01', nombre: 'Alarma Central CU', lat: 19.3321, lng: -99.1894, altitud: 2260 },
    { id: 'AL-02', nombre: 'Alarma Norte Monterrey', lat: 25.6866, lng: -100.3161, altitud: 540 },
    { id: 'AL-03', nombre: 'Alarma Occidente GDL', lat: 20.6767, lng: -103.3473, altitud: 1566 },
    { id: 'AL-04', nombre: 'Alarma Puerto Veracruz', lat: 19.1738, lng: -96.1342, altitud: 10 },
  ];

  const ADMIN_PWD = 'admin mqtt';
  const STORE = 'beetleMonitor_v2';
  const THEME_STORE = 'beetleMonitor_theme';
  const MK = 32;

  // Tile layer URLs
  const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  // State
  const alarms = {};
  const confirmingDelete = new Set(); // tracks IDs pending delete confirmation
  let admin = false, mqttC = null, map = null, nextId = 5, curFilt = null;
  let audioCtx = null, oscNode = null, gainNode = null, muted = false, vol = 0.7;
  let tileLayer = null; // current Leaflet tile layer
  let currentTheme = localStorage.getItem(THEME_STORE) || 'dark';

  // DOM helpers
  const g = (id) => document.getElementById(id);
  const $evl = g('ev-list'), $vt = g('vt'), $vs = g('vs'), $va = g('va'), $sca = g('sc-a');
  const $cd = g('cd'), $ct = g('ct'), $ld = g('ld');
  const $filtSec = g('filt-sec'), $filtList = g('filt-list');
  const $optPanel = g('opt-panel');
  const $authLogin = g('auth-login'), $authActive = g('auth-active');
  const $authPwd = g('auth-pwd'), $authMsg = g('auth-msg');

  // ═══ 1. PERSISTENCE ═══
  function load() {
    const s = localStorage.getItem(STORE);
    if (s) { try { const a = JSON.parse(s); if (Array.isArray(a) && a.length) { a.forEach(x => { const n = parseInt(x.id.replace('AL-',''),10); if (!isNaN(n) && n >= nextId) nextId = n+1; }); return a; } } catch(_){} }
    return [...ALARMAS_INICIALES];
  }
  function save() {
    localStorage.setItem(STORE, JSON.stringify(Object.values(alarms).map(a => ({ id:a.id, nombre:a.nombre, lat:a.lat, lng:a.lng, altitud:a.altitud }))));
  }

  // ═══ 2. AUDIO ═══
  function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  function playSound() {
    if (muted) return;
    initAudio(); stopSound();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = vol * 0.3;
    gainNode.connect(audioCtx.destination);
    oscNode = audioCtx.createOscillator();
    oscNode.type = 'square'; oscNode.frequency.value = 880;
    const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
    lfo.frequency.value = 4; lg.gain.value = vol * 0.3;
    lfo.connect(lg); lg.connect(gainNode.gain); lfo.start();
    oscNode.connect(gainNode); oscNode.start(); oscNode._lfo = lfo;
    setTimeout(stopSound, 4000);
  }
  function stopSound() { try { if (oscNode) { oscNode.stop(); oscNode._lfo?.stop(); oscNode = null; } } catch(_) { oscNode = null; } }

  // Short test beep for volume preview
  function playTestBeep() {
    if (muted) return;
    initAudio();
    const g2 = audioCtx.createGain();
    g2.gain.value = vol * 0.3;
    g2.connect(audioCtx.destination);
    const o2 = audioCtx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 660;
    o2.connect(g2); o2.start();
    // Fade out smoothly
    g2.gain.setTargetAtTime(0, audioCtx.currentTime + 0.15, 0.05);
    o2.stop(audioCtx.currentTime + 0.25);
  }

  // ═══ 3. MAP ═══
  function initMap() {
    map = L.map('map', { center: [23.6345, -102.5528], zoom: 5 });
    const tileUrl = currentTheme === 'light' ? TILE_LIGHT : TILE_DARK;
    tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    load().forEach(a => addAlarm(a));
    updateStats();
    map.on('dblclick', e => { if (!admin) return; e.originalEvent.preventDefault(); showAddModal(e.latlng.lat, e.latlng.lng); });
  }

  function mkIco(st) {
    const emoji = st === 'offline' ? '🔌' : (st === 'active' ? '🚨' : '🛡');
    return L.divIcon({
      className: `am ${st}`, html: `<div class="mk">${emoji}</div>`,
      iconSize: [MK, MK], iconAnchor: [MK/2, MK/2], popupAnchor: [0, -(MK/2+4)],
    });
  }

  function addAlarm(d) {
    const m = L.marker([d.lat, d.lng], { icon: mkIco('safe') }).addTo(map);
    m.bindPopup(() => popHtml(d.id), { maxWidth: 310, closeButton: true });
    alarms[d.id] = { ...d, status: 'safe', ctrl: null, ts: null, marker: m, lastSeen: Date.now() };
  }

  // ═══ GLOBAL DELETE — state-based confirm (stays visible in popup) ═══
  window.eliminarAlarma = function(id) {
    // Mark alarm as "confirming" and re-render popup with confirm buttons
    confirmingDelete.add(id);
    const a = alarms[id];
    if (a && a.marker.isPopupOpen()) {
      a.marker.getPopup().setContent(popHtml(id));
    }
  };

  window.confirmarEliminar = function(id) {
    confirmingDelete.delete(id);
    const a = alarms[id];
    if (!a) return;
    // 1. Remove marker from map
    map.closePopup();
    map.removeLayer(a.marker);
    // 2. Delete from state
    delete alarms[id];
    // 3. Save to localStorage
    save();
    // 4. Refresh UI
    updateStats();
    renderFilt();
    toast('🗑', `Alarma <strong>${esc(id)}</strong> eliminada`);
  };

  window.cancelarEliminar = function(id) {
    confirmingDelete.delete(id);
    const a = alarms[id];
    if (a && a.marker.isPopupOpen()) {
      a.marker.getPopup().setContent(popHtml(id));
    }
  };

  function popHtml(id) {
    const a = alarms[id];
    if (!a) return '<p>No encontrada</p>';
    
    let c = 'safe', ico = '🛡', lb = 'Seguro';
    if (a.status === 'active') {
      c = 'active'; ico = '🚨'; lb = 'ACTIVADA';
    } else if (a.status === 'offline') {
      c = 'offline'; ico = '🔌'; lb = 'Sin Conexión';
    }
    
    let ex = '';
    if (a.status === 'active' && a.ctrl) {
      ex = `<div class="pr"><span class="pl">🎮 Control</span><span class="pv mono">${esc(a.ctrl)}</span></div>
            <div class="pr"><span class="pl">🕐 Hora</span><span class="pv mono">${fmtT(a.ts)}</span></div>`;
    } else if (a.status === 'offline') {
      ex = `<div class="pr" style="background: rgba(220,38,38,0.1); padding: 8px; border-radius: 6px; border: 1px solid rgba(220,38,38,0.25); margin-top: 6px; justify-content: center; align-items: center; gap: 6px;">
              <span style="color: var(--red-lt); font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">⚠️ Reparación Requerida</span>
            </div>`;
    }
    
    // Admin: show delete button OR confirm bar depending on state
    let del = '';
    if (admin) {
      if (confirmingDelete.has(a.id)) {
        del = `<div style="margin-top:8px;font-size:.72rem;color:var(--red-lt);font-weight:600;margin-bottom:6px">¿Eliminar esta alarma?</div>
               <div class="confirm-bar">
                 <button class="cbtn-no" onclick="cancelarEliminar('${a.id}')">Cancelar</button>
                 <button class="cbtn-yes" onclick="confirmarEliminar('${a.id}')">Sí, eliminar</button>
               </div>`;
      } else {
        del = `<button class="pdel" onclick="eliminarAlarma('${a.id}')">🗑 Eliminar Alarma</button>`;
      }
    }
    return `<div><div class="ph"><div class="pi ${c}">${ico}</div><div><div class="pt">${esc(a.nombre)}</div><div class="pid">${esc(a.id)}</div></div></div>
      <div class="pb">
        <div class="pr"><span class="pl">📍 Latitud</span><span class="pv mono">${a.lat.toFixed(4)}</span></div>
        <div class="pr"><span class="pl">📍 Longitud</span><span class="pv mono">${a.lng.toFixed(4)}</span></div>
        <div class="pr"><span class="pl">⛰ Altitud</span><span class="pv">${a.altitud} msnm</span></div>
        <div class="pr"><span class="pl">📊 Estado</span><span class="pbdg ${c}"><span class="d"></span>${lb}</span></div>
        ${ex}${del}
      </div></div>`;
  }

  // ═══ 4. FILTER LIST ═══
  function onStatClick(f) {
    if (curFilt === f) { curFilt = null; $filtSec.classList.remove('open'); document.querySelectorAll('.sc').forEach(c => c.classList.remove('sel')); return; }
    curFilt = f;
    document.querySelectorAll('.sc').forEach(c => c.classList.remove('sel'));
    document.querySelector(`.sc[data-f="${f}"]`)?.classList.add('sel');
    renderFilt(); $filtSec.classList.add('open');
  }
  function renderFilt() {
    if (!curFilt) return;
    const ls = Object.values(alarms).filter(a => curFilt === 'all' || a.status === curFilt);
    $filtList.innerHTML = ls.length ? ls.map(a => `<div class="fi" data-id="${a.id}"><div class="fi-dot ${a.status}"></div><div><div class="fi-name">${esc(a.nombre)}</div><div class="fi-loc">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)} · ${a.status === 'active' ? 'Activada' : (a.status === 'offline' ? 'Sin Conexión' : 'Segura')}</div></div></div>`).join('') : '<div style="padding:14px;text-align:center;color:var(--text3);font-size:.78rem">Sin alarmas en esta categoría</div>';
    $filtList.querySelectorAll('.fi').forEach(el => {
      el.addEventListener('click', () => { const a = alarms[el.dataset.id]; if (!a) return; map.flyTo([a.lat, a.lng], 10, { duration: 1 }); a.marker.openPopup(); if (window.innerWidth <= 900) g('sidebar').classList.remove('open'); });
    });
  }

  // ═══ 5. ADMIN (integrated form, NO prompt) ═══
  function doLogin() {
    const pwd = $authPwd.value;
    if (pwd === ADMIN_PWD) {
      admin = true;
      $authLogin.style.display = 'none';
      $authActive.style.display = 'block';
      $authPwd.value = '';
      $authMsg.textContent = '';
      $authMsg.className = 'auth-msg';
    } else {
      $authMsg.textContent = '✕ Contraseña incorrecta';
      $authMsg.className = 'auth-msg err';
      $authPwd.value = '';
      $authPwd.focus();
    }
  }

  function doLogout() {
    admin = false;
    $authActive.style.display = 'none';
    $authLogin.style.display = 'block';
    $authMsg.textContent = '';
    $authMsg.className = 'auth-msg';
  }

  // ═══ 6. ADD ALARM MODAL (no prompt) ═══
  function showAddModal(lat, lng) {
    document.querySelector('.modal-bg')?.remove();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal-box">
      <h3>📌 Añadir Nueva Alarma</h3>
      <label>Nombre</label><input type="text" id="m-name" placeholder="Ej: Alarma Sur Chiapas" autofocus />
      <label>Latitud</label><input type="text" id="m-lat" value="${lat.toFixed(6)}" readonly />
      <label>Longitud</label><input type="text" id="m-lng" value="${lng.toFixed(6)}" readonly />
      <label>Altitud (msnm)</label><input type="number" id="m-alt" placeholder="Ej: 850" />
      <div id="m-err" class="auth-msg"></div>
      <div class="modal-btns"><button class="mbno" id="m-no" type="button">Cancelar</button><button class="mbok" id="m-ok" type="button">Añadir</button></div>
    </div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
    g('m-no').onclick = () => bg.remove();
    g('m-ok').onclick = () => {
      const name = g('m-name').value.trim(), alt = parseInt(g('m-alt').value, 10);
      const err = g('m-err');
      if (!name) { err.textContent = '✕ Escribe un nombre'; err.className = 'auth-msg err'; return; }
      if (isNaN(alt)) { err.textContent = '✕ Escribe una altitud válida'; err.className = 'auth-msg err'; return; }
      const id = `AL-${String(nextId++).padStart(2, '0')}`;
      addAlarm({ id, nombre: name, lat, lng, altitud: alt });
      save(); updateStats(); renderFilt(); bg.remove();
      toast('✅', `Alarma <strong>${esc(id)}</strong> añadida`);
      map.flyTo([lat, lng], 8, { duration: .8 });
    };
  }

  // ═══ 7. MQTT ═══
  function connectMQTT() {
    setC('wait');
    try {
      mqttC = mqtt.connect(MQTT_CFG.url, MQTT_CFG.opts);
      mqttC.on('connect', () => { setC('ok'); mqttC.subscribe(MQTT_CFG.topic, { qos: 1 }); });
      mqttC.on('message', (_t, m) => { try { handleMsg(JSON.parse(m.toString())); } catch(_){} });
      mqttC.on('error', () => setC('err'));
      mqttC.on('close', () => setC('off'));
      mqttC.on('reconnect', () => setC('wait'));
    } catch(_) { setC('err'); }
  }
  function setC(s) {
    $cd.className = 'cd'; $ld.classList.remove('ok');
    if (s === 'ok') { $cd.classList.add('ok'); $ct.textContent = 'Conectado'; $ld.classList.add('ok'); }
    else if (s === 'err') { $cd.classList.add('err'); $ct.textContent = 'Error de conexión'; }
    else if (s === 'wait') { $ct.textContent = 'Conectando...'; }
    else { $ct.textContent = 'Desconectado'; }
  }

  // ═══ 8. ALARM HANDLER ═══
  function handleMsg(p) {
    const a = alarms[p.id_alarma]; if (!a) return;
    const wasOffline = a.status === 'offline';
    a.lastSeen = Date.now(); // reset keepalive timer
    
    if (p.evento === 'activado') {
      a.status = 'active'; a.ctrl = p.control_remoto; a.ts = p.timestamp;
      a.marker.setIcon(mkIco('active'));
      if (a.marker.isPopupOpen()) a.marker.getPopup().setContent(popHtml(a.id));
      addEv(a); playSound();
      toast('🚨', `<strong>${esc(a.id)}</strong> activada — ${esc(a.nombre)}`);
      map.flyTo([a.lat, a.lng], 7, { duration: 1.2 });
    } else if (p.evento === 'desactivado') {
      a.status = 'safe'; a.ctrl = null; a.ts = null;
      a.marker.setIcon(mkIco('safe'));
      if (a.marker.isPopupOpen()) a.marker.getPopup().setContent(popHtml(a.id));
    } else if (wasOffline || p.evento === 'keepalive') {
      // Restore to safe state if it was offline
      a.status = 'safe';
      a.marker.setIcon(mkIco('safe'));
      if (a.marker.isPopupOpen()) a.marker.getPopup().setContent(popHtml(a.id));
      toast('🔌', `Alarma <strong>${esc(a.id)}</strong> restablecida (en línea)`);
    }
    updateStats(); renderFilt();
  }

  // ═══ 9. EVENT HISTORY ═══
  function addEv(a) {
    $evl.querySelector('.empty')?.remove();
    const c = document.createElement('div'); c.className = 'ec alert';
    c.innerHTML = `<div class="ec-top"><span class="ec-id">${esc(a.id)}</span><span class="ec-badge">⚠ Activada</span></div>
      <div class="ec-d"><span class="el">Alarma:</span><span>${esc(a.nombre)}</span></div>
      <div class="ec-d"><span class="el">Coords:</span><span>${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</span></div>
      <div class="ec-d"><span class="el">Altitud:</span><span>${a.altitud} msnm</span></div>
      <div class="ec-d"><span class="el">Control:</span><span>${esc(a.ctrl || 'N/A')}</span></div>
      <div class="ec-t">🕐 ${fmtT(a.ts)}</div>`;
    c.style.cursor = 'pointer';
    c.addEventListener('click', () => { map.flyTo([a.lat, a.lng], 10, { duration: 1 }); a.marker.openPopup(); });
    $evl.prepend(c);
  }
  function clearHist() { $evl.innerHTML = '<div class="empty"><div class="ei">📡</div><p>Sin eventos registrados.<br>Los eventos aparecerán aquí en tiempo real.</p></div>'; }

  // ═══ 10. STATS (BUG FIX: always show real counts) ═══
  function updateStats() {
    const all = Object.values(alarms);
    const act = all.filter(a => a.status === 'active').length;
    const safe = all.filter(a => a.status === 'safe').length;
    const off = all.filter(a => a.status === 'offline').length;
    const $app = document.getElementById('app') || document.body;

    // Always show real counts — never force to 0
    $vt.textContent = all.length;
    $vs.textContent = safe;
    $va.textContent = act;
    $sca.classList.toggle('has', act > 0);

    // offline-mode class: only for visual dimming when NO active alarms
    // and at least one device is offline
    if (act === 0 && off > 0) {
      $app.classList.add('offline-mode');
    } else {
      $app.classList.remove('offline-mode');
    }
  }

  // ═══ 11. TOAST ═══
  function toast(ico, html) {
    let w = document.querySelector('.tw');
    if (!w) { w = document.createElement('div'); w.className = 'tw'; document.body.appendChild(w); }
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `<span class="ico">${ico}</span><span class="txt">${html}</span>`;
    w.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4500);
  }

  // ═══ 12. UTILS ═══
  function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function fmtT(ts) {
    if (!ts) return 'N/A';
    try { return new Date(ts).toLocaleString('es-MX', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true }); }
    catch { return ts; }
  }

  // ═══ 13. THEME TOGGLE ═══
  function applyTheme(theme) {
    currentTheme = theme;
    const html = document.documentElement;

    // Enable smooth transition
    html.setAttribute('data-theme-transition', '');

    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
      g('theme-btn').textContent = '☀️';
    } else {
      html.removeAttribute('data-theme');
      g('theme-btn').textContent = '🌙';
    }

    // Swap map tile layer
    if (map && tileLayer) {
      const newUrl = theme === 'light' ? TILE_LIGHT : TILE_DARK;
      tileLayer.setUrl(newUrl);
    }

    localStorage.setItem(THEME_STORE, theme);

    // Remove transition class after animation completes
    setTimeout(() => html.removeAttribute('data-theme-transition'), 400);
  }

  function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  // ═══ 14. BINDINGS ═══
  // Stats
  document.querySelectorAll('.sc').forEach(c => c.addEventListener('click', () => onStatClick(c.dataset.f)));

  // Options panel toggle — FIXED: stopPropagation to prevent conflicts
  g('opt-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    $optPanel.classList.toggle('open');
  });

  // Volume — live update + test beep on release
  g('vol-slider').addEventListener('input', e => { vol = e.target.value / 100; if (gainNode) gainNode.gain.value = vol * 0.3; });
  g('vol-slider').addEventListener('change', () => { playTestBeep(); });

  // Mute
  g('mute-btn').addEventListener('click', function() {
    muted = !muted;
    this.classList.toggle('on', muted);
    this.textContent = muted ? '🔇 Muted' : '🔊 Mute';
    if (muted) stopSound();
  });

  // Auth login (integrated, no prompt)
  g('auth-btn').addEventListener('click', doLogin);
  $authPwd.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  // Auth logout
  g('logout-btn').addEventListener('click', doLogout);

  // Clear history
  g('clear-btn').addEventListener('click', clearHist);

  // Sidebar toggle
  g('sb-tog').addEventListener('click', () => g('sidebar').classList.toggle('open'));

  // Theme toggle
  g('theme-btn').addEventListener('click', toggleTheme);

  // Close sidebar on map click (mobile)
  document.getElementById('map').addEventListener('click', () => { if (window.innerWidth <= 900) g('sidebar').classList.remove('open'); });

  // ═══ 15. INIT ═══
  // Apply saved theme BEFORE map init (so correct tiles load)
  applyTheme(currentTheme);
  initMap();
  connectMQTT();

  // Watchdog timer (every 2 seconds)
  function checkHeartbeats() {
    const now = Date.now();
    const TIMEOUT = 2 * 60 * 1000; // 2 minutes in ms
    let anyChanged = false;
    
    Object.values(alarms).forEach(a => {
      if (a.lastSeen) {
        const elapsed = now - a.lastSeen;
        if (elapsed > TIMEOUT && a.status !== 'offline') {
          a.status = 'offline';
          a.marker.setIcon(mkIco('offline'));
          if (a.marker.isPopupOpen()) {
            a.marker.getPopup().setContent(popHtml(a.id));
          }
          toast('🔌', `Alarma <strong>${esc(a.id)}</strong> fuera de línea (sin conexión)`);
          anyChanged = true;
        }
      }
    });
    
    if (anyChanged) {
      updateStats();
      renderFilt();
    }
  }
  
  setInterval(checkHeartbeats, 2000);

  window.__beetle = {
    alarms,
    simulateAlert(id, ctrl = 'Control_Test') { initAudio(); handleMsg({ id_alarma: id, evento: 'activado', control_remoto: ctrl, timestamp: new Date().toISOString() }); },
    simulateReset(id) { handleMsg({ id_alarma: id, evento: 'desactivado', control_remoto: null, timestamp: new Date().toISOString() }); },
    simulateKeepalive(id) { handleMsg({ id_alarma: id, evento: 'keepalive', control_remoto: null, timestamp: new Date().toISOString() }); },
  };

  console.log('%c[Beetle Monitor] 🪲 Inicializado con Monitoreo de Keepalive', 'color:#dc2626;font-weight:bold');
  console.log('%c[Tip] __beetle.simulateAlert("AL-01")', 'color:#707070');
})();
