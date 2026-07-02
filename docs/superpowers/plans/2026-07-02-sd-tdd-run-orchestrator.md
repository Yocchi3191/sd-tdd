# sd-tdd:run オーケストレーターskill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sd-tddパイプライン(test-infra-setup → spec-interview → task-filing → spec-to-tests → coverage-check → superpowers:test-driven-development)を単一の入口から自動的に進行させる、新規オーケストレーターskill `sd-tdd:run` を追加する。

**Architecture:** `plugins/sd-tdd/skills/run/SKILL.md` として新規skillを1つ追加する。既存5skillの判定ロジック・出力形式は一切変更せず、`Skill`ツールで順に呼び出す手順書として振る舞う。既存3skill(`spec-interview`, `spec-to-tests`, `coverage-check`)からは「単なる次段案内」のプローズのみ削り、`sd-tdd:run`が唯一の情報源になるようにする。`CLAUDE.md`のエントリポイント記述も`sd-tdd:run`に更新する。

**Tech Stack:** Markdownベースのskill定義のみ(新規コード・スクリプトは追加しない)。

## Global Constraints

- 既存5skill(`spec-interview`, `task-filing`, `spec-to-tests`, `coverage-check`, `test-infra-setup`)の判定ロジック・出力形式・ゲート条件は変更しない — 変更は「単なる次段案内」のプローズ削除のみ
- 新規スクリプト・新規テストコードは追加しない(このskillはコード資産を持たない)
- 呼び出し名は `sd-tdd:run`(plugin名:skill名記法)、skill自体の`name`フィールドは `run`
- 自動進行は「ほぼ全自動」— 停止するのは`spec-interview`内の既存REQ承認ゲートのみ。それ以外(test-infra-setupのCI変更・依存追加、task-filingのissue作成/更新、coverage-check失敗時のspec-to-testsへの差し戻しループ、coverage-check通過後のtest-driven-developmentへの引き継ぎ)はユーザー確認なしで進める
- 参照設計doc: `docs/superpowers/specs/2026-07-02-sd-tdd-run-orchestrator-design.md`

---

### Task 1: `sd-tdd:run` skill本体の新規作成

**Files:**
- Create: `plugins/sd-tdd/skills/run/SKILL.md`

**Interfaces:**
- Consumes: 既存5skillの呼び出し名(`test-infra-setup`, `spec-interview`, `task-filing`, `spec-to-tests`, `coverage-check`)と`superpowers:test-driven-development`、および`spec-to-tests`/`task-filing`が既に使っている`gh issue view <N> --json body -q .body`パターン、`coverage-check`skillが定義する`node scripts/coverage-check/cli.js --issue <N> --tests <path>`コマンド
- Produces: skill呼び出し名 `sd-tdd:run`(Task 5でCLAUDE.mdから参照される)

- [ ] **Step 1: SKILL.mdを作成する**

以下の内容で `plugins/sd-tdd/skills/run/SKILL.md` を作成する。

