// ==UserScript==
// @name         Poke Idle World - Alerta IV Alto
// @namespace    https://github.com/es6te/
// @version      1.1
// @description  Avisa con sonido cuando capturas IV >= 160 en cualquier panel
// @author       azteca1223
// @match        https://poke.idleworld.online/*
// @grant        Notification
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-iv-alert.user.js
// @updateURL    https://raw.githubusercontent.com/azteca1223/piw-scripts/main/poke-idle-world-iv-alert.user.js
// ==/UserScript==

(function() {
    'use strict';
    let UMBRAL = 160;
    let SONIDO_ON = true;
    const yaAvisados = new Set();

    function crearPanel() {
        if (document.getElementById('piw-iv-panel')) return;
        const d = document.createElement('div');
        d.id = 'piw-iv-panel';
        d.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999999;background:#111;color:#fff;padding:8px 10px;border:2px solid gold;border-radius:10px;font-family:sans-serif;font-size:12px;';
        d.innerHTML = '<b style="color:gold">⚡ IV Alert PIW</b><br>Umbral: <input id="piw-umbral" type="number" value="' + UMBRAL + '" style="width:55px;background:#222;color:#fff;border:1px solid #555"> <label><input id="piw-sonido" type="checkbox" checked> sonido</label><br><button id="piw-test" style="margin-top:4px">Probar sonido</button><div id="piw-status" style="margin-top:4px;color:#8f8"></div>';
        document.body.appendChild(d);
        document.getElementById('piw-umbral').onchange = e => { UMBRAL = parseInt(e.target.value) || 160; };
        document.getElementById('piw-sonido').onchange = e => { SONIDO_ON = e.target.checked; };
        document.getElementById('piw-test').onclick = () => { asegurarAudio(); sonar(true); };
    }

    let ctx = null;
    function asegurarAudio() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
    }
    document.addEventListener('click', asegurarAudio, { once: false });

    function sonar(forzado = false) {
        if (!SONIDO_ON && !forzado) return;
        asegurarAudio();
        [880, 1174, 1568].forEach((f, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = f; o.type = 'sine';
            const t = ctx.currentTime + i * 0.18;
            g.gain.setValueAtTime(0.3, t);
            g.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
            o.start(t); o.stop(t + 0.17);
        });
    }

    function avisar(poke, total) {
        if (yaAvisados.has(poke + total)) return;
        yaAvisados.add(poke + total);
        sonar();
        if (Notification.permission === 'default') Notification.requestPermission();
        if (Notification.permission === 'granted') {
            try { new Notification('IV ALTO: ' + poke + ' (' + total + ')', { body: 'IV total ' + total + ' >= ' + UMBRAL }); } catch(e){}
        }
        const b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:15%;left:50%;transform:translateX(-50%);z-index:1000000;background:linear-gradient(180deg,#ffdf00,#ff8c00);color:#000;font-size:22px;font-weight:bold;padding:16px 28px;border:4px solid #fff;border-radius:16px;box-shadow:0 0 30px gold;text-align:center;';
        b.innerHTML = '🎉 IV BUENO 🎉<br>' + poke + ' — IV: ' + total;
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 8000);
        b.onclick = () => b.remove();
        const st = document.getElementById('piw-status');
        if (st) st.textContent = 'Ultimo: ' + poke + ' ' + total;
    }

    function extraerIVTotal(texto) {
        if (!texto || !/iv/i.test(texto)) return null;
        let m = texto.match(/IV[^0-9]{0,10}(\d{2,3})/i);
        if (m) {
            const v = parseInt(m[1]);
            if (v >= 30 && v <= 186) return { total: v };
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

    function nombreCercano(el) {
        const root = el.closest('div') || document.body;
        const t = (root.innerText || '').slice(0, 200);
        const m = t.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
        return m ? m[1] : 'Pokemon';
    }

    function chequearNodo(el) {
        if (!el || !el.innerText) return;
        if (el.innerText.length > 2000) return;
        const r = extraerIVTotal(el.innerText);
        if (r && r.total >= UMBRAL) avisar(nombreCercano(el), r.total);
    }

    const obs = new MutationObserver(muts => {
        for (const mu of muts) {
            for (const n of mu.addedNodes) {
                if (n.nodeType === 1) chequearNodo(n);
            }
            if (mu.target.nodeType === 1) chequearNodo(mu.target);
        }
    });

    function revisarJSON(obj) {
        try {
            const s = JSON.stringify(obj);
            if (!/iv/i.test(s)) return;
            const m = s.match(/"(total_?iv|iv_?total|ivSum)"\s*:\s*(\d{2,3})/i);
            if (m && parseInt(m[2]) >= UMBRAL) {
                const n = s.match(/"(name|pokemon|species)"\s*:\s*"([^"]+)"/i);
                avisar(n ? n[2] : 'Pokemon', parseInt(m[2]));
            }
            const m2 = s.match(/"ivs?"\s*:\s*(\[[^\]]+\]|\{[^}]+\})/i);
            if (m2) {
                const nums = m2[1].match(/\d+/g)?.map(Number) || [];
                if (nums.length >= 6) {
                    const total = nums.slice(0,6).reduce((a,b)=>a+b,0);
                    if (total >= UMBRAL) avisar('Pokemon', total);
                }
            }
        } catch(e){}
    }
    const origFetch = window.fetch;
    window.fetch = async function(...a) {
        const r = await origFetch.apply(this, a);
        try { r.clone().json().then(revisarJSON).catch(()=>{}); } catch(e){}
        return r;
    };

    setInterval(() => {
        document.querySelectorAll('div, span, p').forEach(el => {
            if (/iv/i.test(el.childNodes[0]?.textContent || '')) chequearNodo(el);
        });
    }, 2000);

    function init() {
        crearPanel();
        obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        if (Notification.permission === 'default') Notification.requestPermission();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
