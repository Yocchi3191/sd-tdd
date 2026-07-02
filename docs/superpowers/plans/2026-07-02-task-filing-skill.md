# task-filing スキル実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `spec-interview`からトラッカー（GitHub issue）への読み書き責務を切り出し、独立した`task-filing`スキルとして実装する。

**Architecture:** `spec-interview`は対話でREQ台帳を確定させるだけの純粋な対話スキルにし、`gh issue`系コマンドは一切呼ばない。新設の`task-filing`スキルが「台帳取得」「新規起票」「追記」の3操作を担い、`task-template.md`というフォーマットに沿って`gh issue create`/`gh issue edit`を実行する。

**Tech Stack:** Claude Codeプラグインスキル（Markdown + frontmatter）。コード実装は伴わない。`gh` CLIを利用。

## Global Constraints

- REQ-N行はspec-interviewが確定した文言を一字一句そのまま転記する。書き換え・要約は禁止（`plugins/sd-tdd/scripts/coverage-check/parse.js`の`REQ_LINE_RE = /^REQ-(\d+):\s*(.+)$/gm`が行頭の`REQ-<N>:`パターンを本文全体からグレップするため、この正規表現にマッチする形を崩してはならない）
- `task-filing`は起票先ツール名（GitHub等）をskill名・description文に固定しない。デフォルト実装は`gh` CLIのみ
- 既存の`spec-to-tests`・`coverage-check`のコード（`plugins/sd-tdd/scripts/coverage-check/*.js`）は変更しない

---

### Task 1: `spec-interview` を改修してトラッカー非依存にする

**Files:**
- Modify: `plugins/sd-tdd/skills/spec-interview/SKILL.md`

**Interfaces:**
- Consumes: なし（対話スキル。ユーザー入力のみ）
- Produces: 確定したREQ台帳（会話内テキスト）。`task-filing`スキルへ「台帳確定、記録してほしい」という形でハンドオフする。継続タスクの場合は`task-filing`の「台帳取得」操作を呼び出し、返ってきた既存本文から`REQ-<id>:`行の最大番号を読み取って次の採番に使う

- [ ] **Step 1: 現状のSKILL.mdを確認し、変更点を洗い出す**

対象ファイル: `plugins/sd-tdd/skills/spec-interview/SKILL.md`（現状56行）。変更点は以下の4箇所：

1. frontmatterの`description`: 「recorded on a GitHub issue」という記述を削除し、`task-filing`へのハンドオフに言及する形に変える
2. Step 1: `gh issue view`の直接呼び出しをやめ、「継続タスクなら`task-filing`に台帳取得を依頼する」に変える
3. Step 4（`gh issue create`/`gh issue edit`で書き込む部分）: 丸ごと削除する
4. 旧Step 5（承認取得）: 番号を新Step 4に繰り上げ、ハンドオフ文言を「`task-filing`を呼んで記録してもらう」に変更する

- [ ] **Step 2: SKILL.md を書き換える**

`plugins/sd-tdd/skills/spec-interview/SKILL.md` の全文を以下に置き換える：