```markdown
---
name: run
description: Use this first for any task in this project that adds, modifies, or deletes files — new features, bug fixes, refactors. This is the entry point and auto-driving orchestrator for the sd-tdd pipeline: test-infra-setup → spec-interview → task-filing → spec-to-tests → coverage-check → superpowers:test-driven-development. Also use to resume in-progress sd-tdd work on an existing GitHub issue (e.g. "issue #12の続き"). Do NOT use for read-only questions, explanations, or analysis that touches no files.
---

# sd-tdd:run

Drives the whole sd-tdd pipeline end to end so nobody has to remember which of the five sd-tdd skills to invoke next, or in what order. This skill calls the other five (`test-infra-setup`, `spec-interview`, `task-filing`, `spec-to-tests`, `coverage-check`) and `superpowers:test-driven-development` via the `Skill` tool, in sequence, automatically — the only place this flow stops for user input is the REQ ledger approval gate that already exists inside `spec-interview`.

This skill owns no logic of its own beyond sequencing and resume-point detection. It never writes a REQ, generates a test, or edits an issue directly — it only decides *which* skill to call *next*.

## Step 1: Determine new task vs. resume

- If the user's request references an existing issue number (e.g. "issue #12", "#12の続き"), this is a **resume** — go to "Resuming an existing issue" below with that issue number.
- Otherwise, this is a **new task** — go to "Starting a new task" below.
- If it's genuinely ambiguous (the request could plausibly be either), ask the user once which issue number to resume, or confirm it's new.

## Step 2: Track progress with TodoWrite

Before starting either path, create a TodoWrite list with these 6 items (mark items already satisfied as `completed` immediately when resuming — see below):

1. test-infra-setup — テスト基盤・mutation testing基盤の確認/導入
2. spec-interview — REQ台帳の作成・承認
3. task-filing — issueへの記録
4. spec-to-tests — REQごとの失敗テスト生成
5. coverage-check — REQとテストの対応検証
6. 実装への引き継ぎ — superpowers:test-driven-development

Mark each `in_progress` right before invoking the corresponding skill, and `completed` right after it returns successfully. Give one short status line between stages (e.g. "REQ台帳を確定、issue #14として起票しました。次にテストを生成します。") — this is a status update, not a checkpoint; do not wait for a response before continuing to the next stage, except at the approval gate noted below.

## Starting a new task

1. Invoke the `test-infra-setup` skill. It is idempotent — if the project already has a test framework and mutation-testing tool wired up, it reports so and does nothing further.
2. Invoke the `spec-interview` skill to interview the user and build the REQ ledger. **This is the only stopping point in the whole flow** — `spec-interview` itself asks the user to approve the final REQ list before handing back. Wait for that approval; do not skip it or approve on the user's behalf.
3. Once `spec-interview` reports the REQ ledger confirmed, invoke `task-filing`'s new-task operation to record it as a GitHub issue. Note the issue number `N` from its "Task filed as issue #N" response — every later step needs it.
4. Invoke `spec-to-tests` for issue `N`. It reads the ledger itself via `gh issue view` — you don't need to pass it anything beyond the issue number.
5. Invoke `coverage-check` for issue `N` (see "Running coverage-check" below for the exact command and how to interpret its result).
   - If it reports missing REQs: invoke `spec-to-tests` again, tell it which REQ-IDs are missing, then re-run `coverage-check`. Repeat until it passes. Do not ask the user before looping — this is the mechanical retry the design calls for.
   - If it reports orphan tests (tests referencing REQ-IDs not in the ledger): follow coverage-check's own guidance (invoke `spec-interview` to draft the missing REQ + `task-filing` to append it, or fix/remove the stray test), then re-run `coverage-check`.
6. Once `coverage-check` passes cleanly, invoke `superpowers:test-driven-development` to begin implementation against the now-failing tests. Tell it which issue/REQ-IDs it's implementing against.

## Resuming an existing issue

Given issue number `N`:

1. Fetch the ledger: `gh issue view <N> --json body,state -q .body`. If the command fails or the issue has no `REQ-<id>:` lines, treat this as if no ledger exists yet: mark TodoWrite item 1 `completed` (test infra is gated lazily by `spec-to-tests` itself, no need to re-run it here), invoke `spec-interview` telling it this is a continuation of issue `N`, then once approved invoke `task-filing`'s **append** operation (not the new-task operation) for issue `N`, then continue the new-task sequence from its step 4 onward using issue `N`.
2. If a ledger exists, detect the test directory (see "Detecting the test directory" below), then run coverage-check (see "Running coverage-check" below) for issue `N`.
3. Interpret the result:
   - **coverage-check reports missing REQs, or the test directory has no `issue-<N>_REQ-` matches at all**: mark TodoWrite items 1–3 `completed`, item 4 `in_progress`, and invoke `spec-to-tests` for issue `N`, then continue the new-task sequence from its step 5 (`coverage-check`) onward.
   - **coverage-check passes cleanly**: mark TodoWrite items 1–5 `completed`, and go straight to "Starting a new task" step 6 (invoke `superpowers:test-driven-development`).

## Detecting the test directory

Needed before invoking `coverage-check`. Check, in order, for the first that exists in the project:

1. A directory literally named `test/`, `tests/`, `__tests__/`, or `spec/` at the project root or under `src/`.
2. Files matching `**/*.test.*` or `**/*.spec.*` anywhere in the project (use their common parent directory, or pass the glob root if they're scattered next to source files).

If none of these resolve to an unambiguous single path (e.g. multiple candidate directories with test files in different frameworks), ask the user once which directory to pass to `coverage-check`.

## Running coverage-check

\`\`\`bash
node scripts/coverage-check/cli.js --issue <N> --tests <test-directory>
\`\`\`

Run from the sd-tdd plugin root. Exit 0 with no missing/orphan output means every active REQ has a test — proceed. Exit 1 with "Missing tests for: ..." means go back to `spec-to-tests` for exactly those REQ-IDs. See the `coverage-check` skill for full output semantics.
```

