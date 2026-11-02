// Unsubbed Cycle UI. All estimates come from cycle.js; this file only renders and stores.
const $ = (s) => document.querySelector(s);
const FLOWS = [['', 'None'], ['spotting', 'Spotting'], ['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']];
const BODY = ['Cramps', 'Headache', 'Bloating', 'Tender breasts', 'Back ache', 'Acne', 'Tired', 'Nausea', 'Cravings', 'Trouble sleeping'];
const MIND = ['Calm', 'Happy', 'Low', 'Irritable', 'Anxious', 'Energetic'];
const DEFAULTS = { cycleLen: 28, periodLen: 5, weekStart: 1 };

let days = {}, settings = { ...DEFAULTS }, st;
let sel = Cycle.todayISO(), view = sel.slice(0, 8) + '01';

const grid = $('#grid'), note = $('#note'), appSettings = $('#app-settings');
const fmt = (iso, o) => new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', ...o });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const monthStart = (iso, n = 0) => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};
const shiftMonth = (iso, n) => {
  const d = monthStart(iso, n).slice(0, 8) + iso.slice(8), last = Cycle.addDays(monthStart(iso, n + 1), -1);
  return d > last ? last : d;
};

// Everything that comes from storage or a file passes through here (trust boundary).
const int = (v, lo, hi, d) => (Number.isInteger(+v) && +v >= lo && +v <= hi ? +v : d);
function clean(s) {
  if (!s || typeof s.days !== 'object' || !s.days) throw new Error('No days in file');
  const out = {};
  for (const [d, x] of Object.entries(s.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !x || typeof x !== 'object') continue;
    const e = {};
    if (FLOWS.some(([v]) => v && v === x.flow)) e.flow = x.flow;
    for (const [k, list] of [['body', BODY], ['mind', MIND]]) {
      const a = Array.isArray(x[k]) ? x[k].filter((v) => list.includes(v)) : [];
      if (a.length) e[k] = a;
    }
    if (typeof x.note === 'string' && x.note) e.note = x.note;
    if (Object.keys(e).length) out[d] = e;
  }
  const t = s.settings || {};
  return {
    days: out,
    settings: { cycleLen: int(t.cycleLen, 21, 45, 28), periodLen: int(t.periodLen, 2, 10, 5), weekStart: +t.weekStart === 0 ? 0 : 1 },
  };
}
const state = () => ({ app: 'unsubbed-cycle', version: 1, days, settings });

// Day panel options: native radios and checkboxes, styled as pills and chips.
function options(box, type, list) {
  for (const item of list) {
    const [value, text] = Array.isArray(item) ? item : [item, item];
    const label = document.createElement('label');
    label.append(Object.assign(document.createElement('input'), { type, name: box.id, value }),
      Object.assign(document.createElement('span'), { textContent: text }));
    box.append(label);
  }
}
options($('#flow'), 'radio', FLOWS);
options($('#body'), 'checkbox', BODY);
options($('#mind'), 'checkbox', MIND);

function setDay(patch, full = true) {
  const e = { ...days[sel], ...patch };
  for (const k of Object.keys(e)) if (!e[k] || e[k].length === 0) delete e[k];
  if (Object.keys(e).length) days[sel] = e;
  else delete days[sel];
  kit.store();
  full ? render() : renderCal();
}

function render() {
  st = Cycle.stats(days, settings, Cycle.todayISO());
  renderToday();
  renderCal();
  renderDay();
  renderHist();
}

function renderToday() {
  const today = Cycle.todayISO(), strip = $('#t-strip');
  strip.replaceChildren();
  $('#t-day').textContent = $('#t-fert').textContent = '';
  if (!st.lastStart) return ($('#t-next').textContent = 'Tap the first day of your last period to start.');
  $('#t-day').textContent = `Day ${st.cycleDay} of about ${st.avgCycle}`;
  const n = Cycle.diff(today, st.nextStart);
  $('#t-next').textContent = st.lateBy ? `Your period is about ${plural(st.lateBy, 'day')} late`
    : n === 0 ? 'Next period could start about today' : `Next period in about ${plural(n, 'day')}`;
  const p = st.predictions.find((x) => x.fertileEnd >= today);
  const short = (d) => fmt(d, { month: 'short', day: 'numeric' });
  if (p) $('#t-fert').textContent = `Fertile window: ${short(p.fertileStart)} – ${short(p.fertileEnd)} (estimate)`;
  // shortcut: strip caps at 60 days, long gaps in logging just show the text lines
  const len = Math.min(Math.max(st.avgCycle, st.cycleDay), 60);
  for (let i = 0; i < len; i++) {
    const seg = document.createElement('i');
    seg.classList.toggle('per', i < st.avgPeriod);
    seg.classList.toggle('fert', Cycle.dayInfo(Cycle.addDays(st.lastStart, i), st).fertile);
    seg.classList.toggle('past', i < st.cycleDay - 1);
    seg.classList.toggle('now', i === st.cycleDay - 1);
    strip.append(seg);
  }
}

