import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {it} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {dictionaries} from '../locales.mjs';

const require = createRequire(import.meta.url);
const artifact = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function mount() {
  let registration;
  runInNewContext(artifact, {window: {__ModuleLoader__: {load: value => {registration = value;}}}});
  const plugin = registration.factory(require);
  const entries = [];
  const writes = [];
  const form = {
    getSnapshot: () => ({status: 'ready', value: {autoContinue: true}, writable: true}),
    subscribe: () => () => {},
    set: async (...args) => {writes.push(args); return true;},
  };
  plugin.apply({
    effect: callback => callback(),
    locale: {register: () => () => {}},
    sessions: {},
    configForms: {get: namespace => {assert.equal(namespace, 'model-interruption-notifier'); return form;}},
    slots: {inject: (_name, callback) => callback(), register: (options, Component) => {entries.push({options, Component}); return () => {}; }},
  });
  return {entries, writes, form};
}

it('registers an automatic-continuation control on this bundle detail page', async () => {
  const {entries, form, writes} = mount();
  const entry = entries.find(({options}) => options.name === 'plugins.bundle.config');
  assert.ok(entry, 'Missing bundle details configuration registration');
  assert.equal(entry.options.key, 'dsh-model-interruption-notifier');
  const injected = entry.options.inject();
  assert.equal(injected.hooks.preference, form);
  const html = renderToStaticMarkup(React.createElement(entry.Component, {
    ...injected, usePreference: selector => selector(form.getSnapshot()), t: key => dictionaries.zh[key],
  }));
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-label="自动继续"/);
  assert.match(html, /aria-checked="true"/);
  assert.doesNotMatch(html, /disabled=""/);
  await injected.setAutoContinue(false);
  await injected.setAutoContinue(true);
  assert.deepEqual(writes, [['autoContinue', false], ['autoContinue', true]]);
});

it('keeps the configuration switch disabled until Host preferences are available', () => {
  const {entries} = mount();
  const entry = entries.find(({options}) => options.name === 'plugins.bundle.config');
  const html = renderToStaticMarkup(React.createElement(entry.Component, {
    usePreference: selector => selector({status: 'loading', value: undefined, writable: false}),
    setAutoContinue: async () => {throw Error('Unavailable preferences must not be edited');},
    t: key => dictionaries.zh[key],
  }));
  assert.match(html, /role="switch"/);
  assert.match(html, /disabled=""/);
});

it('selects Chinese detail documentation from the installed locale resources', async () => {
  const locale = JSON.parse(await readFile(new URL('../locale/zh.json', import.meta.url), 'utf8'));
  assert.equal(locale.meta.detail, 'README.zh.md');
  const text = await readFile(new URL(`../${locale.meta.detail}`, import.meta.url), 'utf8');
  assert.match(text, /自动继续/);
});