```markdown
---
name: spec-interview
description: Use when a feature or bug request has no structured, testable requirements yet — before any test or code is written. Interviews the user one question at a time and converts a vague request into a numbered, falsifiable REQ ledger, then hands it to `task-filing` to be recorded. Also use to append newly discovered requirements to an existing ledger during implementation.
---

# Spec Interview

Converts a vague request into a REQ ledger — the only record of "what we believed, when." No separate spec document is ever created; this ledger plus the tests it produces (via `spec-to-tests`) are the whole spec.

This skill never talks to a tracker directly. Reading and writing the ledger's home (a GitHub issue, or whatever the project uses) is `task-filing`'s job.

## Step 1: Check for an existing ledger

If this is a continuation of an existing task, invoke `task-filing`'s "fetch ledger" operation for that task and read the `REQ-` lines it returns. This is an **append session**: new items become `REQ-<max+1>`, `REQ-<max+2>`, ... Existing lines are never rewritten. If you're correcting or replacing an old REQ, append a new one and add `[superseded by REQ-<new id>]` to the old line — don't edit its original text otherwise.

If there's no existing task, this is a fresh interview; the ledger starts at `REQ-1`.

## Step 2: Interview one question at a time

- Ask one question per message. Prefer multiple choice.
- Each REQ must be a single falsifiable fact — one behavior, one expected outcome. Split anything joined by "and"/"or" into separate REQs.
- Push back on vagueness. "Handle errors gracefully" is not a REQ. "If the input is empty, return a 400 with message X" is.
- Keep asking until you can write the whole feature as a list of REQ lines with no ambiguity left.

## Step 3: Decide where the "why" goes

Default: leave rationale for the test code (`spec-to-tests` will embed it as a comment or in the test name). Only write the rationale directly into a REQ line when at least one of these holds:

1. It requires explaining an alternative that was considered and rejected.
2. It depends on context the code can't reveal (a stakeholder ask, a compliance rule, a specific past incident).
3. It can't be stated in one sentence.

## Step 4: Get explicit approval, then hand off

Show the user the final REQ list before handing off — do not write it anywhere yourself, and do not run any tracker command. Once approved, tell them: "REQ ledger confirmed. Next: invoke `task-filing` to record it (new task, or append if this was a continuation of an existing one), then run `test-infra-setup` (if not already done for this project) and `spec-to-tests`."
```

- [ ] **Step 3: 変更内容を検証する**

以下を目視確認する（コードではないため自動テストはない）：

- `gh`という文字列がファイル中に一切残っていないこと
- `REQ-<max+1>`という表記のように、既存の採番ルール説明が失われていないこと
- Step番号が1〜4で連番になっていること

確認コマンド：
```bash
grep -n "gh " plugins/sd-tdd/skills/spec-interview/SKILL.md
```
Expected: 出力なし（`gh`コマンドへの直接言及が無いこと）

- [ ] **Step 4: Commit**

```bash
git add plugins/sd-tdd/skills/spec-interview/SKILL.md
git commit -m "refactor: spec-interviewからトラッカー操作を分離してtask-filingへ委譲"
```

---

### Task 2: `task-filing` スキルを新規作成する

**Files:**
- Create: `plugins/sd-tdd/skills/task-filing/SKILL.md`
- Create: `plugins/sd-tdd/skills/task-filing/task-template.md`

**Interfaces:**
- Consumes: `spec-interview`から渡される確定済みREQ台帳（会話内テキスト）、および該当タスクの背景・要件などの文脈
- Produces:
  - 「台帳取得」操作の戻り値 = 指定タスクの現在の本文（`spec-interview`のStep 1が消費する）
  - 「新規起票」操作の戻り値 = 作成したissue番号
  - 「追記」操作の戻り値 = 更新したissue番号と追記件数

- [ ] **Step 1: `task-template.md` を作成する**

`plugins/sd-tdd/skills/task-filing/task-template.md` を新規作成し、以下の内容にする：

```markdown
## 背景・課題
<!-- なぜこのタスクが必要か。問題・背景・きっかけ -->

## やること・要件
<!-- REQ台帳をそのまま転記する。書き換え・要約は禁止 -->
REQ-1: ...
REQ-2: ...

## 完了条件
<!-- 何をもって完了とするか。受け入れ基準・確認方法 -->

## 決定事項（任意・該当する場合のみ）
<!-- 検討した代替案と、それを採用しなかった理由 -->

## 設計・実装方針（任意・該当する場合のみ）
<!-- 具体的な変更対象ファイルやアプローチ -->

## 注意点・既知のトレードオフ（任意・該当する場合のみ）
<!-- あえてやらないこと、既知のリスク -->
```

- [ ] **Step 2: `SKILL.md` を作成する**

`plugins/sd-tdd/skills/task-filing/SKILL.md` を新規作成し、以下の内容にする：