// Draws one 6x7 month into box. Only the main grid is interactive.
function month(box, first, interactive) {
  const today = Cycle.todayISO(), dow = new Date(first + 'T00:00:00Z').getUTCDay();
  let d = Cycle.addDays(first, -((dow - settings.weekStart + 7) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++, d = Cycle.addDays(d, 1)) {
    const x = days[d] || {}, info = Cycle.dayInfo(d, st), words = [fmt(d, { day: 'numeric', month: 'long' })];
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'cy-d', tabIndex: -1 });
    const mark = (cls, word) => (b.classList.add(cls), words.push(word));
    b.dataset.d = d;
    if (d.slice(0, 7) !== first.slice(0, 7)) b.classList.add('out');
    if (d === today) mark('today', 'today'), b.setAttribute('aria-current', 'date');
    if (x.flow) mark(x.flow, x.flow === 'spotting' ? 'spotting' : `period, ${x.flow} flow`);
    else if (info.predicted) mark('pred', 'expected period');
    if (info.fertile) mark('fert', 'estimated fertile');
    if (info.ovulation) mark('ovu', 'estimated ovulation');
    if (x.body || x.mind || x.note) mark('extra', 'has notes');
    if (interactive && d === sel) {
      mark('sel', 'selected');
      b.tabIndex = 0;
    }
    b.setAttribute('aria-label', words.join(', '));
    b.append(Object.assign(document.createElement('span'), { className: 'n', textContent: +d.slice(8) }));
    cells.push(b);
  }
  if (interactive && !cells.some((c) => c.tabIndex === 0)) cells.find((c) => !c.classList.contains('out')).tabIndex = 0;
  box.replaceChildren(...cells);
}

function renderCal() {
  const had = grid.contains(document.activeElement);
  const start = Cycle.addDays('2024-01-01', settings.weekStart - 1); // 2024-01-01 is a Monday
  const names = [0, 1, 2, 3, 4, 5, 6].map((i) => Object.assign(document.createElement('span'), { textContent: fmt(Cycle.addDays(start, i), { weekday: 'short' }) }));
  document.querySelectorAll('.cy-week').forEach((w) => w.replaceChildren(...names.map((n) => n.cloneNode(true))));
  $('#cal-h').textContent = fmt(view, { month: 'long', year: 'numeric' });
  month(grid, view, true);
  if (had) grid.querySelector('[tabindex="0"]').focus();
}

function renderDay() {
  const x = days[sel] || {};
  $('#day-h').textContent = fmt(sel, { weekday: 'long', day: 'numeric', month: 'long' });
  for (const i of document.querySelectorAll('.cy-opts input')) {
    i.checked = i.type === 'radio' ? i.value === (x.flow || '') : (x[i.name] || []).includes(i.value);
  }
  note.value = x.note || '';
}

function renderHist() {
  const has = st.cycles.some((c) => c.cycleLen);
  $('#h-empty').hidden = has;
  $('#h-table').hidden = $('#h-avg').hidden = !has;
  $('#h-table tbody').replaceChildren(...st.cycles.map((c) => {
    const tr = document.createElement('tr');
    for (const t of [fmt(c.start, { day: 'numeric', month: 'short', year: 'numeric' }), c.cycleLen ? plural(c.cycleLen, 'day') : 'In progress', plural(c.periodLen, 'day')]) {
      tr.append(Object.assign(document.createElement('td'), { textContent: t }));
    }
    return tr;
  }));
  $('#h-avg').textContent = `Average cycle about ${st.avgCycle} days · average period about ${st.avgPeriod} days`
    + (st.range ? ` · range ${st.range[0]}–${st.range[1]} days` : '');
}

function showSettings() {
  for (const k of Object.keys(DEFAULTS)) appSettings.querySelector(`[name=${k}]`).value = settings[k];
}

