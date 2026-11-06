import {randomUUID} from 'node:crypto';
import Schema from '@deepseek-ai/schemastery';
import {z} from 'zod';
import {reduceFailure} from './projection.mjs';

export const name = 'model-interruption-notifier';
export const inject = ['sessionProjections', 'sessionController'];
export const Config = Schema.object({
  autoContinue: Schema.boolean().default(true).description('自动继续').volatile(),
});

/** Publish the most recent failed turn through the standard Session projection feed.
 * @param ctx - Plugin context owning the projection and idle listener.
 * @param config - Live automatic-continuation preference from plugin details.
 */
export async function apply(ctx, config) {
  const schema = z.object({seq: z.number().int().nonnegative(), time: z.number(), message: z.string(), code: z.string()}).nullable();
  const projection = await ctx.sessionProjections.register({
    key: 'modelInterruption', stateVersion: 1, stateSchema: schema,
    init: () => null, apply: reduceFailure,
    wire: {viewSchema: schema, view: state => state},
  });
  const pending = new Map();
  const inFlight = new Set();
  const abort = new AbortController();
  ctx.effect(() => async () => {
    abort.abort();
    pending.clear();
    await Promise.allSettled([...inFlight]);
  });
  ctx.sessionProjections.onChanged((session, key, failure) => {
    if (key !== 'modelInterruption' || session.header.origin === 'subagent') return;
    if (failure && config.autoContinue.get()) pending.set(session.id, failure.seq);
    else pending.delete(session.id);
  });
  ctx.on('agent/status', ({agent, status}) => {
    if (status !== 'idle' || !pending.has(agent.id)) return;
    const seq = pending.get(agent.id);
    pending.delete(agent.id);
    if (!config.autoContinue.get() || projection.stateOf(agent.session)?.seq !== seq) return;
    const task = ctx.sessionController.prompt({
      requestId: randomUUID(), sessionId: agent.id, mode: 'queue',
      content: [{type: 'text', text: '继续'}],
    }, abort.signal).catch(error => ctx.logger.warn('Automatic continuation failed: %s', error.message));
    inFlight.add(task);
    void task.finally(() => inFlight.delete(task));
  });
}
