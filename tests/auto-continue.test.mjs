import assert from 'node:assert/strict';
import {it} from 'node:test';
import {apply, Config} from '../host.mjs';

async function fixture(enabled = true) {
  const handlers = new Map(), effects = [], calls = [], warnings = [];
  let changed, failure = null, prompt = async request => {calls.push(request); return {accepted: true};};
  const session = {id: 'original', header: {origin: undefined}};
  const agent = {id: session.id, session};
  const ctx = {
    sessionProjections: {
      register: async () => ({stateOf: () => failure}),
      onChanged: listener => {changed = listener;},
    },
    sessionController: {prompt: (...args) => prompt(...args)},
    logger: {warn: (...args) => warnings.push(args)},
    on: (name, listener) => handlers.set(name, listener),
    effect: callback => effects.push(callback()),
  };
  await apply(ctx, {autoContinue: {get: () => enabled}});
  return {
    calls, warnings, session, agent,
    setEnabled: value => {enabled = value;},
    setPrompt: value => {prompt = value;},
    change(value, key = 'modelInterruption') {failure = value; changed(session, key, value);},
    status: status => handlers.get('agent/status')({agent, status}),
    dispose: async () => {for (const cleanup of effects) await cleanup();},
  };
}
const failure = {seq: 12, time: 1000, message: 'request failed', code: 'PI_AI_ERROR'};

it('exposes an editable default-on switch in native plugin configuration', () => {
  assert.equal(Config({}).autoContinue.get(), true);
  assert.equal(Config({autoContinue: false}).autoContinue.get(), false);
  assert.equal(Config.dict.autoContinue.meta.volatile, true);
  assert.equal(Config.dict.autoContinue.meta.description, '自动继续');
  assert.throws(() => Config({autoContinue: 'false'}));
});

it('sends exactly one continuation to the original session after its failed turn becomes idle', async () => {
  const f = await fixture();
  f.change(failure); f.status('running');
  assert.equal(f.calls.length, 0);
  f.status('idle'); f.status('idle');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].content, [{type: 'text', text: '继续'}]);
  assert.equal(f.calls[0].sessionId, 'original');
  assert.equal(f.calls[0].mode, 'queue');
  assert.ok(f.calls[0].requestId);
  await f.dispose();
});

it('does not resume historical failures just because the plugin loaded', async () => {
  const f = await fixture();
  f.status('idle');
  assert.equal(f.calls.length, 0);
  await f.dispose();
});

it('keeps manual reminders when automatic continuation is disabled', async () => {
  const f = await fixture(false);
  f.change(failure); f.status('idle');
  assert.equal(f.calls.length, 0);
  f.setEnabled(true); f.change({...failure, seq: 13}); f.status('idle');
  assert.equal(f.calls.length, 1);
  await f.dispose();
});

it('honors a live switch-off between failure and idle', async () => {
  const f = await fixture();
  f.change(failure); f.setEnabled(false); f.status('idle');
  assert.equal(f.calls.length, 0);
  await f.dispose();
});

it('does not send after another message or turn cleared the failure', async () => {
  const f = await fixture();
  f.change(failure); f.change(null); f.status('idle');
  assert.equal(f.calls.length, 0);
  await f.dispose();
});

it('excludes delegated subagents and unrelated projection changes', async () => {
  const f = await fixture();
  f.change(failure, 'anotherProjection'); f.status('idle');
  f.session.header.origin = 'subagent'; f.change(failure); f.status('idle');
  assert.equal(f.calls.length, 0);
  await f.dispose();
});

it('reports prompt admission failures without resending the same failed turn', async () => {
  const f = await fixture(); let count = 0;
  f.setPrompt(async () => {count++; throw new Error('unavailable');});
  f.change(failure); f.status('idle');
  await f.dispose();
  f.status('idle');
  assert.equal(count, 1);
  assert.equal(f.warnings.length, 1);
  assert.equal(f.warnings[0][1], 'unavailable');
});

it('aborts and drains an in-flight admission on plugin unload', async () => {
  const f = await fixture(); let signal;
  f.setPrompt((_request, currentSignal) => {
    signal = currentSignal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), {once: true}));
  });
  f.change(failure); f.status('idle');
  assert.equal(signal.aborted, false);
  await f.dispose();
  assert.equal(signal.aborted, true);
});
