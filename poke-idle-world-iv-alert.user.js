// ==UserScript==
// @name         Poke Idle World - Alerta IV Alto
// @namespace    https://github.com/es6te/
// @version      1.3
// @description  Avisa con sonido cuando CAPTURAS IV >= umbral (ignora vistos/escapados)
// @author       azteca1223
// @match        https://poke.idleworld.online/*
// @grant        Notification
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-iv-alert.user.js
// @updateURL    https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-iv-alert.user.js
// ==/UserScript==

(function() {
    'use strict';
    let UMBRAL = parseInt(localStorage.getItem('piw_iv_umbral') || '160', 10) || 160;
    let SONIDO_ON = true;
    let SOLO_CAPTURAS = localStorage.getItem('piw_iv_solo') !== '0'; // default true
    const yaAvisados = new Set();

    function crearPanel() {
        if (!document.body) { setTimeout(crearPanel, 500); return; }
        if (document.getElementById('piw-iv-panel')) return;
        const d = document.createElement('div');
        d.id = 'piw-iv-panel';
        d.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999999;background:#111;color:#fff;padding:8px 10px;border:2px solid gold;border-radius:10px;font-family:sans-serif;font-size:12px;pointer-events:auto;';
        d.innerHTML = '<b style="color:gold">⚡ IV Alert PIW</b><br>Umbral (0-186): <input id="piw-umbral" type="number" min="0" max="186" step="1" value="' + UMBRAL + '" style="width:65px;background:#222;color:#fff;border:1px solid #555;pointer-events:auto;user-select:text;"> <label><input id="piw-sonido" type="checkbox" checked> sonido</label><br><label title="Si se desmarca, avisa tambien al ver salvajes/escapados"><input id="piw-solo" type="checkbox"' + (SOLO_CAPTURAS ? ' checked' : '') + '> solo capturas</label><br><button id="piw-test" style="margin-top:4px">Probar sonido</button><div id="piw-status" style="margin-top:4px;color:#8f8"></div>';
        document.body.appendChild(d);
        const inp = document.getElementById('piw-umbral');
        // Evita que la pagina capture tus teclas/clicks dentro del panel
        ['click','mousedown','mouseup','keydown','keyup','keypress','input','change','focus'].forEach(ev =>
            inp.addEventListener(ev, e => e.stopPropagation(), true)
        );
        ['click','mousedown'].forEach(ev =>
            d.addEventListener(ev, e => e.stopPropagation(), false)
        );
        const guardar = () => {
            const raw = inp.value.trim();
            if (raw === '') return; // deja borrar para escribir nuevo numero
            let v = parseInt(raw, 10);
            if (isNaN(v)) return;
            v = Math.max(0, Math.min(186, v));
            UMBRAL = v;
            localStorage.setItem('piw_iv_umbral', String(v));
            const st = document.getElementById('piw-status');
            if (st) st.textContent = 'Umbral: ' + v;
        };
        inp.addEventListener('input', guardar);
        inp.addEventListener('change', guardar);
        document.getElementById('piw-sonido').onchange = e => { SONIDO_ON = e.target.checked; };
        document.getElementById('piw-solo').onchange = e => { SOLO_CAPTURAS = e.target.checked; localStorage.setItem('piw_iv_solo', SOLO_CAPTURAS ? '1' : '0'); };
        document.getElementById('piw-test').onclick = (e) => { e.stopPropagation(); asegurarAudio(); sonar(true); };
    }

    let ctx = null;
    function asegurarAudio() {
        try {
            if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
        } catch(e){}
    }
    document.addEventListener('click', asegurarAudio, false);

    function sonar(forzado = false) {
        if (!SONIDO_ON && !forzado) return;
        try {
            asegurarAudio();
            if (!ctx) return;
            [880, 1174, 1568].forEach((f, i) => {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.frequency.value = f; o.type = 'sine';
                const t = ctx.currentTime + i * 0.18;
                g.gain.setValueAtTime(0.3, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
                o.start(t); o.stop(t + 0.17);
            });
        } catch(e){}
    }

    function status(t) {
        const st = document.getElementById('piw-status');
        if (st) st.textContent = t;
    }

    function avisar(poke, total, origen) {
        const key = poke + '|' + total + '|' + (origen || '');
        if (yaAvisados.has(key)) return;
        yaAvisados.add(key);
        sonar();
        if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'default') Notification.requestPermission();
            if (Notification.permission === 'granted') {
                try { new Notification('CAPTURA IV ALTA: ' + poke + ' (' + total + ')', { body: 'IV total ' + total + ' >= ' + UMBRAL }); } catch(e){}
            }
        }
        const b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:15%;left:50%;transform:translateX(-50%);z-index:1000000;background:linear-gradient(180deg,#ffdf00,#ff8c00);color:#000;font-size:22px;font-weight:bold;padding:16px 28px;border:4px solid #fff;border-radius:16px;box-shadow:0 0 30px gold;text-align:center;';
        b.textContent = '🎉 CAPTURA IV BUENA 🎉 ' + poke + ' — IV: ' + total;
        b.onclick = () => b.remove();
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 8000);
        status('Ultima captura: ' + poke + ' ' + total + ' (umbral ' + UMBRAL + ')');
    }

    // Solo consideramos "captura" si el texto cercano indica exito.
    // Asi ignoramos salvajes vistos, escapes y huidas.
    const RE_CAPTURA = /(captur|atrap|caught|captured|you got|you caught|congrat|felicidades|obtuv|conseguido|adicionado|pego|successfully caught)/i;
    const RE_ESCAPE = /(escap|fled|flee|ran away|huy[oó]|fallaste|failed|broke free|se solt)/i;

    function contextoTexto(el) {
        let node = el, txt = '';
        try {
            for (let i = 0; i < 5 && node; i++) {
                const t = (node.innerText || '').slice(0, 2000);
                txt += '\n' + t;
                if (RE_CAPTURA.test(t)) return { captura: true, texto: txt };
                node = node.parentElement;
            }
        } catch(e){}
        return { captura: false, texto: txt };
    }

    function extraerIVTotal(texto) {
        if (!texto || !/iv/i.test(texto)) return null;
        let m = texto.match(/IV[^0-9]{0,10}(\d{2,3})/i);
        if (m) {
            const v = parseInt(m[1], 10);
            if (v >= 0 && v <= 186) return { total: v };
        }
        m = texto.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
        if (m) {
            const vals = m.slice(1).map(Number);
            if (vals.every(v => v >= 0 && v <= 31)) {
                return { total: vals.reduce((a,b)=>a+b,0) };
            }
        }
        return null;
    }

    function esPanel(el) {
        try { return !!(el.closest && el.closest('#piw-iv-panel')); } catch(e){ return false; }
    }

    function nombreCercano(el) {
        const root = el.closest('div') || document.body;
        const t = (root.innerText || '').slice(0, 200);
        const m = t.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
        return m ? m[1] : 'Pokemon';
    }

    function chequearNodo(el) {
        if (!el || !el.innerText) return;
        if (esPanel(el)) return;
        if (el.innerText.length > 2000) return;
        const r = extraerIVTotal(el.innerText);
        if (!r || r.total < UMBRAL) return;
        const poke = nombreCercano(el);
        if (!SOLO_CAPTURAS) { avisar(poke, r.total, 'ver'); return; }
        const ctx = contextoTexto(el);
        if (RE_ESCAPE.test(el.innerText) && !RE_CAPTURA.test(el.innerText)) {
            status('Visto (no captura): ' + poke + ' ' + r.total + ' — escapó/huida');
            return;
        }
        if (ctx.captura) avisar(poke, r.total, 'dom');
        else status('Visto (no captura): ' + poke + ' ' + r.total + ' — esperando mensaje de captura');
    }

    const obs = new MutationObserver(muts => {
        for (const mu of muts) {
            for (const n of mu.addedNodes) {
                if (n.nodeType === 1 && !esPanel(n)) chequearNodo(n);
            }
            if (mu.target.nodeType === 1 && !esPanel(mu.target)) chequearNodo(mu.target);
        }
    });

    function revisarJSON(obj, url) {
        try {
            const s = JSON.stringify(obj);
            if (!/iv/i.test(s)) return;
            const m = s.match(/"(total_?iv|iv_?total|ivSum)"\s*:\s*(\d{2,3})/i);
            let total = m ? parseInt(m[2], 10) : null;
            if (total == null) {
                const m2 = s.match(/"ivs?"\s*:\s*(\[[^\]]+\]|\{[^}]+\})/i);
                if (m2) {
                    const nums = m2[1].match(/\d+/g)?.map(Number) || [];
                    if (nums.length >= 6) total = nums.slice(0,6).reduce((a,b)=>a+b,0);
                }
            }
            if (total == null || total < UMBRAL) return;
            const n = s.match(/"(name|pokemon|species|nickname)"\s*:\s*"([^"]+)"/i);
            const poke = n ? n[2] : 'Pokemon';
            if (!SOLO_CAPTURAS) { avisar(poke, total, 'json'); return; }
            const u = String(url || '').toLowerCase();
            const urlEsCaptura = /(captur|catch)/i.test(u);
            const jsonDiceExito = /"(success|caught|captured|iscaught|result|status)"\s*:\s*(true|"success"|"caught"|"captured"|"ok")/i.test(s)
                || /(successfully caught|you caught|capturad|atrapad)/i.test(s);
            const jsonDiceFallo = /"(success|caught|captured)"\s*:\s*false/i.test(s) || /(fled|escaped|broke free|escap)/i.test(s);
            if (jsonDiceFallo && !jsonDiceExito) {
                status('Visto (no captura): ' + poke + ' ' + total + ' — JSON sin éxito');
                return;
            }
            if (urlEsCaptura || jsonDiceExito) avisar(poke, total, 'json-captura');
            else status('Visto (no captura): ' + poke + ' ' + total + ' — JSON sin confirmar captura (' + u.slice(0,60) + ')');
        } catch(e){}
    }
    const origFetch = window.fetch;
    window.fetch = async function(...a) {
        let url = '';
        try { url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || ''; } catch(e){}
        const r = await origFetch.apply(this, a);
        try { r.clone().json().then(j => revisarJSON(j, url)).catch(()=>{}); } catch(e){}
        return r;
    };
    // Algunos juegos usan XHR en vez de fetch
    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(m, u, ...rest) { this._piw_url = u; return origOpen.call(this, m, u, ...rest); };
        XMLHttpRequest.prototype.send = function(...rest) {
            this.addEventListener('load', function() {
                try {
                    const t = this.responseText;
                    if (t && /iv/i.test(t.slice(0, 5000))) revisarJSON(JSON.parse(t), this._piw_url);
                } catch(e){}
            });
            return origSend.apply(this, rest);
        };
    } catch(e){}

    setInterval(() => {
        document.querySelectorAll('div, span, p').forEach(el => {
            if (el.closest && el.closest('#piw-iv-panel')) return;
            if (/iv/i.test(el.childNodes[0]?.textContent || '')) chequearNodo(el);
        });
    }, 2000);

    function init() {
        crearPanel();
        obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
