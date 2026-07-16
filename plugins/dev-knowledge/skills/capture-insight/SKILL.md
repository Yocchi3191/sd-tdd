---
name: capture-insight
description: Use only when the user explicitly asks to preserve a design/test/process insight for reuse across projects — phrases like 「ナレッジ化して」「知見として残したい」「これ他プロジェクトでも使えそう、残しておいて」, or an explicit invocation of this skill/command. Does NOT fire from Claude passively judging conversation content as "generalizable" — capture always requires the user to ask for it first, never a Claude-initiated suggestion.
---

# Capture Insight

他プロジェクトでも通用する設計・テスト・プロセスの知見を `dev-knowledge` に蓄積するskill。ユーザーが明示的に依頼した時だけ動く — 会話を監視して「これは汎用的だ」とClaudeが自発的に判断し提案することはしない。

## Step 1: 発火判定

次のいずれかでのみ動く:

- ユーザーが「ナレッジ化して」「知見として残したい」など、保存の意図を自然言語で示した
- ユーザーがこのskillを明示的に呼び出した

これ以外(会話中の内容をClaudeが「汎用的そうだ」と自己判断しただけ)では動かない。

## Step 2: 知見を言語化する

直前の会話から、以下を一緒に整理する。曖昧な項目はユーザーに確認する。

- `domain`: `design` / `test` / `process` など。既存の `references/` 配下のディレクトリ名を優先し、無ければ新規に切る。
- `slug`: kebab-case の短い識別子。
- `description`: 一行要約。
- `tags`: 検索・分類用のキーワード配列。
- `origin`: **実プロジェクト名は書かない**。「ゲーム開発」「Webアプリケーション開発」のように抽象化した分野カテゴリ + 日付(例: `ゲーム開発 (2026-07)`)にする。
- 本文: 「原則」「なぜ」(具体的な失敗シナリオを添える)「どう適用するか」の3項目。

## Step 3: 確認

ファイルを書く前に、frontmatterと本文の最終案をユーザーに提示し、承認を得る。承認が無ければ書き込まない。

## Step 4: ファイル作成とINDEX追記

1. `references/<domain>/<slug>.md` を新規作成する(このskillが属する `dev-knowledge` プラグインのルート相対)。フォーマット:

```markdown
---
name: <slug>
description: <一行要約>
domain: <domain>
tags: [...]
origin: <抽象化した分野カテゴリ> (<日付>)
---

**原則**: ...
**なぜ**: ...
**どう適用するか**: ...
```

2. `INDEX.md` の末尾に1行追記する: `- [<slug>](references/<domain>/<slug>.md): <description>`

## Step 5: commit・push

このプラグインのリポジトリで、変更したファイル(新規知見ファイルと `INDEX.md`)を `main` ブランチへ直接 commit・push する。新規ブランチや `gh pr create` によるPR作成は行わない — 知見追記は影響範囲が小さく、都度レビューを挟むコストに見合わないという判断による。

## Step 6: 報告

作成したファイルパスと `INDEX.md` への追記内容をユーザーに報告する。
