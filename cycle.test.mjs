import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Cycle = createRequire(import.meta.url)('./cycle.js');

const S = { cycleLen: 28, periodLen: 5, weekStart: 1 };
const log = (start, n, flow = 'medium') => Object.fromEntries(Array.from({ length: n }, (_, i) => [Cycle.addDays(start, i), { flow }]));

test('date math in UTC', () => {
  assert.equal(Cycle.addDays('2026-03-28', 2), '2026-03-30'); // across EU DST change
  assert.equal(Cycle.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(Cycle.diff('2026-02-27', '2026-03-01'), 2);
  assert.match(Cycle.todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('period detection', () => {
  assert.deepEqual(Cycle.periods({ '2026-01-01': { flow: 'spotting' } }), []);
  // spotting before a period does not start it
  assert.deepEqual(Cycle.periods({ '2026-01-01': { flow: 'spotting' }, '2026-01-02': { flow: 'light' } }), [{ start: '2026-01-02', length: 1 }]);
  // 1-day gap joins
  assert.deepEqual(Cycle.periods({ '2026-01-01': { flow: 'heavy' }, '2026-01-03': { flow: 'light' } }), [{ start: '2026-01-01', length: 3 }]);
  // 2-day gap of non-flow (spotting counts as non-flow) splits
  assert.deepEqual(
    Cycle.periods({ '2026-01-01': { flow: 'heavy' }, '2026-01-02': { flow: 'spotting' }, '2026-01-03': { note: 'x' }, '2026-01-04': { flow: 'light' } }),
    [{ start: '2026-01-01', length: 1 }, { start: '2026-01-04', length: 1 }],
  );
});

test('no logs: fallback, no predictions', () => {
  const st = Cycle.stats({}, S, '2026-05-01');
  assert.deepEqual(st, { cycles: [], avgCycle: 28, avgPeriod: 5, range: null, lastStart: null, cycleDay: null, nextStart: null, lateBy: 0, predictions: [] });
});

test('averages over last 6 valid cycles with 15-60 filter', () => {
  // starts: 10 cycles of 30 days, then one of 70 (ignored), then one of 10 (ignored), then last 6 at 26
  const starts = ['2025-01-01'];
  const lens = [30, 30, 30, 30, 70, 10, 26, 26, 26, 26, 26, 26];
  for (const n of lens) starts.push(Cycle.addDays(starts.at(-1), n));
  const days = Object.assign({}, ...starts.map((s, i) => log(s, i === starts.length - 1 ? 3 : 4)));
  const today = Cycle.addDays(starts.at(-1), 5);
  const st = Cycle.stats(days, S, today);
  assert.equal(st.avgCycle, 26);
  assert.equal(st.avgPeriod, Math.round((4 * 5 + 3) / 6));
  assert.equal(st.cycles.length, 12);
  assert.equal(st.cycles[0].start, starts.at(-1));
  assert.equal(st.cycles[0].cycleLen, null);
  assert.equal(st.cycles[1].cycleLen, 26);
  assert.deepEqual(st.range, [26, 30]); // 70 and 10 excluded
  assert.equal(st.lastStart, starts.at(-1));
  assert.equal(st.cycleDay, 6);
});

test('single period falls back to settings cycle length', () => {
  const st = Cycle.stats(log('2026-04-01', 4), S, '2026-04-10');
  assert.equal(st.avgCycle, 28);
  assert.equal(st.avgPeriod, 4);
  assert.equal(st.range, null);
});

test('predictions, ovulation, fertile window, dayInfo', () => {
  const days = { ...log('2026-01-01', 5), ...log('2026-01-31', 5) }; // 30-day cycle
  const st = Cycle.stats(days, S, '2026-02-05');
  assert.equal(st.avgCycle, 30);
  assert.equal(st.nextStart, '2026-03-02');
  assert.equal(st.lateBy, 0);
  assert.equal(st.predictions.length, 3);
  assert.deepEqual(st.predictions[0], { start: '2026-03-02', end: '2026-03-06', ovulation: '2026-02-16', fertileStart: '2026-02-11', fertileEnd: '2026-02-17' });
  assert.equal(st.predictions[1].start, '2026-04-01');
  assert.equal(st.predictions[2].start, '2026-05-01');
  assert.deepEqual(Cycle.dayInfo('2026-03-04', st), { predicted: true, fertile: false, ovulation: false });
  assert.deepEqual(Cycle.dayInfo('2026-02-16', st), { predicted: false, fertile: true, ovulation: true });
  assert.deepEqual(Cycle.dayInfo('2026-02-10', st), { predicted: false, fertile: false, ovulation: false });
  assert.deepEqual(Cycle.dayInfo('2026-02-17', st), { predicted: false, fertile: true, ovulation: false });
});

test('late: lateBy counts and predictions roll forward', () => {
  const days = log('2026-01-01', 5); // next expected 2026-01-29
  assert.equal(Cycle.stats(days, S, '2026-01-29').lateBy, 0);
  const st = Cycle.stats(days, S, '2026-02-03');
  assert.equal(st.lateBy, 5);
  assert.equal(st.nextStart, '2026-02-26');
  assert.ok(st.predictions[0].start >= '2026-02-03');
});

test('CSV quoting and formula prefix', () => {
  const csv = Cycle.toCSV({
    '2026-01-02': { flow: 'light', body: ['cramps', 'headache'], mind: ['calm'], note: 'said "hi", ok' },
    '2026-01-01': { note: '=SUM(A1)' },
    '2026-01-03': { body: [] },
    '2026-01-04': { note: 'line1\nline2' },
  });
  assert.equal(csv, [
    'date,flow,body,mind,note',
    "2026-01-01,,,,'=SUM(A1)",
    '2026-01-02,light,cramps; headache,calm,"said ""hi"", ok"',
    '2026-01-04,,,,"line1\nline2"',
    '',
  ].join('\r\n'));
  assert.ok(Cycle.toCSV({ '2026-01-01': { note: '-1,2' } }).includes(`"'-1,2"`));
});

test('lock/unlock round trip and wrong pass', async () => {
  const obj = { app: 'unsubbed-cycle', version: 1, days: { '2026-01-01': { flow: 'heavy', note: 'ünïcode ✓' } }, settings: S };
  const file = await Cycle.lock(obj, 'correct horse');
  assert.equal(file.app, 'unsubbed-cycle-locked');
  assert.equal(file.v, 1);
  assert.equal(atob(file.salt).length, 16);
  assert.equal(atob(file.iv).length, 12);
  assert.ok(!JSON.stringify(file).includes('heavy'));
  assert.deepEqual(await Cycle.unlock(JSON.parse(JSON.stringify(file)), 'correct horse'), obj);
  await assert.rejects(Cycle.unlock(file, 'wrong'));
  await assert.rejects(Cycle.unlock({ app: 'other' }, 'x'));
});
