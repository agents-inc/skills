# Research Methodology - Reference

> Lookup only. Decisions and red flags are in [SKILL.md](SKILL.md); full shapes are in [examples/core.md](examples/core.md).

---

## What each search skips

What a Claude Code search could not see, and how to tell that a result is partial.

- **Grep tool** — skips files matched by `.gitignore`, so generated code, build output and installed dependencies do not appear; to search one of them, pass its path directly. Patterns are ripgrep regex, not POSIX: `interface{}` is written `interface\{\}`. Output is file paths by default; `content` adds the matching lines with line numbers, and stops at the tool's result limit; `count` gives per-file counts and a total that covers every match even when the per-file list is cut short.
- **Glob tool** — applies no `.gitignore` filtering by default, so it lists dependency and build-output files the Grep tool never searches. Results are sorted by modification time, not relevance, and capped at 100 files; a truncation flag in the result means the list is partial.
- **Read tool** — one call returns at most 25,000 tokens by default. A longer file comes back as its first page with a `PARTIAL view` notice; read the rest with `offset` and `limit`, or search it with Grep. The returned contents carry line numbers, which is where a cited range comes from.
- **`rg` in a shell** — skips `.gitignore`, `.ignore` and `.rgignore` matches, hidden files and directories, and binary files, and does not follow symlinks. `-u` stops honouring ignore files, `-uu` adds hidden files, `-uuu` adds binary files; `--debug` says why a file was skipped.

Older Claude Code builds behaved differently in ways that turn an error into a false absence:

- Before v2.1.208, a pattern ripgrep rejected came back as `No files found`, and a `count` total summed only the entries listed.
- Before v2.1.292, Grep and Glob reported no matches for a file or folder they could not read.

---

## Which tools a session has

- **Glob and Grep** — on macOS, Linux and WSL, Claude Code leaves both out of the default tool set, and searches run as `find` and `grep` through the Bash tool. A subagent gets the two tools back by listing `Glob` or `Grep` in its `tools` and leaving out `Bash`. On Windows both are in the default set.
- **LSP** — go to definition, find references, find implementations and trace call hierarchies through a language server. It stays inactive until a code-intelligence plugin for the language is installed, and always in cloud sessions.

---

## Pre-report checklist

- [ ] Every path in the findings was opened in this session; a path seen only in a search result is listed under Gaps as not read
- [ ] Related patterns the question touches were searched for — other names, other packages — not only the first match, which is one instance rather than the convention
- [ ] Every claim carries the file, the line range and the symbol
- [ ] Every count names the search behind it, run in count mode
- [ ] Every absence names its search, its control, and what the search could not see
- [ ] Every claim that failed verification is out of the findings and listed under Gaps
- [ ] The findings answer the question asked; nothing outside it is presented as a finding
- [ ] Files to Reference is ranked
- [ ] No implementation code — existing files to follow instead
- [ ] Gaps and inconsistencies are listed, or "none" is written
- [ ] The report uses the shape the instructions give, or the template in [examples/core.md](examples/core.md#pattern-3-structured-findings)
