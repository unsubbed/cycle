// Unsubbed Cycle engine: pure date math + estimates + CSV + encrypted backup. No DOM.
const Cycle = (() => {
  const DAY = 864e5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  // 'YYYY-MM-DD' parses as UTC midnight, so DST never shifts a day.
  const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
  const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const REAL = ['light', 'medium', 'heavy']; // spotting never starts or extends a period
  const mean = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);

  function periods(days) {
    const flow = Object.keys(days).filter((d) => REAL.includes(days[d] && days[d].flow)).sort();
    const out = [];
    let end = null;
    for (const d of flow) {
      // gap of 1 empty day joins; 2+ empty days starts a new period
      if (end && diff(end, d) <= 2) out[out.length - 1].length = diff(out[out.length - 1].start, d) + 1;
      else out.push({ start: d, length: 1 });
      end = d;
    }
    return out;
  }

  function stats(days, settings, today) {
    const ps = periods(days);
    const all = ps.map((p, i) => ({ start: p.start, cycleLen: ps[i + 1] ? diff(p.start, ps[i + 1].start) : null, periodLen: p.length }));
    const valid = all.map((c) => c.cycleLen).filter((n) => n !== null && n >= 15 && n <= 60);
    const avgCycle = valid.length ? mean(valid.slice(-6)) : settings.cycleLen;
    // a period still in progress would drag the average down, so only finished ones count
    const done = ps.filter((p) => diff(addDays(p.start, p.length - 1), today) > 2);
    const avgPeriod = done.length ? mean(done.slice(-6).map((p) => p.length)) : settings.periodLen;
    const cycles = all.slice(-12).reverse();
    const shown = cycles.map((c) => c.cycleLen).filter((n) => n !== null && n >= 15 && n <= 60);
    const range = shown.length ? [Math.min(...shown), Math.max(...shown)] : null;
    const lastStart = ps.length ? ps[ps.length - 1].start : null;
    let lateBy = 0;
    const predictions = [];
    if (lastStart) {
      let next = addDays(lastStart, avgCycle);
      if (today > next) {
        lateBy = diff(next, today);
        while (next < today) next = addDays(next, avgCycle);
      }
      for (let i = 0; i < 3; i++) {
        const start = addDays(next, i * avgCycle);
        const ovulation = addDays(start, -14);
        predictions.push({ start, end: addDays(start, avgPeriod - 1), ovulation, fertileStart: addDays(ovulation, -5), fertileEnd: addDays(ovulation, 1) });
      }
    }
    return {
      cycles, avgCycle, avgPeriod, range, lastStart,
      cycleDay: lastStart ? diff(lastStart, today) + 1 : null,
      nextStart: predictions.length ? predictions[0].start : null,
      lateBy, predictions,
    };
  }

  const dayInfo = (d, st) => ({
    predicted: st.predictions.some((p) => d >= p.start && d <= p.end),
    fertile: st.predictions.some((p) => d >= p.fertileStart && d <= p.fertileEnd),
    ovulation: st.predictions.some((p) => d === p.ovulation),
  });

  function cell(v) {
    let s = String(v == null ? '' : v);
    if (/^[\t\r=+\-@]/.test(s)) s = "'" + s; // spreadsheet formula safety
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(days) {
    const rows = [['date', 'flow', 'body', 'mind', 'note']];
    for (const d of Object.keys(days).sort()) {
      const x = days[d] || {};
      const body = (x.body || []).join('; '), mind = (x.mind || []).join('; ');
      if (!x.flow && !body && !mind && !x.note) continue;
      rows.push([d, x.flow || '', body, mind, x.note || '']);
    }
    return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  const b64 = (buf) => {
    let s = '';
    for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
    return btoa(s);
  };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function key(pass, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function lock(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt), new TextEncoder().encode(JSON.stringify(obj)));
    return { app: 'unsubbed-cycle-locked', v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) };
  }

  async function unlock(file, pass) {
    if (!file || file.app !== 'unsubbed-cycle-locked' || file.v !== 1) throw new Error('Not a locked Unsubbed Cycle file');
    // AES-GCM auth check rejects a wrong passphrase or a tampered file
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) }, await key(pass, unb64(file.salt)), unb64(file.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  return { addDays, diff, todayISO, periods, stats, dayInfo, toCSV, lock, unlock };
})();
if (typeof module !== 'undefined') module.exports = Cycle;
