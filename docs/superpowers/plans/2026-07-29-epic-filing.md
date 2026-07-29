# epic-filing スキル実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 企画・アイデアレベルの依頼をepic-issueとして起票し、実装をこなすための作業タスク（従来通りの起票物）をtask-issueとしてそのsub-issueに紐づける新規skill `epic-filing` を追加する。既存の `spec-interview` Step4の「sub issue split」判断を `epic-filing` 呼び出しに統合し、判断ロジックの重複を排除する。

**Architecture:** `epic-filing` が2つの入口（run経由/直接発話でのゼロベース起票、`spec-interview` Step4からの事後発覚）を持つ判定・ヒアリング・分解・起票の統一スキルとなる。`task-filing` には既存の「File a split as sub issues」を置き換える形で「File a task under a parent epic」operationを追加する。`run` はsequencing方針を維持しつつ、Step 1の新規task判定を `epic-filing` に委譲する。

**Tech Stack:** Claude Codeプラグインスキル（Markdown + YAML frontmatter）。コード実装は伴わない。`gh` CLI / `gh-sub-issue` extensionを利用。振る舞いの検証は各skillディレクトリの `evals/evals.json`（このプロジェクト独自の振る舞いテスト形式）に記述する。

## Global Constraints

- REQ-N行の検出フォーマット `^REQ-(\d+):\s*(.+)$`（`plugins/sd-tdd/scripts/coverage-check/parse.js` の `REQ_LINE_RE`）は変更しない。
- epic-issueの本文には `REQ-<id>:` 形式の行を一切含めない — `spec-to-tests` / `coverage-check` がREQ行として誤検出しないようにするため（design doc「既存スキルとの整合性」節）。
- `gh-sub-issue` extensionの確認・インストール手順は既存 `task-filing` のパターン（`gh extension list | grep -q sub-issue || gh extension install yahsan2/gh-sub-issue`、失敗時は手動インストールを促して停止）をそのまま踏襲する。
- epicラベルは `gh label list --search epic` で確認し、無ければ `gh label create epic` で作成してから使う。
- `evals.json` の `id` は各ファイル内で0始まりの連番とし、既存ケースの末尾に追記する（既存IDは変更しない。ただしrunの既存id=4は仕様変更に伴い内容を書き換える — Task 4参照）。
- 設計は `docs/superpowers/specs/2026-07-29-epic-filing-design.md` に準拠する。

---

### Task 1: `epic-filing` スキルを新規作成する

**Files:**
- Create: `plugins/sd-tdd/skills/epic-filing/SKILL.md`
- Create: `plugins/sd-tdd/skills/epic-filing/epic-template.md`
- Create: `plugins/sd-tdd/skills/epic-filing/evals/evals.json`

**Interfaces:**
- Consumes:
  - Entry A: 生の依頼テキスト（`run` 経由、または「タスクを切って」等の直接発話）。既存epic issue番号が渡されればレジューム扱い。
  - Entry B: `spec-interview` から渡される、確定済みREQ台帳全文 + グループ→REQ-IDマッピング（独立した関心事の分割案）。
- Produces:
  - 単一task判定時: filed issue番号 `N`（`task-filing`「File a new task」の戻り値をそのまま中継）
  - 企画判定時: epic issue番号 `<epic-N>` と、そのsub-issueとして起票された各task-issue番号のリスト
  - `task-filing`「File a task under a parent epic」operationの呼び出し（Task 2で追加）

- [ ] **Step 1: `epic-template.md` を作成する**

`plugins/sd-tdd/skills/epic-filing/epic-template.md` を新規作成し、以下の内容にする:

```markdown
## 背景・課題
<!-- なぜこの企画が必要か。問題・機会・きっかけ -->

## ゴール・あるべき姿
<!-- この企画が達成したい状態。何のためにやるのか -->

## 成功指標・完了条件
<!-- 何をもって企画の完了・成功とするか -->

## スコープ外（任意）
<!-- 今回は扱わないこと -->

## 関連task-issue
<!-- gh sub-issueで親子関係が自動連携されるため参考情報。起票の都度追記 -->
- #<N>: <タスク名>

## 決定事項（任意）
<!-- 検討した代替案と、それを採用しなかった理由 -->

## 注意点・既知のトレードオフ（任意）
<!-- あえてやらないこと、既知のリスク -->
```

- [ ] **Step 2: `SKILL.md` を作成する**

