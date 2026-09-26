// ==UserScript==
// @name         Poke Idle World - Alerta IV Alto
// @namespace    https://github.com/es6te/
// @version      1.6
// @description  Solo MIS capturas: nombre + IV/192 + rareza con multi EXACTO
// @author       azteca1223
// @match        https://poke.idleworld.online/*
// @grant        Notification
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-iv-alert.user.js
// @updateURL    https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-iv-alert.user.js
// ==/UserScript==

(function() {
    'use strict';
    const IV_MAX = 192;
    // Ajusta aqui los multis de cada rareza si el juego los cambia
    const MULT_RAREZA = { 'comun': 'x1.0', 'comun ': '', 'uncommon': 'x1.2', 'poco comun': 'x1.2', 'rare': 'x1.4', 'raro': 'x1.4', 'epic': 'x1.6', 'epico': 'x1.6', 'legendary': 'x1.8', 'legendario': 'x1.8', 'mythic': 'x2.0', 'mitico': 'x2.0', 'shiny': 'x2.0', 'brillante': 'x2.0', 'variocolor': 'x2.0' };
    let UMBRAL = parseInt(localStorage.getItem('piw_iv_umbral') || '160', 10) || 160;
    let SONIDO_ON = true;
    let MI_NOMBRE = (localStorage.getItem('piw_iv_nombre') || '').trim();
    const yaAvisados = new Set();

    function crearPanel() {
        if (!document.body) { setTimeout(crearPanel, 500); return; }
        if (document.getElementById('piw-iv-panel')) return;
        const d = document.createElement('div');
        d.id = 'piw-iv-panel';
        d.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999999;background:#111;color:#fff;padding:8px 10px;border:2px solid gold;border-radius:10px;font-family:sans-serif;font-size:12px;pointer-events:auto;';
        d.innerHTML = '<b style="color:gold">⚡ IV Alert PIW</b><br>Umbral (0-192): <input id="piw-umbral" type="number" min="0" max="192" step="1" value="' + UMBRAL + '" style="width:65px;background:#222;color:#fff;border:1px solid #555;pointer-events:auto;user-select:text;"> <label><input id="piw-sonido" type="checkbox" checked> sonido</label><br>Mi entrenador: <input id="piw-nombre" type="text" placeholder="opcional" value="' + MI_NOMBRE.replace(/"/g,'&quot;') + '" style="width:90px;background:#222;color:#fff;border:1px solid #555;"><br><button id="piw-test" style="margin-top:4px">Probar sonido</button><div id="piw-status" style="margin-top:4px;color:#8f8"></div>';
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
            v = Math.max(0, Math.min(192, v));
            UMBRAL = v;
            localStorage.setItem('piw_iv_umbral', String(v));
            const st = document.getElementById('piw-status');
            if (st) st.textContent = 'Umbral: ' + v;
        };
        inp.addEventListener('input', guardar);
        inp.addEventListener('change', guardar);
        document.getElementById('piw-sonido').onchange = e => { SONIDO_ON = e.target.checked; };
        const inpNom = document.getElementById('piw-nombre');
        ['click','mousedown','keydown','keyup','keypress','input','focus'].forEach(ev =>
            inpNom.addEventListener(ev, e => e.stopPropagation(), true)
        );
        const guardarNom = () => { MI_NOMBRE = inpNom.value.trim(); localStorage.setItem('piw_iv_nombre', MI_NOMBRE); };
        inpNom.addEventListener('input', guardarNom);
        inpNom.addEventListener('change', guardarNom);
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

    function avisar(poke, total, extra) {
        extra = extra || {};
        const key = poke + '|' + total + '|' + (extra.ivs || '') + '|' + (extra.calidad || '');
        if (yaAvisados.has(key)) return;
        yaAvisados.add(key);
        sonar();
        const pct = Math.round(total / IV_MAX * 100);
        const linea = poke + ' — IV: ' + total + '/' + IV_MAX + ' (' + pct + '%)'
            + (extra.calidad ? ' | ' + extra.calidad : '')
            + (extra.ivs ? ' | ' + extra.ivs : '');
        if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'default') Notification.requestPermission();
            if (Notification.permission === 'granted') {
                try { new Notification('CAPTURA: ' + poke + ' (' + total + ')', { body: linea }); } catch(e){}
            }
        }
        const b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:15%;left:50%;transform:translateX(-50%);z-index:1000000;background:linear-gradient(180deg,#ffdf00,#ff8c00);color:#000;font-size:22px;font-weight:bold;padding:16px 28px;border:4px solid #fff;border-radius:16px;box-shadow:0 0 30px gold;text-align:center;';
        b.textContent = '🎉 CAPTURA 🎉 ' + linea;
        b.onclick = () => b.remove();
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 9000);
        status(linea);
    }

    // SOLO mis capturas: exige 1ra persona (you/tu/yo/mi) y excluye feed global/chat de otros.
    const RE_CAPTURA = /(you caught|you got|capturaste|atrapaste|lo captur|la captur|mi pokemon|tu captura|voce capturou|successfully caught)/i;
    const RE_MIA = /\b(you|your|yo|mi\b|mis|t[úu]|tu\b|contigo|voce|você|meu|minha)\b/i;
    const RE_FEED = /(global|world feed|recent captures|ultimas capturas|chat geral|chat global|ranking|leaderboard|\%s caught|ha capturado un)/i;

    function enZonaAjena(el) {
        try {
            const z = el.closest && el.closest('[id*=chat],[class*=chat],[id*=feed],[class*=feed],[id*=global],[class*=global],[id*=ranking],[class*=ranking],[id*=leaderboard],[class*=leaderboard],[id*=world],[class*=world-feed]');
            return !!z;
        } catch(e){ return false; }
    }

    function contextoTexto(el) {
        let node = el, txt = '';
        try {
            for (let i = 0; i < 5 && node; i++) {
                const t = (node.innerText || '').slice(0, 2000);
                txt += '\n' + t;
                node = node.parentElement;
            }
        } catch(e){}
        return txt;
    }

    function esMiCaptura(el, textoCompleto) {
        if (enZonaAjena(el)) return false;
        if (RE_FEED.test(textoCompleto)) return false;
        if (!RE_CAPTURA.test(textoCompleto)) return false;
        if (MI_NOMBRE && textoCompleto.toLowerCase().includes(MI_NOMBRE.toLowerCase())) return true;
        // Sin nombre configurado: exige marca de 1ra persona para no tragar capturas de otros
        if (RE_MIA.test(textoCompleto)) return true;
        // Si el texto dice "X ha capturado" con otro nombre y no hay marca mia, es ajeno
        return false;
    }

    function extraerIVTotal(texto) {
        if (!texto || !/iv/i.test(texto)) return null;
        let m = texto.match(/IV[^0-9]{0,10}(\d{2,3})/i);
        if (m) {
            const v = parseInt(m[1], 10);
            if (v >= 0 && v <= IV_MAX) return { total: v, ivs: extraerIVs(texto) };
        }
        m = texto.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
        if (m) {
            const vals = m.slice(1).map(Number);
            if (vals.every(v => v >= 0 && v <= 31)) {
                return { total: vals.reduce((a,b)=>a+b,0), ivs: vals.join('/') };
            }
        }
        return null;
    }

    function extraerIVs(texto) {
        const m = texto.match(/(\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2})/);
        return m ? m[1].replace(/\s/g,'') : '';
    }

    function multDe(texto) {
        if (!texto) return '';
        // acepta 1.4x, 1,4x, x1.4, Mult 1.62x, (1.62x)
        let m = texto.match(/x\s*(\d+[.,]\d+)/i) || texto.match(/(\d+[.,]\d+)\s*x/i);
        if (!m) return '';
        return 'x' + m[1].replace(',', '.');
    }

    function extraerCalidad(texto) {
        if (!texto) return '';
        const exacto = multDe(texto); // multi REAL de ese pokemon, manda sobre la tabla
        let m = texto.match(/(calidad|quality|tier|rarity|rareza)\s*[:\-]?\s*([A-Za-z+\- ]{2,20})/i);
        if (m) {
            const rare = m[2].trim().slice(0, 20);
            const tabla = MULT_RAREZA[rare.toLowerCase()] || '';
            const mult = exacto || tabla;
            return 'Rareza: ' + rare + (mult ? ' ' + mult : '');
        }
        m = texto.match(/\b(Common|Uncommon|Rare|Epic|Legendary|Mythic|Shiny|Perfect|Outstanding|Amazing|Com[uú]n|Poco com[uú]n|Raro|Épico|Epico|Legendario|M[ií]tico|Brillante|Variocolor)\b/i);
        if (m) {
            const rare = m[1];
            const tabla = MULT_RAREZA[rare.toLowerCase()] || '';
            const mult = exacto || tabla;
            return 'Rareza: ' + rare + (mult ? ' ' + mult : '');
        }
        if (exacto) return 'Rareza: ' + exacto;
        return '';
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
        const full = contextoTexto(el);
        if (!esMiCaptura(el, full + '\n' + el.innerText)) return; // silencioso: nada de "visto no captura"
        const poke = nombreCercano(el);
        avisar(poke, r.total, { ivs: r.ivs || extraerIVs(full), calidad: extraerCalidad(full + ' ' + el.innerText) });
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
            let ivs = '';
            if (total == null) {
                const m2 = s.match(/"ivs?"\s*:\s*(\[[^\]]+\]|\{[^}]+\})/i);
                if (m2) {
                    const nums = m2[1].match(/\d+/g)?.map(Number) || [];
                    if (nums.length >= 6) { total = nums.slice(0,6).reduce((a,b)=>a+b,0); ivs = nums.slice(0,6).join('/'); }
                }
            }
            if (total == null || total < UMBRAL) return;
            // Solo captura propia con exito: exige URL de catch o flag de exito, y si hay owner/trainer debe ser mio
            const u = String(url || '').toLowerCase();
            const urlEsCaptura = /(captur|catch)/i.test(u);
            const jsonDiceExito = /"(success|caught|captured|iscaught|result|status)"\s*:\s*(true|"success"|"caught"|"captured"|"ok")/i.test(s)
                || /(successfully caught|you caught|capturaste|atrapaste)/i.test(s);
            if (!urlEsCaptura && !jsonDiceExito) return; // silencioso
            if (MI_NOMBRE) {
                const low = s.toLowerCase();
                const mOwner = s.match(/"(owner|trainer|username|player|caught_by|caughtBy)"\s*:\s*"([^"]+)"/i);
                if (mOwner && !mOwner[2].toLowerCase().includes(MI_NOMBRE.toLowerCase()) && !low.includes(MI_NOMBRE.toLowerCase())) return;
            }
            const n = s.match(/"(name|pokemon|species|nickname)"\s*:\s*"([^"]+)"/i);
            const poke = n ? n[2] : 'Pokemon';
            const q = s.match(/"(quality|rarity|tier|rareza)"\s*:\s*"([^"]+)"/i);
            const multJ = s.match(/"(mult|multiplier|x|mult_x|rate)"\s*:\s*"?(\d+[.,]\d+)"?/i);
            let calidadJ = '';
            const exactoJ = multJ ? 'x' + multJ[2].replace(',', '.') : '';
            if (q) {
                calidadJ = 'Rareza: ' + q[2] + (exactoJ ? ' ' + exactoJ : '');
            } else if (exactoJ) calidadJ = 'Rareza: ' + exactoJ;
            avisar(poke, total, { ivs: ivs, calidad: calidadJ });
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