- [ ] **Step 2: 内容をセルフレビューする**

以下を確認する(問題があれば同じステップ内で直接修正する):

- `description`に「ファイル変更を伴わないタスクでは発火しない」除外文言が入っているか
- 停止ポイントが「spec-interviewのREQ承認ゲート」の1箇所のみと明記されているか
- 新規タスク・再開タスクの両方で、既存5skillの名前・操作(`task-filing`の new/append/fetch、`coverage-check`のCLIコマンド)が設計doc・既存skillの実際の記述と一致しているか
- TBD/TODO等のプレースホルダーが無いか

- [ ] **Step 3: コミットする**

```bash
git add plugins/sd-tdd/skills/run/SKILL.md
git commit -m "feat(sd-tdd): add sd-tdd:run orchestrator skill as pipeline entry point"
```

---

### Task 2: `spec-interview` から次段案内のプローズを削る

**Files:**
- Modify: `plugins/sd-tdd/skills/spec-interview/SKILL.md`

**Interfaces:**
- Consumes: なし(既存ファイルの一部プローズ削除のみ)
- Produces: なし(振る舞い・ゲート条件は無変更)

- [ ] **Step 1: 該当箇所を編集する**

現在の最終段落(Step 4内):

```markdown
Show the user the final REQ list before handing off — do not write it anywhere yourself, and do not run any tracker command. Once approved, tell them: "REQ ledger confirmed. Next: invoke `task-filing` to record it (new task, or append if this was a continuation of an existing one), then run `test-infra-setup` (if not already done for this project) and `spec-to-tests`."
```

これを次に置き換える(`task-filing`への言及は「自分の仕事を完了させる」ための本物の依存なので残し、その先の`test-infra-setup`/`spec-to-tests`への言及のみ削る):

```markdown
Show the user the final REQ list before handing off — do not write it anywhere yourself, and do not run any tracker command. Once approved, tell them: "REQ ledger confirmed. Next: invoke `task-filing` to record it (new task, or append if this was a continuation of an existing one)."
```

- [ ] **Step 2: 差分を確認する**

`git diff plugins/sd-tdd/skills/spec-interview/SKILL.md` を実行し、変更が上記の一文のみであることを確認する(ゲート条件・Step構成など他の内容は無変更のはず)。

- [ ] **Step 3: コミットする**

```bash
git add plugins/sd-tdd/skills/spec-interview/SKILL.md
git commit -m "refactor(sd-tdd): drop next-stage narration from spec-interview handoff"
```

---

### Task 3: `spec-to-tests` から次段案内のプローズを削る

**Files:**
- Modify: `plugins/sd-tdd/skills/spec-to-tests/SKILL.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: Step 7セクションを削除する**

現在ファイル末尾にある以下のセクション全体を削除する(Step 6の内容はそのまま残す):

```markdown
## Step 7: Hand off

Invoke `coverage-check` to mechanically verify every active REQ now has a test before implementation starts.
```

削除後、ファイルはStep 6の内容(「Expected: every new test FAILS with an assertion/not-implemented error — not a syntax error, import error, or setup crash. If it's failing for the wrong reason, fix the test itself before moving on.」)で終わる形になる。

- [ ] **Step 2: 差分を確認する**

`git diff plugins/sd-tdd/skills/spec-to-tests/SKILL.md` を実行し、Step 7セクションのみが削除されていることを確認する。Step 0(test-infra-setupへの前提条件チェック)やStep 4-5(spec-interview/task-filingへの新規REQ発見時の参照)は本物の依存として残っていることを確認する。

- [ ] **Step 3: コミットする**

```bash
git add plugins/sd-tdd/skills/spec-to-tests/SKILL.md
git commit -m "refactor(sd-tdd): drop next-stage narration from spec-to-tests handoff"
```

---

### Task 4: `coverage-check` から次段案内のプローズを削る

**Files:**
- Modify: `plugins/sd-tdd/skills/coverage-check/SKILL.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: 該当箇所を編集する**