`plugins/sd-tdd/skills/epic-filing/SKILL.md` を新規作成し、以下の内容にする:

```markdown
---
name: epic-filing
description: Use before spec-interview starts on a fresh, unfiled request — judges whether it describes a single concrete work item or a goal/idea spanning multiple independent work items. For a multi-item initiative, interviews the user on background/goal/success criteria, breaks it into task candidates, files an epic-issue, then runs spec-interview → task-filing per candidate as a sub-issue of the epic. Also triggers directly on phrases like "タスクを切って" / "issueにして" to file work without going through the full run pipeline — filing-only, no implementation follows. Also invoked by spec-interview's own Step 4 when REQ-gathering reveals the ledger actually covers independent concerns, instead of spec-interview filing a sub issue split itself. Resumable by passing an existing epic issue number.
---

# Epic Filing

企画・アイデアレベルの依頼を、目的・ゴール・成功指標を記述する epic-issue として起票し、それを実現する作業タスクは `spec-interview` → `task-filing` で通常どおり task-issue として起票したうえで、その epic-issue の sub-issue にする。単一の作業タスクだと判定した場合はepic化せず、そのまま `spec-interview` → `task-filing` に委譲して終わる。

このスキルは2つの入口を持つ。**Entry A**（`run` 経由、または「タスクを切って」のような直接発話からのゼロベース起票）と **Entry B**（`spec-interview` のStep4が対話中に独立した関心事を発見した場合の引き継ぎ）。

## Entry A: 依頼を直接受け取った場合

### Step A1: 単一taskか複数タスクの企画かを判定する

依頼文を見て判定する:

- 依頼が具体的な単一の実装対象（特定の機能・ファイル・バグ）を指している → **単一task**
- 依頼がゴール・テーマ止まりで実装対象が定まっていない、または明らかに複数の独立した関心事にまたがる → **企画**
- 判断に迷う場合は一度だけ確認する。例:「これは1つのまとまった変更ですか、それとも複数の独立した作業に分かれそうな大きめのテーマですか？」

**単一task と判定した場合**: このスキルはここで終わる。`spec-interview` を新規タスクとして呼び、確定したREQ台帳を通常の `task-filing`「File a new task」operationで記録する。epic-issueは作らない。呼び出し元に「単一taskとして起票した、issue #N」と報告する。

**企画と判定した場合**: Step A2へ進む。

### Step A2: 既存epicの再開かどうかを確認する

呼び出し元（`run`、またはユーザー）から既存のepic issue番号が示されている場合は、Step A2をスキップして「Resuming an interrupted epic」（後述）に進む。示されていなければ新規のepicとしてStep A3へ進む。

### Step A3: 背景・ゴール・成功指標をヒアリングする

`spec-interview` と同じ「1問ずつ・多肢選択優先」の流儀で、以下を確認する:

1. 背景・課題: なぜこの企画が必要か
2. ゴール・あるべき姿: 達成したい状態
3. 成功指標・完了条件: 何をもって完了・成功とするか
4. スコープ外（任意）: 今回は扱わないこと

REQのような「単一の falsifiable fact」への分解は求めない — ここで集めるのはゴールレベルの文脈であり、実装可能な粒度への分解は各task-issue用の `spec-interview` が個別に行う。

### Step A4: 作業タスク候補に分解する

ヒアリングした内容から、実現に必要な作業タスク候補（タイトル + 簡単な説明レベル）をリストアップし、ユーザーに提示して過不足を合意する。**候補が1つしかなくても、epic化を取りやめない** — epic-issue + task-issue 1個として起票する（ゴール・背景の文脈を失わないため）。

### Step A5: epic-issueを起票する

1. `epic` ラベルが存在するか確認する: `gh label list --search epic`。無ければ作成する: `gh label create epic --color "3E4B9E" --description "企画・ゴールを表すissue"`
2. このスキルディレクトリの `epic-template.md` を読み、埋める:
   - **背景・課題**、**ゴール・あるべき姿**、**成功指標・完了条件** は必須 — 常に埋める
   - **スコープ外**、**決定事項**、**注意点・既知のトレードオフ** は該当する場合のみ
   - **関連task-issue** は現時点では空欄のまま（Step A6で埋める）
3. 起票する:

```bash
gh issue create --title "<企画タイトル>" --label epic --body "$(cat <<'EOF'
<埋めたepic-template>
EOF
)"
```

4. 作成したepic issue番号を控える（以降 `<epic-N>` と表記）。

### Step A6: 各作業タスク候補をtask-issueとして起票する

Step A4で合意した候補を順に処理する。各候補について:

1. `spec-interview` を新規タスクとして呼ぶ（REQ-1から開始）。候補のタイトル・簡単な説明を出発点として渡す。
2. 承認されたREQ台帳を `task-filing` の「File a task under a parent epic」operationに渡す（`<epic-N>` を親として指定）。
3. `task-filing` が返す新しいtask-issue番号を、epic-issue本文の「関連task-issue」セクションに追記する。`task-filing` の「Append to an existing task」operationで、epic issueの当該セクションだけを更新する。

全候補の処理が終わったら、呼び出し元に「epic-issue #<epic-N> と task-issue #<...>, #<...>, ... を起票した」と報告する。

run経由の場合はここで `run` に制御が戻り、`run` がどのtask-issueから着手するか人間に確認する。直接発話（run無し）の場合はここで終了する — 実装フェーズには進まない。

## Entry B: spec-interview Step4からの引き継ぎ

`spec-interview` が対話中に「独立した関心事が複数ある」と判断し、確定済みREQ台帳全文とグループ分け案（グループ→REQ-ID一覧）とともにこのスキルを呼んだ場合:

### Step B1: ゴール・成功指標を簡略確認する

背景は対話履歴から要約できるため、追加で聞くのは「ゴール・あるべき姿」「成功指標・完了条件」のみに絞る（1〜2問程度）。

### Step B2: epic-issueを起票する

Step A5と同じ手順。ただし「関連task-issue」欄は空のまま起票してよい（Step B3で埋める）。

### Step B3: 各グループをtask-issueとして起票する

`spec-interview` から渡されたグループごとに、**新規spec-interviewは呼ばない** — 既にそのグループのREQがREQ台帳として確定しているため、そのまま `task-filing` の「File a task under a parent epic」operationに渡してtask-issue化する。以降はStep A6の3.と同じ（epic-issue本文の「関連task-issue」欄を更新）。

全グループの処理が終わったら、呼び出し元（`spec-interview` を呼んだ元の文脈、通常は `run`）に「epic-issue #<epic-N> と task-issue #<...>, ... を起票した」と報告する。

## Resuming an interrupted epic

既存のepic issue番号 `<epic-N>` を指定して呼ばれた場合:

1. `gh issue view <epic-N> --json body -q .body` でepic-issue本文を取得し、「関連task-issue」欄に列挙済みのtask-issue番号を読み取る。
2. `gh sub-issue list <epic-N>` で、実際に子issueとして紐づいているsub-issueの一覧を取得し、1.の記載と突き合わせる。
3. まだ起票されていない作業タスク候補（Step A4またはStep B時点で合意されていたがStep A6/B3が未完了のもの）だけを対象に、Step A6（またはB3）から再開する。
4. 全て完了したら、通常どおり呼び出し元に結果を報告する。

候補一覧そのものが失われている場合（例えば会話コンテキストが失われた状態での再開）は、epic-issue本文（背景・ゴール・成功指標）を読み直したうえで、ユーザーに残りの作業タスク候補を再確認する。

## Constraint: epic-issueにREQ行を書かない

epic-issueの本文には `REQ-<id>:` 形式の行を一切含めない。`spec-to-tests` と `coverage-check` は issue本文を `^REQ-(\d+):\s*(.+)$` でグレップしてREQを拾うため（`plugins/sd-tdd/scripts/coverage-check/parse.js`）、epic-issueがこの形式の行を持つと誤ってREQとして扱われてしまう。ゴール・成功指標はREQ形式ではなく、`epic-template.md` の各セクションに自然文で書く。
```

