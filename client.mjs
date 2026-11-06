import React from 'react';
import {failureCandidates} from './projection.mjs';
import {resumeFailure} from './resume.mjs';
import {dictionaries} from './locales.mjs';

export const name = 'model-interruption-notifier-client';
export const inject = ['slots', 'locale', 'sessions', 'configForms'];
const NS = 'modelInterruptionNotifier';
const h = React.createElement;
const css = `
.dsh-interruption-card{position:fixed;right:16px;bottom:16px;width:min(360px,calc(100vw - 32px));max-height:min(340px,calc(100dvh - 32px));box-sizing:border-box;z-index:1790;display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 8px 28px color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);font:13px/1.6 system-ui,sans-serif;pointer-events:auto}
.dsh-interruption-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.dsh-interruption-header strong{font-size:14px}.dsh-interruption-card p{margin:0}.dsh-interruption-description{font-size:12px;color:var(--dsw-alias-label-secondary)}.dsh-interruption-summary{overflow:auto;min-height:0;overflow-wrap:anywhere}.dsh-interruption-session{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-interruption-excerpt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap}.dsh-interruption-actions{display:flex;justify-content:flex-end;gap:8px}.dsh-interruption-error{color:var(--dsw-alias-state-error-primary)}
.dsh-interruption-button{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;cursor:pointer;font:14px/22px system-ui,sans-serif;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px;height:36px}.dsh-interruption-button:hover{background:var(--dsw-alias-bg-layer-2)}.dsh-interruption-button:disabled{cursor:not-allowed;opacity:.4}.dsh-interruption-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.dsh-interruption-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.dsh-interruption-close{border:0;padding:0;width:28px;height:28px}
`;

/** Non-modal reminder. The framework owns session subscriptions; dismissal is view-local. */
function Reminder({useSessions, useSessionStatus, resume, t}) {
  const rows = useSessions(value => value.byId);
  const projections = useSessions(value => value.projectionsBySession);
  const statuses = useSessionStatus(value => value);
  const [dismissed, setDismissed] = React.useState(() => new Map());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const sending = React.useRef(false);
  const candidates = React.useMemo(() => failureCandidates(rows, projections, statuses, dismissed), [rows, projections, statuses, dismissed]);
  const current = candidates[0];
  // Questions own the same corner; show the interruption once the pending interaction settles.
  const questionPending = [...statuses.values()].some(status => status.pendingInteraction);
  if (!current || questionPending) return null;
  const key = `${current.sessionId}:${current.seq}`;
  const dismiss = item => setDismissed(previous => new Map(previous).set(item.sessionId, item.seq));
  const confirm = async () => {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(null);
    try {await resume(current); dismiss(current);}
    catch (failure) {setError({key, message: failure.message});}
    finally {sending.current = false; setBusy(false);}
  };
  const button = (text, onClick, className = '', extra = {}) => h('button', {type: 'button', className: `dsh-interruption-button ${className}`, onClick, disabled: busy, ...extra}, text);
  return h('section', {className: 'dsh-interruption-card', role: 'region', 'aria-label': t('title'), 'aria-live': 'polite', onKeyDown: event => {
    if (event.key === 'Escape' && !busy) {event.stopPropagation(); dismiss(current);}
  }},
  h('style', null, css),
  h('div', {className: 'dsh-interruption-header'}, h('strong', null, t('title')), button('×', () => dismiss(current), 'dsh-interruption-close', {'aria-label': t('close')})),
  h('div', {className: 'dsh-interruption-summary'}, h('strong', {className: 'dsh-interruption-session'}, rows[current.sessionId]?.title || rows[current.sessionId]?.displayTitle || t('untitled')),
    h('p', {className: 'dsh-interruption-excerpt'}, current.message)),
  h('p', {className: 'dsh-interruption-description'}, t('description')),
  error?.key === key && h('p', {className: 'dsh-interruption-error', role: 'alert'}, error.message),
  h('div', {className: 'dsh-interruption-actions'}, button(t('later'), () => dismiss(current)), button(t(busy ? 'sending' : 'resume'), confirm, 'dsh-interruption-primary')));
}

/** Edit the Host preference from the bundle's detail page using the shared native form. */
function Configuration({usePreference, setAutoContinue, t}) {
  const preference = usePreference(value => value);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const enabled = preference.value?.autoContinue === true;
  return h('div', null,
    h('style', null, `.dsh-interruption-config{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;color:var(--dsw-alias-label-primary);font-size:14px}.dsh-interruption-switch{position:relative;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);cursor:pointer}.dsh-interruption-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}.dsh-interruption-switch span{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);transform:translateX(0)}.dsh-interruption-switch[aria-checked=true] span{transform:translateX(16px)}.dsh-interruption-switch:disabled{opacity:.4;cursor:not-allowed}.dsh-interruption-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}`),
    h('div', {className: 'dsh-interruption-config'}, h('span', null, t('autoContinue')),
      h('button', {type: 'button', role: 'switch', className: 'dsh-interruption-switch', 'aria-label': t('autoContinue'), 'aria-checked': enabled,
        disabled: busy || preference.status !== 'ready' || !preference.writable,
        onClick: async () => {
          setBusy(true); setError(null);
          try {if (!await setAutoContinue(!enabled)) setError(t('saveFailed'));}
          catch (failure) {setError(failure.message);}
          finally {setBusy(false);}
        }}, h('span', {'aria-hidden': true}))),
    error && h('p', {role: 'alert', style: {color: 'var(--dsw-alias-state-error-primary)'}}, error));
}

/** Register the additive corner card and locale resources for this plugin lifetime.
 * @param ctx - Client context with Session acquisition, slots, and locale services.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, dictionaries));
  const form = ctx.configForms.get('model-interruption-notifier');
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: 'dsh-model-interruption-notifier', locale: NS,
    inject: () => ({hooks: {preference: form}, setAutoContinue: enabled => form.set('autoContinue', enabled)}),
  }, Configuration));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'dsh-model-interruption-notifier:reminder', order: 551, locale: NS,
    inject: () => ({resume: item => resumeFailure(ctx.sessions, item)}),
  }, Reminder));
}
