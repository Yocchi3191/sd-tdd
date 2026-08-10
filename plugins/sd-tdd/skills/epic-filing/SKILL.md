---
name: epic-filing
description: Use before spec-interview starts on a fresh, unfiled request — judges whether it describes a single concrete work item or a goal/idea spanning multiple independent work items. For a multi-item initiative, interviews the user on background/goal/success criteria, breaks it into task candidates, files an epic-issue, then runs spec-interview → task-filing per candidate as a sub-issue of the epic. Also triggers directly on phrases like "タスクを切って" / "issueにして" to file work without going through the full run pipeline — filing-only, no implementation follows. Also invoked by spec-interview's own Step 4 when REQ-gathering reveals the ledger actually covers independent concerns, instead of spec-interview filing a sub issue split itself. Resumable by passing an existing epic issue number.
---

# Epic Filing: 企画・作業タスクの起票

企画・アイデアレベルの依頼を、目的・ゴール・成功指標を記述する epic-issue として起票し、それを実現する作業タスクは `spec-interview` → `task-filing` で通常どおり task-issue として起票したうえで、その epic-issue の sub-issue にする。単一の作業タスクだと判定した場合はepic化せず、そのまま `spec-interview` → `task-filing` に委譲して終わる。

このスキルは2つの入口を持つ。**Entry A**（`run` 経由、または「タスクを切って」のような直接発話からのゼロベース起票）と **Entry B**（`spec-interview` のStep4が対話中に独立した関心事を発見した場合の引き継ぎ）。

## Entry A: 依頼を直接受け取った場合

### Step A1: 単一taskか複数タスクの企画かを判定する

依頼文を見て判定する:

- 依頼が具体的な単一の実装対象（特定の機能・ファイル・バグ）を指している → **単一task**
- 依頼がゴール・テーマ止まりで実装対象が定まっていない、または明らかに複数の独立した関心事にまたがる → **企画**
- 判断に迷う場合は一度だけ確認する。例:「これは1つのまとまった変更ですか、それとも複数の独立した作業に分かれそうな大きめのテーマですか？」

**単一task と判定した場合**: このスキルはここで終わる。`spec-interview` を新規タスクとして呼び、確定したREQ台帳を通常の `task-filing`「File a new task」operationで記録する。epic-issueは作らない。呼び出し元に「単一taskとして起票した、issue #N」と報告する。

ただし、その `spec-interview` が Step 4/5 で別の結論に至った場合は、以下がこの単一taskブランチの既定の振る舞いを上書きする:

- **PRグループ分割が承認された場合**（1つの機能を依存関係のある段階に分けたもの。独立した関心事ではない）: 「File a new task」ではなく `task-filing` の**「File as PR groups」operation**で起票する。epic-issueは作らない。呼び出し元には issue番号 `#N` と グループ→REQ-ID の対応表を添えて報告し、`run` の「Handling a split」へ進んでもらう（`run` 側の「Starting new work」にも同じ経路が書かれている）。
- **その `spec-interview` がこのスキル自身のEntry Bへ引き継いだ場合**（対話中に独立した関心事を発見した場合。`spec-interview` の Step 5 参照）: この単一taskブランチは**完全に破棄する** — 「File a new task」での起票は行わない（行うと二重起票になる）。起票も呼び出し元への報告も、そのEntry B側の呼び出しが担う。

**企画と判定した場合**: Step A2へ進む。

### Step A2: 既存epicの再開かどうかを確認する

呼び出し元（`run`、またはユーザー）から既存のepic issue番号が示されている場合は、以降のStep A3〜A6は実行せず、「Resuming an interrupted epic: 中断したepicの再開」（後述）に進む。示されていなければ新規のepicとしてStep A3へ進む。

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

1. `epic` ラベルが**完全一致で**存在するか確認する: `gh label list --json name -q '.[].name' | grep -qx epic`。無ければ作成する: `gh label create epic --color "3E4B9E" --description "企画・ゴールを表すissue"`
   （`gh label list --search epic` のような部分一致で判定してはいけない — `epic-blocked` のような別ラベルがあるだけで「存在する」と誤判定し、直後の `gh issue create --label epic` が存在しないラベルで失敗する。）
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
3. `task-filing` が返した新しいtask-issue番号を、epic-issue本文の「## 関連task-issue」セクションに追記する。**この更新はこのスキル自身が直接行う** — `task-filing` の「Append to an existing task」operationは使わない。あれはREQ台帳専用で、「やること・要件」セクションに `REQ-<max+1>:` 行を追記する操作であり、epic-issueに対して使うとREQ行を書き込んで「Constraint: epic-issueにREQ行を書かない」に違反する。epic-issue本文の組み立ては、Step A5の初回起票と同じく最初から最後までこのスキルの責任範囲:

```bash
# 1. 現在のepic本文を取得
gh issue view <epic-N> --json body -q .body
# 2. 「## 関連task-issue」セクションの末尾に `- #<新しいtask-issue番号>: <タスク名>` を1行追記する
#    （他のセクションは一切書き換えない）
# 3. 追記後の本文全文で書き戻す
gh issue edit <epic-N> --body "$(cat <<'EOF'
<追記後のepic本文全文>
EOF
)"
```

全候補の処理が終わったら、呼び出し元に「epic-issue #<epic-N> と task-issue #<...>, #<...>, ... を起票した」と報告する。

run経由の場合はここで `run` に制御が戻り、`run` がどのtask-issueから着手するか人間に確認する。直接発話（run無し）の場合はここで終了する — 実装フェーズには進まない。

## Entry B: spec-interview Step4からの引き継ぎ

`spec-interview` が対話中に「独立した関心事が複数ある」と判断し、確定済みREQ台帳全文とグループ分け案（グループ→REQ-ID一覧）とともにこのスキルを呼んだ場合:

### Step B1: ゴール・成功指標を簡略確認する

背景は対話履歴から要約できるため、追加で聞くのは「ゴール・あるべき姿」「成功指標・完了条件」のみに絞る（1〜2問程度）。

### Step B2: epic-issueを起票する

Step A5と同じ手順。ただし「関連task-issue」欄は空のまま起票してよい（Step B3で埋める）。

### Step B3: 各グループをtask-issueとして起票する

`spec-interview` から渡されたグループごとに、**新規spec-interviewは呼ばない** — 既にそのグループのREQがREQ台帳として確定しているため、そのまま `task-filing` の「File a task under a parent epic」operationに渡してtask-issue化する。以降はStep A6の3.と同じ — epic-issue本文の「## 関連task-issue」欄は、`task-filing` の「Append to an existing task」operationではなく、このスキル自身が `gh issue view` → 追記 → `gh issue edit` で直接更新する。

全グループの処理が終わったら、呼び出し元（`spec-interview` を呼んだ元の文脈、通常は `run`）に「epic-issue #<epic-N> と task-issue #<...>, ... を起票した」と報告する。

## Resuming an interrupted epic: 中断したepicの再開

既存のepic issue番号 `<epic-N>` を指定して呼ばれた場合:

1. `gh issue view <epic-N> --json body -q .body` でepic-issue本文を取得し、「関連task-issue」欄に列挙済みのtask-issue番号を読み取る。
2. `gh sub-issue list <epic-N>` で、実際に子issueとして紐づいているsub-issueの一覧を取得し、1.の記載と突き合わせる。`gh-sub-issue` 拡張が未インストールなどでこのコマンドが使えない・失敗する場合は、ここで止まらず 1. で読み取ったepic本文の「関連task-issue」一覧だけを起票済みリストとみなして続行する（graceful degradation）。ただしその場合は突き合わせができないため、「本文に記載のある #... は起票済みとみなして進めます」とユーザーに確認を取ってから 3. に進む。
3. まだ起票されていない作業タスク候補（Step A4またはStep B時点で合意されていたがStep A6/B3が未完了のもの）だけを対象に、Step A6（またはB3）から再開する。
4. 全て完了したら、通常どおり呼び出し元に結果を報告する。

候補一覧そのものが失われている場合（例えば会話コンテキストが失われた状態での再開）は、epic-issue本文（背景・ゴール・成功指標）を読み直したうえで、ユーザーに残りの作業タスク候補を再確認する。

## Constraint: epic-issueにREQ行を書かない

epic-issueの本文には `REQ-<id>:` 形式の行を一切含めない。`spec-to-tests` と `coverage-check` は issue本文を `^REQ-(\d+):\s*(.+)$` でグレップしてREQを拾うため（`plugins/sd-tdd/scripts/coverage-check/parse.js`）、epic-issueがこの形式の行を持つと誤ってREQとして扱われてしまう。ゴール・成功指標はREQ形式ではなく、`epic-template.md` の各セクションに自然文で書く。