- [ ] **Step 3: `evals.json` を作成する**

`plugins/sd-tdd/skills/epic-filing/evals/evals.json` を新規作成し、以下の内容にする:

```json
{
  "skill_name": "epic-filing",
  "evals": [
    {
      "id": 0,
      "name": "scenario-1_single_concrete_request_stays_a_task",
      "prompt": "「ログイン画面のパスワードリセットリンクの有効期限を24時間から1時間に短縮して」という依頼を受けました。epic-filingはこれをどう扱いますか？",
      "expected_output": "epic-filingはこれを単一の具体的な変更と判定し、epic-issueを作成しない。spec-interviewを呼んでREQ台帳を確定させ、task-filingの『File a new task』operationで通常のtask-issueとして起票して終わる。",
      "files": [],
      "assertions": [
        {"name": "no_epic_created", "description": "epic-issueが作成されていないこと"},
        {"name": "normal_task_filing_used", "description": "task-filingの『File a new task』operationが呼ばれていること"}
      ]
    },
    {
      "id": 1,
      "name": "scenario-2_goal_only_request_becomes_epic",
      "prompt": "「決済まわりのUXを全体的に改善したい」という依頼を受けました。具体的な実装対象は決まっていません。epic-filingはこれをどう扱いますか？",
      "expected_output": "epic-filingはこれを企画と判定し、背景・ゴール・成功指標をヒアリングしたうえで作業タスク候補に分解し、ユーザーと合意した上でepic-issueを起票する。各候補は個別にspec-interview→task-filingでtask-issue化され、epic-issueのsub-issueとして紐づけられる。",
      "files": [],
      "assertions": [
        {"name": "epic_issue_created", "description": "epic-issueが起票されていること"},
        {"name": "candidates_become_sub_issues", "description": "分解された各作業タスク候補が、個別のspec-interview→task-filingを経てepic-issueのsub-issueとして起票されていること"}
      ]
    },
    {
      "id": 2,
      "name": "scenario-3_single_candidate_still_becomes_epic",
      "prompt": "企画のヒアリングと分解の結果、作業タスク候補が1つしか出てきませんでした。epic-filingはどう振る舞いますか？",
      "expected_output": "候補が1つしかなくても、epic化を取りやめない。epic-issueとその1個のtask-issue（sub-issue）を起票する。",
      "files": [],
      "assertions": [
        {"name": "epic_still_created_with_one_task", "description": "候補が1件のみでもepic-issueとtask-issueが両方起票されていること"}
      ]
    },
    {
      "id": 3,
      "name": "scenario-4_direct_phrase_without_run_stops_after_filing",
      "prompt": "runを経由せず、ユーザーから直接「認証基盤の強化をタスクとして切っておいて」と言われました。epic-filingはどこまで実行しますか？",
      "expected_output": "epic-filingは判定・ヒアリング・分解・起票（epic-issue、または単一taskならtask-issueのみ）までを実行して終了する。実装やPR作成のフェーズには進まない。",
      "files": [],
      "assertions": [
        {"name": "stops_after_filing", "description": "issue起票の完了をもって処理が終了し、実装フェーズ（spec-to-tests以降）に進んでいないこと"}
      ]
    },
    {
      "id": 4,
      "name": "scenario-5_spec_interview_step4_handoff_reuses_existing_reqs",
      "prompt": "spec-interviewが対話中に、集めていたREQ群が実は独立した2つの関心事（グループ1: REQ-1,2、グループ2: REQ-3,4）に分かれると判断し、グループ分け案とともにepic-filingを呼びました。epic-filingは各グループのtask-issue化にあたって、新規spec-interviewを呼び直しますか？",
      "expected_output": "呼び直さない。既に確定しているREQをそのままそれぞれのグループのtask-issueとしてtask-filingに渡す。ゴール・成功指標のみ簡略的に確認する。",
      "files": [],
      "assertions": [
        {"name": "no_fresh_spec_interview_per_group", "description": "各グループについて新規spec-interview（REQ-1からの再ヒアリング）が呼ばれていないこと"},
        {"name": "existing_reqs_reused", "description": "spec-interviewから渡された既存REQがそのままtask-issue化に使われていること"}
      ]
    },
    {
      "id": 5,
      "name": "scenario-6_resume_by_epic_number_skips_already_filed_tasks",
      "prompt": "epic-issue #40の起票は完了しており、3個の作業タスク候補のうち2個（#41, #42）はすでにtask-issueとして起票済みですが、3個目の起票中にセッションが中断しました。「epic #40の続きをやって」と言われた場合、epic-filingはどう振る舞いますか？",
      "expected_output": "epic-filingはepic-issue #40の本文とsub-issue一覧を確認し、既に起票済みの#41, #42は再作成せず、残り1個の未起票候補についてのみspec-interview→task-filingを実行する。",
      "files": [],
      "assertions": [
        {"name": "no_duplicate_task_issues", "description": "既に起票済みの#41, #42が重複して再作成されていないこと"},
        {"name": "only_remaining_candidate_filed", "description": "未起票だった候補のみが新規に起票されていること"}
      ]
    },
    {
      "id": 6,
      "name": "scenario-7_epic_body_has_no_req_lines",
      "prompt": "epic-issueの本文を起票する際、epic-filingはREQ-<id>:形式の行を含めてよいですか？",
      "expected_output": "含めない。epic-issueの本文にはREQ形式の行を一切書かず、ゴール・成功指標は自然文でepic-template.mdの各セクションに書く。spec-to-tests/coverage-checkがREQ-<id>:行をグレップしてテスト対象として誤検出することを防ぐため。",
      "files": [],
      "assertions": [
        {"name": "no_req_lines_in_epic_body", "description": "epic-issue本文にREQ-<id>:形式の行が含まれていないこと"}
      ]
    }
  ]
}
```

