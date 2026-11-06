import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resumeFailure } from '../resume.mjs';

const item = Object.freeze({
  sessionId: 'failed-session',
  seq: 42,
  time: 1000,
  message: 'Model connection interrupted',
  code: 'ECONNRESET',
});

function fixture({ result = { ok: true, value: { accepted: true } }, ready } = {}) {
  const calls = { using: [], prompt: [], faces: [] };
  const state = { running: false, failure: item };
  const binding = {
    session: {
      getSnapshot: () => ({ running: state.running }),
      async prompt(...args) {
        calls.prompt.push(args);
        return result;
      },
      projections: {
        faceOf(name) {
          calls.faces.push(name);
          assert.equal(name, 'modelInterruption');
          return { getSnapshot: () => state.failure };
        },
      },
    },
  };
  const sessions = {
    async using(sessionId, options, callback) {
      calls.using.push({ sessionId, options });
      return callback({ ready: ready ?? Promise.resolve(binding) });
    },
  };
  return { sessions, binding, state, calls };
}

describe('resumeFailure', () => {
  it('queues one continue message against the failed session', async () => {
    const { sessions, calls } = fixture();

    assert.deepEqual(await resumeFailure(sessions, item), { status: 'accepted' });
    assert.deepEqual(calls.using, [{
      sessionId: 'failed-session',
      options: { source: 'controllerOperation' },
    }]);
    assert.deepEqual(calls.prompt, [[[{ type: 'text', text: '继续' }], 'queue']]);
    assert.deepEqual(calls.faces, ['modelInterruption']);
  });

  it('does not send when the original session is already running', async () => {
    const { sessions, state, calls } = fixture();
    state.running = true;

    assert.deepEqual(await resumeFailure(sessions, item), { status: 'stale' });
    assert.deepEqual(calls.prompt, []);
  });

  for (const failure of [null, { ...item, seq: item.seq + 1 }]) {
    it(`does not send after the failure is ${failure === null ? 'cleared' : 'replaced'}`, async () => {
      const { sessions, state, calls } = fixture();
      state.failure = failure;

      assert.deepEqual(await resumeFailure(sessions, item), { status: 'stale' });
      assert.deepEqual(calls.prompt, []);
    });
  }

  it('checks running state after the session reference becomes ready', async () => {
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });
    const { sessions, binding, state, calls } = fixture({ ready });
    const pending = resumeFailure(sessions, item);

    assert.deepEqual(calls.prompt, []);
    state.running = true;
    resolveReady(binding);

    assert.deepEqual(await pending, { status: 'stale' });
    assert.deepEqual(calls.prompt, []);
  });

  it('checks the failure sequence after the session reference becomes ready', async () => {
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });
    const { sessions, binding, state, calls } = fixture({ ready });
    const pending = resumeFailure(sessions, item);

    state.failure = { ...item, seq: item.seq + 1 };
    resolveReady(binding);

    assert.deepEqual(await pending, { status: 'stale' });
    assert.deepEqual(calls.prompt, []);
  });

  it('does not resend a failure after the accepted request starts running', async () => {
    const { sessions, state, calls } = fixture();

    assert.deepEqual(await resumeFailure(sessions, item), { status: 'accepted' });
    state.running = true;
    assert.deepEqual(await resumeFailure(sessions, item), { status: 'stale' });
    assert.equal(calls.prompt.length, 1);
  });

  it('propagates a remote prompt rejection without retrying', async () => {
    const { sessions, calls } = fixture({
      result: { ok: false, error: { message: 'Session is unavailable', code: 'UNAVAILABLE' } },
    });

    await assert.rejects(resumeFailure(sessions, item), {
      name: 'Error',
      message: 'Session is unavailable',
    });
    assert.equal(calls.prompt.length, 1);
  });

  it('propagates a rejected prompt operation without retrying', async () => {
    const { sessions, binding, calls } = fixture();
    const error = new Error('Connection closed');
    binding.session.prompt = async (...args) => {
      calls.prompt.push(args);
      throw error;
    };

    await assert.rejects(resumeFailure(sessions, item), (caught) => caught === error);
    assert.equal(calls.prompt.length, 1);
  });
});
