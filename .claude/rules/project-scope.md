# Налаштування Claude — лише на рівні проєкту

Усі налаштування Claude Code для цієї роботи живуть **у репозиторії**, а не в профілі користувача.
Причина: харнес — частина доказів capstone і має відтворюватися з `git clone`; глобальні зміни
невидимі в репо і впливають на інші проєкти людини.

| Що | Куди | Не сюди |
|---|---|---|
| Skills | `.claude/skills/<name>/` (+ `SOURCE.md` для сторонніх) | `~/.claude/skills/`, `npx skills add -g` |
| MCP-сервери | `.mcp.json` + `enabledMcpjsonServers` у `.claude/settings.json` | `~/.claude.json`, `claude mcp add` без `--scope project` |
| Hooks, permissions, plugins, env | `.claude/settings.json` (спільне, комітиться) | `~/.claude/settings.json` |
| Особисте й секрети | `.claude/settings.local.json` (gitignored) | будь-який закомічений файл |
| Субагенти | `.claude/agents/` | `~/.claude/agents/` |
| Правила | `CLAUDE.md`, `.claude/rules/` | `~/.claude/CLAUDE.md` |

- Файли в `~/.claude/` і `~/.claude.json` агент **не редагує**. Читати — лише щоб діагностувати конфлікт, і сказати про це людині.
- Якщо інструкція (скіл, README, документація) пропонує глобальне встановлення — виконати проєктний еквівалент і назвати відхилення.
- Будь-яка зміна з цієї таблиці — зміна харнесу: показати дифф і чекати «так» перед комітом.