- [ ] **Step 4: JSON構文を検証する**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/sd-tdd/skills/epic-filing/evals/evals.json', 'utf8')); console.log('OK')"
```

Expected: `OK` が出力されること（構文エラーがあれば例外で落ちる）。

- [ ] **Step 5: Commit**

```bash
git add plugins/sd-tdd/skills/epic-filing/
git commit -m "feat(sd-tdd): epic-filingスキルを追加し、企画レベルの依頼をepic-issueとして起票できるようにする"
```

---

### Task 2: `task-filing` に epic 配下への起票 operation を追加する

**Files:**
- Modify: `plugins/sd-tdd/skills/task-filing/SKILL.md`

**Interfaces:**
- Consumes: `epic-filing`（Entry A/B双方）から渡される、確定REQ台帳 + 親epic issue番号 `<epic-N>`
- Produces: 起票したtask-issue番号（`epic-filing` がepic本文の「関連task-issue」欄更新に使う）

- [ ] **Step 1: 現状のSKILL.mdを確認し、変更点を洗い出す**

対象ファイル: `plugins/sd-tdd/skills/task-filing/SKILL.md`（現状92行）。変更点は以下の1箇所のみ:

- `## Operation: File a split as sub issues` セクション（39〜62行目付近）を丸ごと削除し、`## Operation: File a task under a parent epic` セクションに置き換える。呼び出し元が `spec-interview`（Step4のsub issue split）から `epic-filing` に変わるため。

