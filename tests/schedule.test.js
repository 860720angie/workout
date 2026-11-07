const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const planData = html.split('<script type="application/json" id="plan-data">')[1].split('</script>')[0];
const base = JSON.parse(planData);
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function run(saved = {}) {
  const data = new Map(Object.entries(saved));
  const app = { innerHTML: '' };
  const events = {};
  const document = {
    activeElement: null,
    hidden: false,
    body: { classList: { add() {}, remove() {} } },
    getElementById(id) { return id === 'plan-data' ? { textContent: planData } : id === 'app' ? app : null; },
    addEventListener(name, fn) { events[name] = fn; }
  };
  const localStorage = {
    get length() { return data.size; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    key(index) { return [...data.keys()][index]; }
  };
  // Wednesday, November 4, 2026: Tuesday's default workout has passed.
  const FakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [2026, 10, 4, 12])); } static now() { return new Date(2026, 10, 4, 12).getTime(); } };
  const window = { scrollTo() {}, addEventListener() {} };
  const context = { document, localStorage, window, location: { reload() {} }, navigator: {}, Date: FakeDate, setInterval() {}, setTimeout() {}, clearTimeout() {}, clearInterval() {}, console };
  vm.runInNewContext(source, context);
  const click = (act, attrs = {}) => events.click({ target: { closest() { return { getAttribute(name) { return name === 'data-act' ? act : attrs[name]; } }; } } });
  return { data, app, api: window.__pr, click };
}

const current = run();
current.click('skipweek');
assert.match(current.app.innerHTML, /Week skipped/);
assert.equal(current.api.moveCheck(0, 2).ok, false, 'moves are disabled while the week is skipped');
current.click('skipweek');
assert.doesNotMatch(current.app.innerHTML, /Week skipped/);
assert.equal(current.api.moveCheck(0, 0).ok, false, 'past Monday remains unavailable');
assert.equal(current.api.moveCheck(0, 2).ok, false, 'missed lower-body day cannot be moved right before Thursday lower-body day');
assert.equal(current.api.moveCheck(0, 4).ok, false, 'Friday is unavailable while it would create three days in a row');
assert.equal(current.api.moveCheck(0, 5).ok, false, 'occupied Saturday cannot be replaced by a missed workout');
const recovered = run({ 'pr-sched-2026-11-02': JSON.stringify({ at: [1, 5, 4, 6], moves: 0 }) });
assert.equal(recovered.api.moveCheck(0, 2).ok, true, 'missed Tuesday can move to free Wednesday after Lower B moves');
recovered.click('moveto', { 'data-t': '2' });
assert.equal(recovered.api.sched().at[0], 2);
assert.match(recovered.app.innerHTML, /Today’s workout/);
const restDay = run({
  'pr-log': JSON.stringify([{ d: '2026-11-03', s: 0, b: 0, t: 'skip' }]),
  'pr-sched-2026-11-02': JSON.stringify({ at: [1, 5, 3, 6], moves: 0 }),
  'pr-day': '1'
});
assert.equal(restDay.api.moveCheck(1, 2).ok, true, 'a workout can move to a usual rest day when spacing allows');
restDay.click('moveto', { 'data-t': '2' });
assert.equal(restDay.api.sched().at[1], 2);

const edited = structuredClone(base);
edited.v = 5;
edited.blocks[0].days[0].sections.find(s => s.kind === 'core').items[0].name = 'My edited crunch';
const upgraded = run({ 'pr-plan': JSON.stringify(edited) });
const updated = JSON.parse(upgraded.data.get('pr-plan'));
assert.equal(updated.v, 6);
assert.equal(updated.blocks[0].days[0].sections.find(s => s.kind === 'core').items[0].name, 'My edited crunch');
for (const [bi, block] of updated.blocks.entries()) for (const [si, day] of block.days.entries()) {
  const core = day.sections.find(s => s.kind === 'core');
  assert.equal(core.items.filter(i => i.id === `back${bi}${si}`).length, 1);
}
assert.equal(run().api.week, 1);
console.log('Schedule and saved-plan migration checks passed.');
