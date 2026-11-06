# DSH Model Interruption Notifier

English | [中文](README.zh.md)

Continue a DSH conversation after a failed model run, automatically or after confirmation in a corner reminder. Automatic continuation is enabled by default and submits the exact text `继续` through the original conversation's normal prompt path.

The plugin also provides a live switch in its detail page. It follows the DSH theme and excludes delegated subagents.

## Documentation

- [Installation, behavior, privacy, and development](docs/guide.md)
- [GitHub releases and dsh-market listing](docs/publishing.md)
- [MIT license](LICENSE)

The plugin uses DSH extension services and ships no game logic, company integrations, account configuration, or conversation data. Continuing a conversation uses its existing model provider and context; the plugin adds no separate reporting endpoint.