- [ ] **Step 2: `File a split as sub issues` セクションを `File a task under a parent epic` に置き換える**

`plugins/sd-tdd/skills/task-filing/SKILL.md` の `## Operation: File a split as sub issues` セクション全体（見出しから次の `## Operation: File as PR groups` 見出し直前まで）を、以下に置き換える:

```markdown
## Operation: File a task under a parent epic

Called by `epic-filing` when filing a task-issue as a sub-issue of an epic-issue (both its Entry A — a freshly decomposed initiative — and Entry B — concerns discovered mid-interview by `spec-interview`).

1. Ensure the `gh-sub-issue` extension is installed:

```bash
gh extension list | grep -q sub-issue || gh extension install yahsan2/gh-sub-issue
```

If the install fails (no network, etc.), stop and tell the user to install `yahsan2/gh-sub-issue` manually, then retry — don't fall back to plain issue creation silently.

2. Fill in `task-template.md` exactly as in "File a new task" (REQ-N lines copied verbatim, required/optional sections as usual).
3. Create the task as a sub-issue of the given parent epic issue number `<epic-N>`:

```bash
gh sub-issue create --parent <epic-N> --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

4. Report back to the caller: "Task filed as issue #<N> (sub-issue of epic #<epic-N>)."
```

- [ ] **Step 3: 変更内容を検証する**

```bash
grep -n "File a split as sub issues\|File a task under a parent epic" plugins/sd-tdd/skills/task-filing/SKILL.md
```

Expected: `File a task under a parent epic` のみがヒットし、`File a split as sub issues` はヒットしないこと（旧operationが完全に置き換わっていること）。

```bash
grep -n "^## Operation:" plugins/sd-tdd/skills/task-filing/SKILL.md
```

Expected: `Fetch current ledger` → `File a new task` → `File a task under a parent epic` → `File as PR groups` → `Append to an existing task` の順で5つの見出しが並んでいること（順序は既存のまま維持、中身だけ置き換わっていること）。

- [ ] **Step 4: Commit**

```bash
git add plugins/sd-tdd/skills/task-filing/SKILL.md
git commit -m "refactor(sd-tdd): task-filingのsub issue split operationをepic配下起票operationに置き換える"
```

---

### Task 3: `spec-interview` Step4 を epic-filing 呼び出しに書き換える

**Files:**
- Modify: `plugins/sd-tdd/skills/spec-interview/SKILL.md`
- Modify: `plugins/sd-tdd/skills/spec-interview/evals/evals.json`

**Interfaces:**
- Consumes: 変更なし（ユーザー入力のみ）
- Produces: 独立した関心事のグループ分けが承認された場合、確定REQ台帳 + グループ→REQ-IDマッピングを `epic-filing`（Entry B）へハンドオフする（従来は `task-filing` の「File a split as sub issues」へハンドオフしていた）

- [ ] **Step 1: Step4を書き換える**

`plugins/sd-tdd/skills/spec-interview/SKILL.md` の `## Step 4: Consider whether to split` セクション全体を、以下に置き換える:

