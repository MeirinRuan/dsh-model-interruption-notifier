# Installation and development

English | [中文](guide.zh.md)

## Install

The package declares support for DSH `0.2.2-rc.1` only. Other DSH versions need separate verification because the extension APIs are pre-stable. Development requires Node.js `^22.19.0 || >=24.0.0` and pnpm `11.28.5`.

Use a prebuilt `.tgz` from the project's GitHub Releases when a release is available. Install the downloaded file through DSH Plugin Manager, or replace the path below and run the DSH CLI. These examples target the `web` profile. To target `desktop` from the Desktop CLI, first open Desktop once to initialize it, then fully quit Desktop before running plugin commands:

```text
dsh plugin --profile web add <absolute-path-to-downloaded.tgz>
```

The archive includes the browser bundle and needs no local build. The package's `dsh.bundle.patch` mounts the Host; DSH discovers the Client from its manifest. Disable the bundle to stop both automatic continuation and reminders. To remove the public package:

```text
dsh plugin --profile web remove dsh-model-interruption-notifier
```

Do not enable this package alongside the old `@local/dsh-model-interruption-notifier`: both use the same Host plugin ID and Session projection. Remove or disable the old bundle before enabling the public one. Ordinary installations of this public package do not need the old local package.

## Behavior

The default-on **Automatically continue** switch is available in plugin details. Saving a change updates the Host preference immediately. The Host submits one `继续` message for each new failed turn after that conversation becomes idle. If that next turn also fails, it can trigger another continuation; there is no attempt limit or backoff. Continued inference can consume model quota. Disable automatic continuation for persistent errors.

With the switch off, a bottom-right reminder shows the conversation title and error message. **Confirm and continue** submits `继续`; **Later** or Escape while focus is inside the card hides that failure until the page reloads. New failures remain eligible. The card does not take focus. Pending questions take priority in the same corner.

Only recorded errors that end a turn qualify. Normal completion, manual cancellation, and intermediate request retries do not. A new turn or user message clears the failure. Ordinary forked conversations qualify; delegated subagents do not. Manual confirmation rechecks the failure sequence and running state. A rejected submission displays the error without resending it.

Automatic continuation runs without an open page. Loading the plugin does not resume historical failures. Live reminders require a connected page, and dismissal state lasts only for that mounted page. Process crashes and network loss without a recorded turn error cannot trigger this plugin. Browser appearance and real pointer interaction require a separate connected-browser check.

## Data and model effects

The plugin extracts the failed turn's sequence, time, error message, and error code into a DSH Session projection. The frontend reads conversation titles and running status. It adds no tools, system-prompt text, external reporting endpoint, or independent credential store.

Submitting `继续` starts normal inference with the original conversation's model provider and context. Titles and error messages can contain private project names, paths, or provider diagnostics. Use synthetic conversations for screenshots, bug reports, and public demonstrations; do not publish runtime profiles or Session logs with the source.

## Develop

Run these commands from the cloned repository:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm test
```

The [build script](https://github.com/MeirinRuan/dsh-model-interruption-notifier/blob/main/scripts/build.mjs) creates the ignored `lib/client.js`. Tests cover failed-turn selection, continuation admission, automatic continuation, and configuration registration against that browser artifact. They do not replace testing in a real DSH session.

The [Host](../host.mjs) uses Session projections and the Session controller. The [Client](https://github.com/MeirinRuan/dsh-model-interruption-notifier/blob/main/client.mjs) uses DSH slots, locale resources, Session acquisition, and native configuration forms. The [patch](../cordis.patch.yml) keeps the plugin independent of DSH core changes.

See [publishing](publishing.md) for release artifacts and market submission.