現在の記述:

```markdown
- **Exit 0, no output about missing/orphans:** every active REQ has a test. Proceed — hand off to `superpowers:test-driven-development` to implement against the now-failing tests.
```

これを次に置き換える:

```markdown
- **Exit 0, no output about missing/orphans:** every active REQ has a test.
```

- [ ] **Step 2: 差分を確認する**

`git diff plugins/sd-tdd/skills/coverage-check/SKILL.md` を実行し、変更が上記の一文のみであることを確認する。「missing tests」「orphan tests」時の`spec-to-tests`/`spec-interview`+`task-filing`への言及(自分の失敗結果を解釈するために必要な本物の依存)はそのまま残っていることを確認する。

- [ ] **Step 3: コミットする**

```bash
git add plugins/sd-tdd/skills/coverage-check/SKILL.md
git commit -m "refactor(sd-tdd): drop next-stage narration from coverage-check success message"
```

---

### Task 5: CLAUDE.mdのエントリポイント記述を更新する

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1で作成した `sd-tdd:run` という呼び出し名
- Produces: なし

- [ ] **Step 1: 該当箇所を編集する**

現在の記述:

```markdown
# 作業ルール

- ファイルの追加・更新・削除が必要なタスクは、着手前にissueを作成すること。`spec-interview`でREQ台帳を確定させ、`task-filing`で起票する。
```

これを次に置き換える:

```markdown
# 作業ルール

- ファイルの追加・更新・削除が必要なタスクは、着手前に `sd-tdd:run` を起動すること。内部で `spec-interview` によるREQ台帳確定・`task-filing` によるissue起票が自動的に行われる。
```

- [ ] **Step 2: 差分を確認する**

`git diff CLAUDE.md` を実行し、意図した一文のみが変わっていることを確認する。

- [ ] **Step 3: コミットする**

```bash
git add CLAUDE.md
git commit -m "docs: update entry-point rule to point at sd-tdd:run"
```

---

### Task 6: エンドツーエンドのドライラン検証

**Files:**
- なし(検証のみ。ただし検証中に一時的なGitHub issueを作成し、最後にcloseする)

**Interfaces:**
- Consumes: Task 1-5で完成した `sd-tdd:run` および3つの既存skillの更新後の状態
- Produces: なし

このタスクはコード変更を伴わないため、TDDのステップ構造ではなく手動検証手順として進める。

- [ ] **Step 1: 新規タスクのフローをドライランする**

このリポジトリ上で、`[smoke-test]`と分かるタイトルのダミーの小機能要望(例: 「文字列を大文字にするユーティリティ関数を追加して」)を実際に投げ、`sd-tdd:run`を起動する。次を確認する:

- `test-infra-setup` → `spec-interview`(承認待ちで1回だけ止まる)→ `task-filing` → `spec-to-tests` → `coverage-check` → `superpowers:test-driven-development` の順で、REQ承認以外に確認を挟まず自動的に連鎖すること
- TodoWriteの6項目が順に`in_progress`→`completed`になること
- 生成されたissueのタイトルに `[smoke-test]` が含まれ、後で判別・削除できること

- [ ] **Step 2: 既存issue再開のフローをドライランする**

Step 1で作成されたissue番号を使い、「issue #<N>の続き」のような発話で再度`sd-tdd:run`を起動し、coverage-check通過済みであれば`superpowers:test-driven-development`へ直行すること(spec-interview/task-filing/spec-to-testsが再実行されないこと)を確認する。

- [ ] **Step 3: 問題があれば該当タスクに戻って修正する**

Step 1-2で意図通りに動かなかった箇所があれば、Task 1-4の該当ファイルを修正し、再度Step 1-2を実施する。

- [ ] **Step 4: スモークテスト用のissueとテストコードを片付ける**

```bash
gh issue close <N> --comment "sd-tdd:runのドライラン検証用issueのためclose"
```

Step 1で実装フェーズに入って生成された可能性のあるスモークテスト用のソース・テストファイルがあれば削除し、`git status`が汚れていないことを確認する。

- [ ] **Step 5: 検証結果をコミットする(変更があれば)**

Step 3で修正が発生した場合のみ、その修正差分をコミットする(Task 1-4のコミットメッセージ規約に従う)。変更が無ければこのステップは不要。