```markdown
## Step 4: Consider whether to split

Before asking for final approval, weigh whether this ledger is large or varied enough that a single issue/PR would be painful to review. There is no fixed REQ-count threshold — judge it the same way you'd judge any scope call: how many REQs, how unrelated they are, whether they touch disjoint parts of the codebase.

- **Judge it not worth splitting:** say nothing about splitting — go straight to Step 5 with the full ledger.
- **Judge it worth splitting because the groups are independent concerns** (different components, unrelated features — each reviewable/mergeable on its own): propose the grouping (which REQ-IDs belong together), state that recommendation and why, and let the user approve or override it. If approved, this becomes an **independent-concerns split** — see Step 5 for the hand-off.
- **Judge it worth splitting because the groups are the same feature staged as dependent steps** (e.g. base case → edge cases → error handling, where separate issues would be artificial): propose a **PR-group rollout** instead — state the recommendation and why, then let the user approve or override it. If approved, this becomes a **PR-group split** — see Step 5 for the hand-off.
- Never ask "sub issue or PR group?" with no guidance; state one recommendation based on independence vs. dependency, as above. That just pushes the same ad-hoc judgment call the user is trying to get away from.
- If the user declines a split (or you judged none needed), proceed as a single ledger.
```

- [ ] **Step 2: Step5を書き換える**

同ファイルの `## Step 5: Get explicit approval, then hand off` セクション全体を、以下に置き換える:

```markdown
## Step 5: Get explicit approval, then hand off

Show the user the final REQ list before handing off — do not write it anywhere yourself, and do not run any tracker command. Once approved:

- **No split, or a PR-group split**: tell the user "REQ ledger confirmed. Next: invoke `task-filing` to record it (new task, or append if this was a continuation of an existing one)." If a PR-group split was agreed in Step 4, also pass `task-filing` the group→REQ-ID mapping for its "File as PR groups" operation.
- **An independent-concerns split**: tell the user "REQ ledger confirmed. Next: hand off to `epic-filing` to file the epic-issue and each group as its own task-issue." Pass `epic-filing` the confirmed REQ ledger and the group→REQ-ID mapping — this is `epic-filing`'s Entry B.
```

- [ ] **Step 3: `evals.json` に新シナリオを追加する**

`plugins/sd-tdd/skills/spec-interview/evals/evals.json` の `evals` 配列末尾（既存の `id: 2` の後）に、以下の2件を追加する:

```json
    ,{
      "id": 3,
      "name": "step4_independent_concerns_hands_off_to_epic_filing",
      "prompt": "REQ台帳を集めている途中、実は互いに独立した2つの機能（決済ログの整備、通知テンプレートの追加）が混在していると判明しました。spec-interviewはStep4でどう振る舞いますか？",
      "expected_output": "spec-interviewはグループ分け案（各REQ-IDがどちらのグループに属するか）を提示し、ユーザーが承認したら、task-filingのsub issue split操作ではなくepic-filing（Entry B）に確定REQ台帳とグループ分けを渡してハンドオフする。",
      "files": [],
      "assertions": [
        {"name": "epic_filing_invoked_not_task_filing_split", "description": "独立した関心事の分割が承認された場合、task-filingのsub issue split相当ではなくepic-filingが呼ばれていること"}
      ]
    },
    {
      "id": 4,
      "name": "step4_dependent_steps_still_use_pr_group",
      "prompt": "REQ台帳を集めている途中、これは同じ機能の実装ステップ（基本ケース→エラーハンドリング）に分かれることがわかりました。spec-interviewはStep4でどう振る舞いますか？",
      "expected_output": "spec-interviewはPR-groupのロールアウトを提案し、ユーザーが承認すればグループ→REQ-IDマッピングをtask-filingの『File as PR groups』operationに渡す。epic-filingは呼ばない。",
      "files": [],
      "assertions": [
        {"name": "pr_group_stays_with_task_filing", "description": "依存したステップの分割の場合、epic-filingではなくtask-filingのFile as PR groups operationが使われていること"}
      ]
    }
```