```markdown
---
name: task-filing
description: Use after spec-interview has confirmed a REQ ledger (new or appended) — records it into the project's tracker (GitHub issue by default) using this skill's task-template.md. Also use to fetch a task's current ledger when spec-interview is continuing work on an existing task. Never rewords or summarizes REQ lines; they are transcribed verbatim.
---

# Task Filing

Owns all reads and writes to the project's task tracker. `spec-interview` decides *what* the REQ ledger says; this skill decides *where and how* it gets recorded, using `task-template.md` so every filed task carries enough context for anyone to pick it up.

Default tracker: GitHub issues via the `gh` CLI. Nothing here hardcodes "GitHub" in the skill's purpose — a future tracker backend would only need new commands in the three operations below, not a rewrite of `spec-interview`.

## Operation: Fetch current ledger

Called by `spec-interview` at the start of an append session, before asking any interview questions.

```bash
gh issue view <N> --json body -q .body
```

Return the raw body text to the caller. `spec-interview` parses the `REQ-<id>:` lines itself.

## Operation: File a new task

1. Read `task-template.md` (this skill's directory) and fill it in:
   - **背景・課題**, **やること・要件**, **完了条件** are required — always fill them.
   - Copy the confirmed REQ-N lines into **やること・要件** verbatim — do not reword, summarize, or renumber them.
   - **決定事項**, **設計・実装方針**, **注意点・既知のトレードオフ** are optional — include a section only when it's actually relevant to this task; don't leave empty headers.
2. Create the task:

```bash
gh issue create --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

3. Report back to the caller: "Task filed as issue #<N>."

## Operation: Append to an existing task

1. Fetch the current body (see "Fetch current ledger" above).
2. Append the new `REQ-<max+1>:`, `REQ-<max+2>:`, ... lines to the end of the **やること・要件** section, after the existing ones. Never remove or reword existing lines.
3. If the caller provided updates to any optional section (背景・課題, 完了条件, 決定事項, 設計・実装方針, 注意点・既知のトレードオフ), apply those too — otherwise leave the rest of the body untouched.
4. Update the task:

```bash
gh issue edit <N> --body "$(cat <<'EOF'
<updated full body>
EOF
)"
```

5. Report back to the caller: "Task #<N> updated with <count> new REQ line(s)."

## Constraint: REQ lines are verbatim

`spec-to-tests` and `coverage-check` locate requirements by grepping the task body for lines matching `^REQ-(\d+):\s*(.+)$` (see `plugins/sd-tdd/scripts/coverage-check/parse.js`). This regex only cares about the line itself, not which section heading it sits under — so reordering surrounding prose is safe, but editing the text of a `REQ-<id>:` line is not. If a REQ turns out to be wrong, `spec-interview` supersedes it with a new line; this skill never edits an existing REQ line's text.
```

- [ ] **Step 3: フォーマットの互換性を確認する**

`task-filing`が生成する本文が既存の`coverage-check`パーサと噛み合うことを確認する。

```bash
cat plugins/sd-tdd/scripts/coverage-check/parse.js
```

Expected: `REQ_LINE_RE = /^REQ-(\d+):\s*(.+)$/gm` が行頭の`REQ-<N>:`パターンのみに依存しており、見出し名（`## Requirements` から `## やること・要件` への変更）に依存していないことを確認する。依存していれば`task-template.md`の見出し名を`## Requirements`に戻す必要があるが、現状のコードは行単位の正規表現のみなので変更不要と判断する。

- [ ] **Step 4: `spec-to-tests`・`coverage-check` のSKILL.mdとの整合性を確認する**

```bash
grep -n "gh issue" plugins/sd-tdd/skills/spec-to-tests/SKILL.md plugins/sd-tdd/skills/coverage-check/SKILL.md
```

Expected: 両ファイルとも`gh issue view <N> --json body -q .body`でissue本文を読むだけで、書き込みは行っていないことを確認する（書き込み元が`spec-interview`から`task-filing`に変わっても、読み取り側のこれらのスキルは無改修で動く）。差異があれば、このタスクの計画内で追記修正する（現時点の設計では変更不要と判断済み）。

- [ ] **Step 5: Commit**

```bash
git add plugins/sd-tdd/skills/task-filing/
git commit -m "feat: task-filingスキルを追加し、issue起票をspec-interviewから分離"
```

---

## 次のステップ（本計画のスコープ外）

- ルート`CLAUDE.md`の文言更新（PR #9対応）は、本計画のTask 1〜3が完了し`feature/task-filing-skill`ブランチがmainにマージされた後に、別途`docs/add-claude-md`ブランチで対応する
