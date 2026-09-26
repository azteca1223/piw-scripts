// ==UserScript==
// @name         Poke Idle World - Alerta Venta Mercado
// @namespace    https://github.com/azteca1223/
// @version      1.0
// @description  Avisa con sonido cuando vendes algo en el mercado (item/pokemon)
// @author       azteca1223
// @match        https://poke.idleworld.online/*
// @grant        Notification
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-market-sold-alert.user.js
// @updateURL    https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-market-sold-alert.user.js
// ==/UserScript==

(function() {
    'use strict';
    let SONIDO_ON = true;
    let DEBUG = true;
    const yaAvisados = new Set();

    function log(t) {
        const el = document.getElementById('piw-mkt-log');
        if (!el) return;
        const d = document.createElement('div');
        d.textContent = new Date().toLocaleTimeString() + ' ' + t;
        d.style.cssText = 'border-bottom:1px solid #333;padding:2px 0;';
        el.prepend(d);
        while (el.children.length > 20) el.lastChild.remove();
        const st = document.getElementById('piw-mkt-status');
        if (st) st.textContent = t;
    }

    function crearPanel() {
        if (!document.body) { setTimeout(crearPanel, 500); return; }
        if (document.getElementById('piw-mkt-panel')) return;
        const d = document.createElement('div');
        d.id = 'piw-mkt-panel';
        d.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:999999;background:#111;color:#fff;padding:8px 10px;border:2px solid #0af;border-radius:10px;font-family:sans-serif;font-size:12px;max-width:320px;pointer-events:auto;';
        d.innerHTML = '<b style="color:#0af">💰 Market Sold Alert</b> <label><input id="piw-mkt-sonido" type="checkbox" checked> sonido</label> <label><input id="piw-mkt-debug" type="checkbox" checked> debug</label><br><button id="piw-mkt-test" style="margin-top:4px">Probar sonido</button><div id="piw-mkt-status" style="margin-top:4px;color:#8f8">Esperando ventas...</div><div id="piw-mkt-log" style="margin-top:4px;max-height:150px;overflow:auto;font-size:11px;background:#000;padding:4px;border-radius:6px;"></div>';
        document.body.appendChild(d);
        ['click','mousedown','keydown','keyup','input'].forEach(ev =>
            d.addEventListener(ev, e => e.stopPropagation(), true)
        );
        document.getElementById('piw-mkt-sonido').onchange = e => { SONIDO_ON = e.target.checked; };
        document.getElementById('piw-mkt-debug').onchange = e => { DEBUG = e.target.checked; };
        document.getElementById('piw-mkt-test').onclick = (e) => { e.stopPropagation(); asegurarAudio(); sonar(true); };
    }

    let ctx = null;
    function asegurarAudio() {
        try {
            if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
        } catch(e){}
    }
    document.addEventListener('click', asegurarAudio, false);

    function sonar(forzado) {
        if (!SONIDO_ON && !forzado) return;
        try {
            asegurarAudio();
            if (!ctx) return;
            [988, 1319, 1760, 1319].forEach((f, i) => {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.frequency.value = f; o.type = 'square';
                const t = ctx.currentTime + i * 0.15;
                g.gain.setValueAtTime(0.15, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.13);
                o.start(t); o.stop(t + 0.14);
            });
        } catch(e){}
    }

    function avisar(titulo, detalle) {
        const key = titulo + '|' + detalle + '|' + Date.now().toString().slice(0, -4);
        if (yaAvisados.has(titulo + detalle)) return;
        yaAvisados.add(titulo + detalle);
        setTimeout(() => yaAvisados.delete(titulo + detalle), 30000);
        sonar(false);
        log('VENTA: ' + titulo + ' ' + detalle);
        try {
            if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'default') Notification.requestPermission();
                if (Notification.permission === 'granted') new Notification('💰 VENTA: ' + titulo, { body: detalle });
            }
        } catch(e){}
        const b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:15%;left:50%;transform:translateX(-50%);z-index:1000001;background:linear-gradient(180deg,#00e676,#0091ea);color:#fff;font-size:20px;font-weight:bold;padding:16px 28px;border:4px solid #fff;border-radius:16px;box-shadow:0 0 30px #0af;text-align:center;cursor:pointer;';
        b.textContent = '💰 VENDIDO: ' + titulo + ' — ' + detalle;
        b.onclick = () => b.remove();
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 10000);
    }

    // Palabras de venta exitosa en EN/ES/PT
    const RE_SOLD = /(you sold|item sold|sold for|sale completed|successfully sold|has sido vendido|vendiste|vendido por|se vendi|recebeste|voce vendeu|vendido|oferta vendida|order fulfilled|trade completed)/i;
    const RE_LISTED = /(listed|listing created|puesto a la venta|anunciado|offer created)/i;
    const RE_MARKET = /(market|mercado|trade|auction|offer|sold|vend)/i;

    function esPanel(el) {
        try { return !!(el.closest && (el.closest('#piw-mkt-panel') || el.closest('#piw-iv-panel'))); } catch(e){ return false; }
    }

    function chequearNodo(el) {
        if (!el || !el.innerText) return;
        if (esPanel(el)) return;
        const t = el.innerText;
        if (t.length > 3000) return;
        if (RE_SOLD.test(t)) {
            const corte = t.slice(0, 220).replace(/\s+/g, ' ');
            avisar(corte.slice(0, 80), t.slice(0, 160).replace(/\s+/g, ' '));
        } else if (DEBUG && RE_MARKET.test(t) && /gold|diamond|coin|price|precio|preço/i.test(t)) {
            log('mercado visto: ' + t.slice(0, 120).replace(/\s+/g, ' '));
        }
    }

    const obs = new MutationObserver(muts => {
        for (const mu of muts) {
            for (const n of mu.addedNodes) {
                if (n.nodeType === 1 && !esPanel(n)) chequearNodo(n);
            }
            if (mu.target.nodeType === 1 && !esPanel(mu.target)) {
                const txt = (mu.target.innerText || '');
                if (RE_SOLD.test(txt)) chequearNodo(mu.target);
            }
        }
    });

    function revisarRed(url, bodyStr) {
        try {
            if (!bodyStr) return;
            const u = String(url || '');
            const s = String(bodyStr).slice(0, 8000);
            const esMarketUrl = /(market|trade|auction|offer|sell|shop|store)/i.test(u);
            if (RE_SOLD.test(s)) {
                const m = s.match(/"([^"]{1,60})"\s*:\s*"([^"]{0,80})"/);
                avisar('Mercado (' + u.slice(-60) + ')', s.slice(0, 160));
                return;
            }
            if (DEBUG && esMarketUrl && /sold|vend|gold|diamond|price/i.test(s)) {
                log('red market [' + u.slice(-80) + ']: ' + s.slice(0, 140));
            }
            // Detecta aumento de oro/diamantes tras venta aunque el mensaje venga separado
            if (DEBUG && /(balance|gold|diamond|wallet)/i.test(u) && s.length < 2000) {
                log('balance [' + u.slice(-60) + ']: ' + s.slice(0, 140));
            }
        } catch(e){}
    }

    const origFetch = window.fetch;
    window.fetch = async function(...a) {
        let url = '';
        try { url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || ''; } catch(e){}
        const r = await origFetch.apply(this, a);
        try {
            r.clone().text().then(t => revisarRed(url, t)).catch(()=>{});
        } catch(e){}
        return r;
    };

    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(m, u, ...rest) { this._mkt_url = u; return origOpen.call(this, m, u, ...rest); };
        XMLHttpRequest.prototype.send = function(...rest) {
            this.addEventListener('load', function() {
                try { revisarRed(this._mkt_url, this.responseText); } catch(e){}
            });
            return origSend.apply(this, rest);
        };
    } catch(e){}

    // WebSocket (muchos juegos avisan la venta por socket)
    try {
        const OrigWS = window.WebSocket;
        window.WebSocket = function(...args) {
            const ws = new OrigWS(...args);
            ws.addEventListener('message', (ev) => {
                try {
                    const d = typeof ev.data === 'string' ? ev.data : '';
                    if (d && RE_SOLD.test(d)) avisar('WS mercado', d.slice(0, 160));
                    else if (DEBUG && d && RE_MARKET.test(d)) log('ws: ' + d.slice(0, 140));
                } catch(e){}
            });
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
    } catch(e){}

    function init() {
        crearPanel();
        obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
        log('Market alert activo. Pon algo a la venta y vende para calibrar.');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