挿入位置: 既存の `id: 2` のオブジェクトを閉じる `}` の直後、配列を閉じる `]` の直前に、上記のカンマ始まりのブロックをそのまま追記する（既存の3件はそのまま変更しない）。

- [ ] **Step 4: JSON構文を検証する**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/sd-tdd/skills/spec-interview/evals/evals.json', 'utf8')); console.log('OK')"
```

Expected: `OK` が出力されること。

- [ ] **Step 5: 変更内容を検証する**

```bash
grep -n "sub issue split\|epic-filing\|PR-group" plugins/sd-tdd/skills/spec-interview/SKILL.md
```

Expected: `epic-filing` への言及が新たに存在し、`sub issue split` という表現がプレーンな`task-filing`直呼びの文脈では残っていない（`epic-filing`のEntry Bの説明文脈以外に出てこない）こと。

- [ ] **Step 6: Commit**

```bash
git add plugins/sd-tdd/skills/spec-interview/SKILL.md plugins/sd-tdd/skills/spec-interview/evals/evals.json
git commit -m "refactor(sd-tdd): spec-interview Step4のsub issue split判断をepic-filing呼び出しに統合する"
```

---

### Task 4: `run` を epic-filing 経由の判定フローに合わせて更新する

**Files:**
- Modify: `plugins/sd-tdd/skills/run/SKILL.md`
- Modify: `plugins/sd-tdd/skills/run/evals/evals.json`

**Interfaces:**
- Consumes: `epic-filing` の戻り値（単一task issue番号、またはepic issue番号 + task-issue番号のリスト）
- Produces: 変更なし（既存どおりPRまで進める、マージはしない）

- [ ] **Step 1: Step1を書き換える**

`plugins/sd-tdd/skills/run/SKILL.md` の `## Step 1: Determine new task vs. resume` セクション全体を、以下に置き換える（見出し名も変更）:

```markdown
## Step 1: Determine resume vs. new work

- If the user's request references an existing issue number (e.g. "issue #12", "#12の続き"), this is a **resume** — go to "Resuming an existing issue" below with that issue number.
- Otherwise, this is **new work** — go to "Starting new work" below. `run` does not itself judge whether the request is a single task or a multi-task initiative; that judgment, and the filing that follows from it, is `epic-filing`'s job (see "Starting new work").
- If it's genuinely ambiguous whether the request is a resume or new work (the request could plausibly be either), ask the user once which issue number to resume, or confirm it's new work, before proceeding.
```

- [ ] **Step 2: 「Starting a new task」を「Starting new work」に書き換える**

同ファイルの `## Starting a new task` セクション全体（見出しから次の `## Handling a split` 見出し直前まで）を、以下に置き換える:

```markdown
## Starting new work

1. Invoke the `test-infra-setup` skill. It is idempotent — if the project already has a test framework and mutation-testing tool wired up, it reports so and does nothing further.
2. Invoke `epic-filing` to judge whether this is a single work task or a multi-task initiative, and to handle filing accordingly:
   - **Single work task**: `epic-filing` invokes `spec-interview` itself (its own approval gate still applies — wait for it) and files the result via `task-filing`'s "File a new task" operation, then reports back the filed issue number `N`. Continue to step 3 below with that `N`.
   - **Multi-task initiative**: `epic-filing` interviews the user on background/goal/success criteria, breaks the initiative into task candidates, files an epic-issue, then files each candidate as its own task-issue (via `spec-interview` → `task-filing`'s "File a task under a parent epic" operation) as a sub-issue of the epic. Once every candidate is filed, `epic-filing` reports back the epic issue number and the list of filed task-issue numbers. **This is a stopping point** — escalate to the human, asking which task-issue to start with (this replaces the old "sub issue split" escalation point; the set of 5 escalation points in this skill's intro is unchanged in count, just relabeled here). Do not invoke `spec-to-tests` or anything past this point automatically until a task-issue is picked.
   - If, inside the single-work-task path, `spec-interview` itself reports a Step 4 split because it discovered independent concerns mid-interview, `spec-interview` hands off to `epic-filing` directly (its Entry B) instead of returning to `run` — the multi-task initiative bullet above applies once `epic-filing` reports back.
3. Once a single task-issue number `N` is in hand (either directly from the single-work-task path, or picked by the human after a multi-task initiative split), run "Implementing one scope" (below) for issue `N` with the full REQ ledger as the scope.
```

