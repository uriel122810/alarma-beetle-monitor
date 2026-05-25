// ============================================
// LOS REYES LA PAZ MONITOREO — app.js
// Sistema de Seguridad Vecinal e Inteligencia Territorial
// Producción: WebSockets Seguros (wss://)
// All UI is inline HTML/CSS — NO prompt/alert
// ============================================
(() => {
  'use strict';

  // Consola de errores visual en pantalla (para diagnosticar fallos en producción)
  window.addEventListener('error', (event) => {
    const dbg = document.getElementById('debug-err-console') || (() => {
      const d = document.createElement('div');
      d.id = 'debug-err-console';
      d.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:99999;background:rgba(220,38,38,0.95);color:white;padding:12px 18px;border-radius:8px;font-family:monospace;font-size:0.75rem;box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:300px;word-break:break-all;border:1px solid rgba(255,255,255,0.2);pointer-events:none;';
      document.body.appendChild(d);
      return d;
    })();
    dbg.innerHTML += `<div>⚠️ Error: ${event.message} (${event.filename.split('/').pop()}:${event.lineno})</div>`;
  });
  window.addEventListener('unhandledrejection', (event) => {
    const dbg = document.getElementById('debug-err-console') || (() => {
      const d = document.createElement('div');
      d.id = 'debug-err-console';
      d.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:99999;background:rgba(220,38,38,0.95);color:white;padding:12px 18px;border-radius:8px;font-family:monospace;font-size:0.75rem;box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:300px;word-break:break-all;border:1px solid rgba(255,255,255,0.2);pointer-events:none;';
      document.body.appendChild(d);
      return d;
    })();
    dbg.innerHTML += `<div>⚠️ Rejection: ${event.reason}</div>`;
  });

  // Fallback robusto por si Turf.js falla en cargar desde CDN
  if (typeof window.turf === 'undefined') {
    window.turf = {
      point(coords) {
        return { type: 'Feature', geometry: { type: 'Point', coordinates: coords } };
      },
      booleanPointInPolygon(pt, poly) {
        const [lng, lat] = pt.geometry.coordinates;
        const ring = poly.geometry.coordinates[0];
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        for (const coord of ring) {
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
        }
        return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
      }
    };
  }


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

  // Restricción Geográfica: Polígono simplificado de Los Reyes La Paz, Estado de México
  const LA_PAZ_GEOJSON = {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [-98.99456, 19.33306],
        [-98.89805, 19.33306],
        [-98.89805, 19.39445],
        [-98.99456, 19.39445],
        [-98.99456, 19.33306]
      ]]
    }
  };

  const ALARMAS_INICIALES = [
    { id: 'AL-01', nombre: 'Alarma Centro La Paz', lat: 19.3600, lng: -98.9500, altitud: 2260 },
    { id: 'AL-02', nombre: 'Alarma Los Reyes', lat: 19.3650, lng: -98.9800, altitud: 2250 },
    { id: 'AL-03', nombre: 'Alarma San Sebastián', lat: 19.3500, lng: -98.9300, altitud: 2270 },
    { id: 'AL-04', nombre: 'Alarma La Magdalena', lat: 19.3550, lng: -98.9600, altitud: 2240 },
  ];

  const ADMIN_PWD = 'admin mqtt';
  const STORE = 'beetleMonitor_v2';
  const PLAN_STORE = 'beetleMonitor_plan';
  const THEME_STORE = 'beetleMonitor_theme';
  const SETTINGS_STORE = 'beetleMonitor_settings';
  const HISTORY_STORE = 'beetleMonitor_history';
  const PANEL_STORE = 'beetleMonitor_panel';
  const MK = 32;

  // Tile layer URLs
  const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  // Safe Storage helper to prevent ReferenceError/SecurityError in private browsing or iframe environments
  const safeStorage = {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
  };

  // State
  const alarms = {};
  const confirmingDelete = new Set(); // tracks IDs pending delete confirmation
  let admin = false, mqttC = null, map = null, nextId = 5, curFilt = null;
  // Load saved settings if any
  let savedSettings = null;
  try { savedSettings = JSON.parse(safeStorage.getItem(SETTINGS_STORE)); } catch(_) {}
  let muted = savedSettings?.muted ?? false;
  let vol = savedSettings?.vol ?? 0.7;
  let audioCtx = null, oscNode = null, gainNode = null;
  let tileLayer = null; // current Leaflet tile layer
  let currentTheme = safeStorage.getItem(THEME_STORE) || 'light';

  // DOM helpers
  const g = (id) => document.getElementById(id);
  const $evl = g('ev-list'), $vt = g('vt'), $vs = g('vs'), $va = g('va'), $sca = g('sc-a');
  const $cd = g('cd'), $ct = g('ct'), $ld = g('ld');
  const $filtSec = g('filt-sec'), $filtList = g('filt-list');
  const $optPanel = g('opt-panel');
  const $authLogin = g('auth-login'), $authActive = g('auth-active');
  const $authPwd = g('auth-pwd'), $authMsg = g('auth-msg');
  const $planPanel = g('plan-panel'), $planTbody = g('plan-tbody'), $planEmpty = g('plan-empty');

  // ═══ 1. PERSISTENCE ═══
  function load() {
    const s = safeStorage.getItem(STORE);
    if (s) { try { const a = JSON.parse(s); if (Array.isArray(a) && a.length) { a.forEach(x => { const n = parseInt(x.id.replace('AL-',''),10); if (!isNaN(n) && n >= nextId) nextId = n+1; }); return a; } } catch(_){} }
    return [...ALARMAS_INICIALES];
  }
  function save() {
    safeStorage.setItem(STORE, JSON.stringify(Object.values(alarms).map(a => ({ id:a.id, nombre:a.nombre, lat:a.lat, lng:a.lng, altitud:a.altitud }))));
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
    // Center initially on La Paz, Zoom 13
    map = L.map('map', { center: [19.36, -98.95], zoom: 13 });
    const tileUrl = currentTheme === 'light' ? TILE_LIGHT : TILE_DARK;
    tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 22, maxNativeZoom: 19
    }).addTo(map);
    
    // Validate initial alarms against GeoJSON
    load().forEach(a => {
        if (turf.booleanPointInPolygon(turf.point([a.lng, a.lat]), LA_PAZ_GEOJSON)) addAlarm(a);
    });
    
    updateStats();
    loadHistory(); // Render persisted history
    
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
    alarms[d.id] = { ...d, status: 'safe', ctrl: null, ts: null, marker: m, lastSeen: null };
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
      el.addEventListener('click', () => { const a = alarms[el.dataset.id]; if (!a) return; map.flyTo([a.lat, a.lng], 20, { duration: 1 }); a.marker.openPopup(); if (window.innerWidth <= 900) g('sidebar').classList.remove('open'); });
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
      // Check municipal limits before adding
      if (!turf.booleanPointInPolygon(turf.point([lng, lat]), LA_PAZ_GEOJSON)) {
         err.textContent = '✕ Ubicación fuera del municipio de La Paz'; err.className = 'auth-msg err'; return;
      }
      const id = `AL-${String(nextId++).padStart(2, '0')}`;
      addAlarm({ id, nombre: name, lat, lng, altitud: alt });
      save(); updateStats(); renderFilt(); bg.remove();
      toast('✅', `Alarma <strong>${esc(id)}</strong> añadida`);
      map.flyTo([lat, lng], 20, { duration: .8 });
    };
  }

  // ═══ 7. MQTT ═══
  let connectionAttempts = 0;
  function connectMQTT() {
    setC('wait');
    const useFallback = connectionAttempts >= 2;
    const host = useFallback ? 'broker.hivemq.com' : MQTT_HOST;
    const port = useFallback ? 8884 : MQTT_PORT; 
    const protocol = 'wss'; // Always use secure websockets
    const url = `${protocol}://${host}:${port}/mqtt`;
    
    const opts = {
      ...MQTT_CFG.opts,
      protocol,
      port,
      username: useFallback ? undefined : MQTT_USER,
      password: useFallback ? undefined : MQTT_PASS,
    };
    
    try {
      if (mqttC) {
        try { mqttC.end(); } catch(_) {}
      }
      mqttC = mqtt.connect(url, opts);
      mqttC.on('connect', () => {
        connectionAttempts = 0;
        setC('ok');
        mqttC.subscribe(MQTT_CFG.topic, { qos: 1 });
      });
      mqttC.on('message', (_t, m) => { try { handleMsg(JSON.parse(m.toString())); } catch(_){} });
      mqttC.on('error', () => {
        handleConnFailure();
      });
      mqttC.on('close', () => {
        if (mqttC && !mqttC.connected) {
          handleConnFailure();
        } else {
          setC('off');
        }
      });
    } catch(_) {
      handleConnFailure();
    }
  }

  function handleConnFailure() {
    setC('err');
    connectionAttempts++;
    if (connectionAttempts === 2) {
      toast('⚠️', 'Conexión principal fallida. Probando broker alternativo público...');
      setTimeout(connectMQTT, 2000);
    }
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
    
    // Filter out if not in La Paz
    if (!turf.booleanPointInPolygon(turf.point([a.lng, a.lat]), LA_PAZ_GEOJSON)) return;

    const wasOffline = a.status === 'offline';
    a.lastSeen = Date.now(); // reset keepalive timer
    
    if (p.evento === 'activado') {
      a.status = 'active'; a.ctrl = p.control_remoto; a.ts = p.timestamp;
      a.marker.setIcon(mkIco('active'));
      if (a.marker.isPopupOpen()) a.marker.getPopup().setContent(popHtml(a.id));
      addEv(a); playSound();
      toast('🚨', `<strong>${esc(a.id)}</strong> activada — ${esc(a.nombre)}`);
      map.flyTo([a.lat, a.lng], 20, { duration: 1.2 });
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
  let eventsData = [];
  function saveHistory() { safeStorage.setItem(HISTORY_STORE, JSON.stringify(eventsData)); }
  function loadHistory() {
    try {
       const h = JSON.parse(safeStorage.getItem(HISTORY_STORE));
       if (Array.isArray(h)) {
           h.reverse().forEach(ev => renderEvDOM(ev));
           eventsData = h.reverse();
       }
    } catch(_) {}
  }
  function renderEvDOM(a) {
    $evl.querySelector('.empty')?.remove();
    const c = document.createElement('div'); c.className = 'ec alert';
    c.innerHTML = `<div class="ec-top"><span class="ec-id">${esc(a.id)}</span><span class="ec-badge">⚠ Activada</span></div>
      <div class="ec-d"><span class="el">Alarma:</span><span>${esc(a.nombre)}</span></div>
      <div class="ec-d"><span class="el">Coords:</span><span>${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</span></div>
      <div class="ec-d"><span class="el">Altitud:</span><span>${a.altitud} msnm</span></div>
      <div class="ec-d"><span class="el">Control:</span><span>${esc(a.ctrl || 'N/A')}</span></div>
      <div class="ec-t">🕐 ${fmtT(a.ts)}</div>`;
    c.style.cursor = 'pointer';
    c.addEventListener('click', () => { map.flyTo([a.lat, a.lng], 20, { duration: 1 }); alarms[a.id]?.marker?.openPopup(); });
    $evl.prepend(c);
  }
  function addEv(a) {
    const evObj = { id: a.id, nombre: a.nombre, lat: a.lat, lng: a.lng, altitud: a.altitud, ctrl: a.ctrl, ts: a.ts };
    eventsData.push(evObj);
    saveHistory();
    renderEvDOM(evObj);
  }
  function clearHist() { eventsData = []; saveHistory(); $evl.innerHTML = '<div class="empty"><div class="ei">📡</div><p>Sin eventos registrados.<br>Los eventos aparecerán aquí en tiempo real.</p></div>'; }

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

    safeStorage.setItem(THEME_STORE, theme);

    // Remove transition class after animation completes
    setTimeout(() => html.removeAttribute('data-theme-transition'), 400);
  }

  function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  // ═══════════════════════════════════════════════════════════════
  // 14. PLANIFICACIÓN URBANA DE SEGURIDAD — Nueva Funcionalidad
  // ═══════════════════════════════════════════════════════════════

  // Datos de ejemplo precargados
  const PLAN_DEFAULTS = [
    { zona: 'Col. Los Reyes', prioridad: 'Alta', fecha: '2026-06-15', estado: 'Pendiente' },
    { zona: 'Col. La Magdalena', prioridad: 'Media', fecha: '2026-07-01', estado: 'En Proceso' },
    { zona: 'Col. Techachaltitla', prioridad: 'Alta', fecha: '2026-06-20', estado: 'Pendiente' },
    { zona: 'Barrio San Sebastián', prioridad: 'Baja', fecha: '2026-08-10', estado: 'Pendiente' },
    { zona: 'Col. Ampliación La Paz', prioridad: 'Media', fecha: '2026-07-15', estado: 'Instalado' },
  ];

  // Load planning data from localStorage or defaults
  function loadPlan() {
    const s = safeStorage.getItem(PLAN_STORE);
    if (s) {
      try {
        const data = JSON.parse(s);
        if (Array.isArray(data)) return data;
      } catch (_) {}
    }
    return [...PLAN_DEFAULTS];
  }

  let planEntries = loadPlan();

  function savePlan() {
    safeStorage.setItem(PLAN_STORE, JSON.stringify(planEntries));
  }

  // Render the planning table
  function renderPlanTable() {
    if (planEntries.length === 0) {
      $planTbody.innerHTML = '';
      $planEmpty.style.display = 'flex';
      return;
    }
    $planEmpty.style.display = 'none';

    $planTbody.innerHTML = planEntries.map((e, idx) => {
      // Priority badge class
      const priClass = e.prioridad === 'Alta' ? 'alta' : (e.prioridad === 'Media' ? 'media' : 'baja');
      // Estado badge class
      let estClass = 'pendiente';
      if (e.estado === 'En Proceso') estClass = 'proceso';
      else if (e.estado === 'Instalado') estClass = 'instalado';

      // Format date for display
      let fechaDisplay = e.fecha;
      try {
        const d = new Date(e.fecha + 'T00:00:00');
        fechaDisplay = d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (_) {}

      return `<tr>
        <td><span class="plan-zona">${esc(e.zona)}</span></td>
        <td><span class="plan-pri ${priClass}"><span class="pri-dot"></span>${esc(e.prioridad)}</span></td>
        <td><span class="plan-fecha">${esc(fechaDisplay)}</span></td>
        <td><span class="plan-est ${estClass}"><span class="est-dot"></span>${esc(e.estado)}</span></td>
        <td><button class="plan-del" onclick="eliminarPlan(${idx})" title="Eliminar">✕</button></td>
      </tr>`;
    }).join('');
  }

  // Delete a planning entry
  window.eliminarPlan = function(idx) {
    if (idx >= 0 && idx < planEntries.length) {
      const removed = planEntries.splice(idx, 1)[0];
      savePlan();
      renderPlanTable();
      toast('📋', `Planificación <strong>${esc(removed.zona)}</strong> eliminada`);
    }
  };

  // Show modal to add a new planning entry
  function showAddPlanModal() {
    document.querySelector('.modal-bg')?.remove();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal-box">
      <h3>📋 Nueva Planificación de Alarma</h3>
      <div class="plan-modal-field">
        <label>Zona / Colonia</label>
        <input type="text" id="pm-zona" placeholder="Ej: Col. San Juan" autofocus />
      </div>
      <div class="plan-modal-field">
        <label>Prioridad</label>
        <select id="pm-pri">
          <option value="Alta">🔴 Alta</option>
          <option value="Media" selected>🟡 Media</option>
          <option value="Baja">🔵 Baja</option>
        </select>
      </div>
      <div class="plan-modal-field">
        <label>Fecha Programada de Instalación</label>
        <input type="date" id="pm-fecha" />
      </div>
      <div class="plan-modal-field">
        <label>Estado de Despliegue</label>
        <select id="pm-estado">
          <option value="Pendiente" selected>Pendiente</option>
          <option value="En Proceso">En Proceso</option>
          <option value="Instalado">Instalado</option>
        </select>
      </div>
      <div id="pm-err" class="auth-msg"></div>
      <div class="modal-btns">
        <button class="mbno" id="pm-no" type="button">Cancelar</button>
        <button class="mbok" id="pm-ok" type="button">Agregar</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    g('pm-fecha').value = today;

    g('pm-no').onclick = () => bg.remove();
    g('pm-ok').onclick = () => {
      const zona = g('pm-zona').value.trim();
      const pri = g('pm-pri').value;
      const fecha = g('pm-fecha').value;
      const estado = g('pm-estado').value;
      const err = g('pm-err');

      if (!zona) { err.textContent = '✕ Escribe el nombre de la zona o colonia'; err.className = 'auth-msg err'; return; }
      if (!fecha) { err.textContent = '✕ Selecciona una fecha programada'; err.className = 'auth-msg err'; return; }

      planEntries.push({ zona, prioridad: pri, fecha, estado });
      savePlan();
      renderPlanTable();
      bg.remove();
      toast('✅', `Planificación <strong>${esc(zona)}</strong> agregada`);
    };
  }

  // ═══ 15. BINDINGS ═══
  // Stats
  document.querySelectorAll('.sc').forEach(c => c.addEventListener('click', () => onStatClick(c.dataset.f)));

  // Options panel toggle — FIXED: stopPropagation to prevent conflicts
  g('opt-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    $optPanel.classList.toggle('open');
  });

  function saveSettings() {
    safeStorage.setItem(SETTINGS_STORE, JSON.stringify({ muted, vol }));
  }

  // Volume synchronization helper
  function updateVolume(newVolPercent) {
    vol = newVolPercent / 100;
    saveSettings();
    if (gainNode) gainNode.gain.value = vol * 0.3;

    // Sync admin slider
    const sAdmin = g('vol-slider');
    if (sAdmin) sAdmin.value = newVolPercent;

    // Sync audio panel slider
    const sAudio = g('vol-slider-audio');
    if (sAudio) sAudio.value = newVolPercent;

    // Sync volume display text
    const textAudio = g('vol-value-audio');
    if (textAudio) textAudio.textContent = `${newVolPercent}%`;
  }

  // Mute synchronization helper
  function updateMuteState(isMuted) {
    muted = isMuted;
    saveSettings();

    // Sync admin mute button
    const mAdmin = g('mute-btn');
    if (mAdmin) {
      mAdmin.classList.toggle('on', muted);
      mAdmin.textContent = muted ? '🔇 Muted' : '🔊 Mute';
    }

    // Sync audio panel mute button
    const mAudio = g('mute-btn-audio');
    if (mAudio) {
      mAudio.classList.toggle('on', muted);
      mAudio.textContent = muted ? '🔇 Muted' : '🔊 Mute';
    }

    // Sync bottom bar speaker button
    const btnSpeaker = g('btn-speaker');
    if (btnSpeaker) {
      btnSpeaker.textContent = muted ? '🔇' : '🔊';
    }

    if (muted) {
      stopSound();
    }
  }

  // Volume — live update + test beep on release
  g('vol-slider').addEventListener('input', e => updateVolume(e.target.value));
  g('vol-slider').addEventListener('change', () => { playTestBeep(); });

  g('vol-slider-audio')?.addEventListener('input', e => updateVolume(e.target.value));
  g('vol-slider-audio')?.addEventListener('change', () => { playTestBeep(); });

  // Mute
  g('mute-btn').addEventListener('click', () => updateMuteState(!muted));
  g('mute-btn-audio')?.addEventListener('click', () => updateMuteState(!muted));

  // Test beep inside audio panel
  g('test-beep-btn-audio')?.addEventListener('click', () => playTestBeep());

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

  // Planificación Urbana toggle
  g('plan-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    $planPanel.classList.toggle('open');
  });

  // Add new plan entry
  g('plan-add-btn').addEventListener('click', showAddPlanModal);

  // Close sidebar on map click (mobile)
  document.getElementById('map').addEventListener('click', () => { if (window.innerWidth <= 900) g('sidebar').classList.remove('open'); });



  // Watchdog timer (every 2 seconds)
  function checkHeartbeats() {
    const now = Date.now();
    const TIMEOUT = 2 * 60 * 1000; // 2 minutes in ms
    let anyChanged = false;
    
    Object.values(alarms).forEach(a => {
      if (a.lastSeen !== null) {
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

  // ═══════════════════════════════════════════════════════════════
  // 17. BOTTOM BAR — Digital Clock, Panel Toggles, Interactivity
  // ═══════════════════════════════════════════════════════════════

  // ── Digital Clock ──
  function updateBarClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const el = g('bar-clock');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  setInterval(updateBarClock, 1000);
  updateBarClock();

  // ── Panel Management ──
  const PANELS = ['panel-history', 'panel-admin', 'panel-support', 'panel-about', 'panel-audio'];
  const $overlay = g('panel-overlay');

  function openPanel(id) {
    // Close all panels first
    PANELS.forEach(p => g(p)?.classList.remove('active'));
    // Open requested panel
    const panel = g(id);
    if (panel) {
      panel.classList.add('active');
      $overlay.classList.add('active');
      safeStorage.setItem(PANEL_STORE, id);
    }
  }

  function closeAllPanels() {
    PANELS.forEach(p => g(p)?.classList.remove('active'));
    $overlay.classList.remove('active');
    safeStorage.setItem(PANEL_STORE, '');
  }

  function togglePanel(id) {
    const panel = g(id);
    if (panel?.classList.contains('active')) {
      closeAllPanels();
    } else {
      openPanel(id);
    }
  }

  // ── Bottom Bar Button Listeners ──
  g('btn-history')?.addEventListener('click', () => togglePanel('panel-history'));
  g('btn-admin')?.addEventListener('click', () => togglePanel('panel-admin'));
  g('btn-support')?.addEventListener('click', () => togglePanel('panel-support'));
  g('btn-about')?.addEventListener('click', () => togglePanel('panel-about'));

  // Speaker button — toggle audio panel
  g('btn-speaker')?.addEventListener('click', () => togglePanel('panel-audio'));

  // Overlay click closes all panels
  $overlay?.addEventListener('click', closeAllPanels);

  // Close buttons inside floating panels
  document.querySelectorAll('.fp-close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllPanels);
  });

  // ── Keyboard: Escape closes panels ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllPanels();
  });

  // ═══ 16. INIT ═══
  try {
    applyTheme(currentTheme);
  } catch (e) {
    console.error('Error applying initial theme:', e);
  }
  
  // Restore persisted settings to UI
  updateVolume(Math.round(vol * 100));
  updateMuteState(muted);

  if (typeof L !== 'undefined') {
    try {
      initMap();
    } catch (e) {
      console.error('Error initializing Leaflet map:', e);
    }
  } else {
    console.error('Leaflet library (L) is not defined.');
  }

  // Restore active panel if any
  const savedPanel = safeStorage.getItem(PANEL_STORE);
  if (savedPanel) openPanel(savedPanel);

  if (typeof mqtt !== 'undefined') {
    connectMQTT();
  } else {
    setC('err');
    console.error('MQTT library is not defined.');
  }

  try {
    renderPlanTable();
  } catch (e) {
    console.error('Error rendering urban safety plan table:', e);
  }

  console.log('%c[Los Reyes La Paz Monitoreo] 🏛 Sistema Inicializado', 'color:#8B1A2B;font-weight:bold');
  console.log('%c[Tip] __beetle.simulateAlert("AL-01")', 'color:#707070');
})();