function pick(d) {
  sel = d;
  view = monthStart(d);
  renderCal();
  renderDay();
}

// Passphrase dialog: password fields instead of prompt(), so the passphrase isn't shown on screen.
const pass = $('#pass'), passForm = pass.querySelector('form');
function askPass(twice) {
  const { p1, p2 } = passForm.elements;
  passForm.reset();
  $('#p2-wrap').hidden = !twice;
  p2.required = twice;
  p1.minLength = twice ? 8 : 0;
  pass.returnValue = '';
  pass.showModal();
  return new Promise((res) => pass.addEventListener('close', () => {
    const ok = pass.returnValue === 'ok', v = p1.value, match = !twice || v === p2.value;
    passForm.reset();
    if (ok && !match) kit.toast("The two passphrases don't match.");
    res(ok && match ? v : null);
  }, { once: true }));
}

const kit = Unsubbed.app({
  id: 'cycle',
  name: 'Unsubbed Cycle',
  accept: '.json',
  load: (s) => ({ days, settings } = clean(s)),
  state,
  exportFile: () => ({ name: 'unsubbed-cycle.json', data: JSON.stringify(state(), null, 2), type: 'application/json' }),
  async importFile(file) {
    let s = JSON.parse(await file.text());
    if (s && s.app === 'unsubbed-cycle-locked') {
      const p = await askPass(false);
      if (!p) throw new Error('No passphrase');
      s = await Cycle.unlock(s, p); // rejects on a wrong passphrase
    }
    if (!s || s.app !== 'unsubbed-cycle') throw new Error('Not an Unsubbed Cycle file');
    const next = clean(s);
    if (!confirm('Replace the data in this browser with this file?')) throw new Error('Cancelled');
    ({ days, settings } = next);
    showSettings();
    render();
  },
});

$('#flow').onchange = (e) => {
  if (e.target.value && sel > Cycle.todayISO()) {
    kit.toast("That day hasn't happened yet");
    return renderDay();
  }
  setDay({ flow: e.target.value });
};
$('#body').onchange = $('#mind').onchange = (e) => {
  setDay({ [e.target.name]: [...document.querySelectorAll(`#${e.target.name} input:checked`)].map((i) => i.value) });
};
note.oninput = () => setDay({ note: note.value }, false);

grid.onclick = (e) => {
  const b = e.target.closest('.cy-d');
  if (!b) return;
  pick(b.dataset.d);
  if (matchMedia('(max-width: 899px)').matches) $('#day').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
grid.onkeydown = (e) => {
  const from = e.target.closest('.cy-d')?.dataset.d;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (!from || (!step && e.key !== 'PageUp' && e.key !== 'PageDown')) return;
  e.preventDefault();
  pick(step ? Cycle.addDays(from, step) : shiftMonth(from, e.key === 'PageUp' ? -1 : 1));
};
$('#prev').onclick = () => ((view = monthStart(view, -1)), renderCal());
$('#next').onclick = () => ((view = monthStart(view, 1)), renderCal());
$('#go-today').onclick = () => pick(Cycle.todayISO());

appSettings.onchange = (e) => {
  if (!(e.target.name in DEFAULTS)) return;
  settings = clean({ days: {}, settings: { ...settings, [e.target.name]: e.target.value } }).settings;
  e.target.value = settings[e.target.name];
  kit.store();
  render();
};
const lockBtn = $('#lock');
if (!window.crypto?.subtle) {
  lockBtn.disabled = true;
  lockBtn.title = 'Encrypted backup needs a secure page (https or localhost).';
}
lockBtn.onclick = async () => {
  const p = await askPass(true);
  if (!p) return;
  kit.download('unsubbed-cycle.locked.json', JSON.stringify(await Cycle.lock(state(), p)), 'application/json');
  kit.toast('Encrypted backup saved');
};

$('#csv').onclick = () => (Object.keys(days).length
  ? kit.download('unsubbed-cycle.csv', Cycle.toCSV(days), 'text/csv') : kit.toast('Nothing logged yet'));
$('#print').onclick = () => print();
addEventListener('beforeprint', () => {
  view = monthStart(Cycle.todayISO());
  renderCal();
  const prev = monthStart(view, -1);
  $('#prev-h').textContent = fmt(prev, { month: 'long', year: 'numeric' });
  month($('#grid-prev'), prev, false);
});

showSettings();
render();