- [ ] **Step 3: 「Handling a split」からSub issue splitの記述を削除する**

同ファイルの `## Handling a split` セクションから、`- **Sub issue split:** ...` で始まる箇条書き（1項目全体）を削除する。`- **PR group split:** ...` の箇条書きはそのまま残す。削除後、このセクションにはPR group splitの箇条書きのみが残る。

- [ ] **Step 4: 「Resuming an existing issue」内の参照を更新する**

同ファイルの `## Resuming an existing issue` セクション、Step 1の一文:

> then once approved invoke `task-filing`'s **append** operation (not the new-task operation) for issue `N` (or its split operations, if a split was proposed and approved — see "Handling a split")

を、以下に置き換える:

> then once approved invoke `task-filing`'s **append** operation (not the new-task operation) for issue `N` — or, if `spec-interview`'s Step 4 proposes and the user approves an independent-concerns split, hand off to `epic-filing` (Entry B) instead; or if a PR-group split is proposed and approved, see "Handling a split"

- [ ] **Step 5: 変更内容を検証する**

```bash
grep -n "Sub issue split\|sub issue split" plugins/sd-tdd/skills/run/SKILL.md
```

Expected: ヒットしないこと（"Handling a split"からsub issue split分岐が完全に削除されていること。"独立した関心事の分割"は`epic-filing`という語で言及されているため、この文字列そのものはもう出現しない）。

```bash
grep -n "epic-filing" plugins/sd-tdd/skills/run/SKILL.md
```

Expected: "Starting new work" と "Resuming an existing issue" の2箇所以上でヒットすること。

- [ ] **Step 6: `evals.json` の既存id=4を新しい仕様に合わせて書き換える**

`plugins/sd-tdd/skills/run/evals/evals.json` の `id: 4`（`name: "issue-22_REQ-5_sub-issue-split-escalates-before-spec-to-tests"`）のオブジェクトを、以下に置き換える（`id` は `4` のまま維持する）:

```json
    {
      "id": 4,
      "name": "issue-22_REQ-5_multi-task-initiative-escalates-before-spec-to-tests",
      "prompt": "「通知基盤を刷新して」というタスクをやってください。epic-filingが企画と判定し、epic-issue #30とtask-issue #31（メール通知）, #32（プッシュ通知）を起票したとします。",
      "expected_output": "企画としてepic-issue+複数task-issueが起票された場合、runはどのtask-issueから着手するかを人間にエスカレーションして停止する。spec-to-tests以降には自動で進まない。",
      "files": [],
      "assertions": [
        {"name": "epic_filing_invoked_for_initiative", "description": "企画判定された依頼についてepic-filingが呼ばれ、epic-issueと複数task-issueが起票されていること"},
        {"name": "escalates_before_spec_to_tests", "description": "起票の直後に、どのtask-issueから着手するかを問う形で人間にエスカレーションしており、spec-to-testsが自動的に呼ばれていないこと"}
      ]
    },
```

- [ ] **Step 7: JSON構文を検証する**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/sd-tdd/skills/run/evals/evals.json', 'utf8')); console.log('OK')"
```

Expected: `OK` が出力されること。

- [ ] **Step 8: Commit**

```bash
git add plugins/sd-tdd/skills/run/SKILL.md plugins/sd-tdd/skills/run/evals/evals.json
git commit -m "refactor(sd-tdd): runの新規task判定をepic-filingに委譲し、sub issue split分岐を統合する"
```

---

## 次のステップ（本計画のスコープ外）

- 既存issue（epic化されていない過去のtask-issue群）を遡ってepic-issueにぶら下げ直す移行作業は対象外（design doc「スコープ外」節）。
- epic-issue自体をさらに上位のepicにネストする多階層epic構造は対象外。
