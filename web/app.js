/* ============================================================
   Klien terminal (protokol ttyd) — dioptimalkan untuk layar sentuh
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var wrap = $('#termwrap'), keys = $('#keys'), hint = $('#hint');
  var dot = $('#dot'), stat = $('#stat'), toastEl = $('#toast'), jump = $('#jump');

  if (typeof Terminal === 'undefined' || typeof FitAddon === 'undefined') {
    stat.textContent = 'gagal memuat xterm.js';
    return;
  }

  var SEQ = {
    esc: '\x1b', tab: '\t', btab: '\x1b[Z', bs: '\x7f',
    up: '\x1b[A', down: '\x1b[B', right: '\x1b[C', left: '\x1b[D',
    home: '\x1b[H', end: '\x1b[F', pgup: '\x1b[5~', pgdn: '\x1b[6~', del: '\x1b[3~',
    'c-a': '\x01', 'c-c': '\x03', 'c-d': '\x04', 'c-e': '\x05', 'c-k': '\x0b',
    'c-l': '\x0c', 'c-r': '\x12', 'c-u': '\x15', 'c-w': '\x17', 'c-z': '\x1a'
  };

  var FONT_KEY = 'touchterm.fontSize';
  var KEYBAR_KEY = 'touchterm.keybar';
  var fontSize = parseInt(localStorage.getItem(FONT_KEY) || '', 10) || 16;

  /* ================= terminal ================= */
  var term = new Terminal({
    fontSize: fontSize,
    fontFamily: '"DejaVu Sans Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: 1.15,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 8000,
    scrollSensitivity: 2,
    fastScrollSensitivity: 6,
    allowProposedApi: true,
    theme: {
      background: '#0f1218',
      foreground: '#e6edf3',
      cursor: '#4f9cf9',
      selectionBackground: '#2f4f73',
      black: '#1b1f26',
      brightBlack: '#5c6773'
    }
  });
  var fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open($('#term'));

  /* ================= kirim ke server (protokol ttyd) ================= */
  var ws = null, token = '', connected = false, attempts = 0;

  function raw(bytes) {
    if (ws && ws.readyState === 1) ws.send(bytes);
  }
  function sendCmd(prefix, text) {
    var enc = new TextEncoder().encode(text);
    var buf = new Uint8Array(enc.length + 1);
    buf[0] = prefix.charCodeAt(0);
    buf.set(enc, 1);
    raw(buf);
  }
  function send(text) { sendCmd('0', text); }
  function sendResize() {
    if (!term) return;
    sendCmd('1', JSON.stringify({ columns: term.cols, rows: term.rows }));
  }

  function status(text, state) {
    stat.textContent = text;
    dot.className = state || '';
  }

  /* mendukung TERM_BASE_PATH: halaman bisa disajikan di /t-xxxx, bukan hanya / */
  function basePath() {
    return location.pathname.replace(/\/+$/, '');
  }

  async function fetchToken() {
    try {
      var r = await fetch(basePath() + '/token', { cache: 'no-store' });
      if (r.ok) {
        var j = await r.json();
        token = j.token || '';
      }
    } catch (e) {
      token = '';
    }
  }

  function wsUrl() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + basePath() + '/ws' + location.search;
  }

  async function connect() {
    if (ws) {
      try { ws.onclose = null; ws.close(); } catch (e) {}
      ws = null;
    }
    status('menyambung…', 'wait');
    await fetchToken();
    try {
      ws = new WebSocket(wsUrl(), ['tty']);
    } catch (e) {
      status('URL tidak valid', '');
      return;
    }
    ws.binaryType = 'arraybuffer';

    ws.onopen = function () {
      connected = true;
      attempts = 0;
      status('tersambung', 'on');
      stat.classList.remove('live');
      var hello = JSON.stringify({ AuthToken: token, columns: term.cols, rows: term.rows });
      raw(new TextEncoder().encode(hello));
      fitNow();
    };

    ws.onmessage = function (ev) {
      var data = ev.data;
      if (typeof data === 'string') { term.write(data); return; }
      var b = new Uint8Array(data);
      if (!b.length) return;
      var c = String.fromCharCode(b[0]);
      if (c === '0') {
        term.write(b.subarray(1));
      } else if (c === '1') {
        document.title = new TextDecoder().decode(b.subarray(1));
      }
      /* '2' = preferensi dari server, diabaikan (UI ini punya setelan sendiri) */
    };

    ws.onclose = function (ev) {
      connected = false;
      stat.classList.add('live');
      if (ev && ev.code === 1008) {
        status('login gagal — muat ulang halaman', '');
        return;
      }
      status('terputus — ketuk di sini', '');
      if (attempts < 5 && document.visibilityState === 'visible') {
        attempts += 1;
        setTimeout(connect, 700 * attempts);
      }
    };

    ws.onerror = function () {
      status('gagal tersambung — ketuk di sini', '');
      stat.classList.add('live');
    };
  }

  stat.addEventListener('click', function () {
    if (!connected) { attempts = 0; connect(); }
  });

  /* ================= input & modifier ================= */
  var ctrl = false, alt = false;

  function syncMods() {
    var list = document.querySelectorAll('#keys .mod');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var on = (b.dataset.mod === 'ctrl' && ctrl) || (b.dataset.mod === 'alt' && alt);
      b.classList.toggle('on', on);
    }
  }

  term.onData(function (d) {
    var out = d;
    var code = d.length === 1 ? d.charCodeAt(0) : 0;
    var printable = code >= 32 && code < 127;

    if ((ctrl || alt) && printable) {
      if (ctrl) {
        var up = d.toUpperCase().charCodeAt(0);
        if (up >= 64 && up <= 95) out = String.fromCharCode(up - 64);
        else if (d === ' ') out = '\x00';
        else if (d === '?') out = '\x7f';
        ctrl = false;
      }
      if (alt) { out = '\x1b' + out; alt = false; }
      syncMods();
    }
    send(out);
  });

  term.onBinary(function (d) {
    var b = new Uint8Array(d.length + 1);
    b[0] = 48;
    for (var i = 0; i < d.length; i++) b[i + 1] = d.charCodeAt(i) & 0xff;
    raw(b);
  });

  term.onResize(function () { sendResize(); });

  /* ================= tombol bar ================= */
  keys.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest ? ev.target.closest('button') : null;
    if (!el) return;
    ev.preventDefault();

    if (el.dataset.mod) {
      if (el.dataset.mod === 'ctrl') { ctrl = !ctrl; if (ctrl) alt = false; }
      else { alt = !alt; if (alt) ctrl = false; }
      syncMods();
    } else if (el.dataset.seq !== undefined && SEQ[el.dataset.seq] !== undefined) {
      send(SEQ[el.dataset.seq]);
      ctrl = alt = false;
      syncMods();
    } else if (el.dataset.lit !== undefined) {
      send(el.dataset.lit);
      ctrl = alt = false;
      syncMods();
    }
    keepFocus();
  });

  /* ================= ukuran layar & keyboard ================= */
  var rafId = 0;
  function fitNow() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      try { fit.fit(); } catch (e) {}
      sendResize();
    });
  }

  function layout() {
    var vv = window.visualViewport;
    var h = vv ? vv.height : window.innerHeight;
    var top = vv ? vv.offsetTop : 0;
    document.getElementById('app').style.height = Math.round(h) + 'px';
    document.getElementById('app').style.top = Math.round(top) + 'px';
    fitNow();
  }

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 150); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', layout);
    window.visualViewport.addEventListener('scroll', layout);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      layout();
      if (!connected) { attempts = 0; connect(); }
    }
  });
  window.addEventListener('online', function () {
    if (!connected) { attempts = 0; connect(); }
  });

  /* ================= fokus ================= */
  var touched = false;
  function keepFocus() {
    try { term.focus(); } catch (e) {}
  }
  function hideHint() { touched = true; hint.style.opacity = '0'; }
  wrap.addEventListener('click', function () { hideHint(); keepFocus(); });
  if (term.textarea) term.textarea.addEventListener('focus', hideHint);
  setTimeout(function () { if (!touched) hint.style.opacity = '0'; }, 8000);

  /* cegah menu konteks / zoom bawaan saat menekan lama di terminal */
  wrap.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ================= gulir: tombol "ke bawah" ================= */
  function updateJump() {
    var b = term.buffer.active;
    jump.classList.toggle('show', b.viewportY < b.baseY - 1);
  }
  term.onScroll(updateJump);
  if (term.onRender) term.onRender(updateJump);
  jump.addEventListener('click', function (e) {
    e.preventDefault();
    term.scrollToBottom();
    updateJump();
    keepFocus();
  });

  /* ================= ukuran font ================= */
  function applyFont(px, withToast) {
    fontSize = Math.max(10, Math.min(30, Math.round(px)));
    term.options.fontSize = fontSize;
    try { localStorage.setItem(FONT_KEY, String(fontSize)); } catch (e) {}
    fitNow();
    if (withToast) toast('Font ' + fontSize + 'px');
  }
  $('#btn-fplus').addEventListener('click', function () { applyFont(fontSize + 1, true); keepFocus(); });
  $('#btn-fminus').addEventListener('click', function () { applyFont(fontSize - 1, true); keepFocus(); });

  /* cubit dua jari = ubah ukuran font */
  var pinch = null;
  function touchDist(t) {
    var dx = t[0].clientX - t[1].clientX;
    var dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }
  wrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) pinch = { d: touchDist(e.touches), f: fontSize };
  }, { passive: true });
  wrap.addEventListener('touchmove', function (e) {
    if (!pinch || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    var target = Math.max(10, Math.min(30, Math.round(pinch.f * (touchDist(e.touches) / pinch.d))));
    if (target !== fontSize) {
      fontSize = target;
      term.options.fontSize = target;
    }
  }, { passive: false });
  wrap.addEventListener('touchend', function () {
    if (!pinch) return;
    pinch = null;
    applyFont(fontSize, true);
  }, { passive: true });

  /* ================= tempel & salin ================= */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.classList.remove('show'); }, 1500);
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function screenText() {
    var b = term.buffer.active;
    var out = [];
    var end = Math.min(b.length, b.baseY + term.rows);
    for (var i = b.baseY; i < end; i++) {
      var ln = b.getLine(i);
      if (ln) out.push(ln.translateToString(true));
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  }

  $('#btn-copy').addEventListener('click', async function () {
    var sel = term.getSelection();
    var text = sel || screenText();
    if (!text) { toast('Tidak ada teks'); return; }
    var ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      ok = legacyCopy(text);
    }
    toast(ok ? (sel ? 'Seleksi disalin' : 'Teks layar disalin') : 'Gagal menyalin');
    if (sel) term.clearSelection();
    keepFocus();
  });

  $('#btn-paste').addEventListener('click', async function () {
    var text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      text = window.prompt('Tempel teks lalu tekan OK:') || '';
    }
    if (!text) return;
    send(text.replace(/\r\n/g, '\n').replace(/\n/g, '\r'));
    keepFocus();
    toast('Ditempel');
  });

  /* ================= sembunyikan bar tombol ================= */
  function setKeybar(visible) {
    keys.style.display = visible ? '' : 'none';
    $('#btn-keys').classList.toggle('on', !visible);
    try { localStorage.setItem(KEYBAR_KEY, visible ? '1' : '0'); } catch (e) {}
    layout();
  }
  $('#btn-keys').addEventListener('click', function () {
    setKeybar(keys.style.display === 'none');
    keepFocus();
  });
  if (localStorage.getItem(KEYBAR_KEY) === '0') setKeybar(false);

  /* ================= mulai ================= */
  layout();
  setTimeout(layout, 300);
  setTimeout(layout, 1200);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  updateJump();
  connect();
})();
