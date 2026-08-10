---
name: task-filing
description: Use after spec-interview has confirmed a REQ ledger (new or appended), or when filing a rough task with no REQ ledger yet pending investigation/design — records it into the project's tracker (GitHub issue by default) using this skill's task-template.md. Also use to fetch a task's current ledger when spec-interview is continuing work on an existing task. Never rewords or summarizes REQ lines; they are transcribed verbatim.
---

# Task Filing

REQ台帳の置き場所を作成・更新し、append session向けにそれを取得し直す役割を持つ。`spec-interview`がREQ台帳の*内容*を決め、このskillは`task-template.md`を使って*どこに・どのように*記録するかを決める — 起票されたタスクは誰が引き継いでも十分な文脈を持てるようにする。（`spec-to-tests`と`coverage-check`はテスト生成・検証のため台帳を取得する目的で今もトラッカーを直接読む — このskillが担うのは台帳への書き込みであって、パイプライン中のすべての読み取りではない。）

デフォルトのトラッカー: `gh` CLI経由のGitHub issue。このskillの目的自体には「GitHub」という前提はハードコードされていない — 将来別のトラッカーバックエンドに対応する場合も、必要なのは以下3つの操作に新しいコマンドを追加することだけであり、`spec-interview`の書き直しは不要である。

## 操作: 現在のREQ台帳を取得する

append sessionの開始時、インタビュー質問を始める前に`spec-interview`から呼ばれる。

```bash
gh issue view <N> --json body -q .body
```

生の本文テキストをそのまま呼び出し元に返す。`REQ-<id>:`行のパースは`spec-interview`自身が行う。

## 操作: 新規タスクを起票する

1. `task-template.md`（このskillのディレクトリ内）を読み、埋めていく:
   - **背景・課題**、**やること・要件**、**完了条件**は必須 — これらの見出しは常に含めること。
   - 確定したREQ-N行を**やること・要件**へそのまま転記する — 言い換え・要約・番号の振り直しは行わない。テンプレートのプレースホルダである`REQ-1: ...`／`REQ-2: ...`行は完全に置き換える — 実際のREQ行と並べて残してはならない。
   - **REQが0件の場合**（まだ実装可能な粒度に分解されていない粗い起票 — 調査・設計フェーズを経てから`spec-interview`のappend sessionで後から追記する想定）: **やること・要件**はプレースホルダも実REQ行も置かず、空欄のまま起票してよい。この場合でも**背景・課題**と**完了条件**は必須のまま埋める — **完了条件**はREQ単位ではなく、その時点での完了基準（例:「調査・設計方針が固まり、REQ台帳が確定していること」）を書けばよい。
   - **決定事項**、**設計・実装方針**、**注意点・既知のトレードオフ**は任意 — そのタスクに実際に関係がある場合のみセクションを含める。空の見出しを残さないこと。
2. タスクを作成する:

```bash
gh issue create --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

3. 呼び出し元へ報告する: 「Task filed as issue #<N>.」

## 操作: 親epicの配下にタスクを起票する

`epic-filing`が、タスクissueをepic-issueのsub-issueとして起票する際に呼ばれる（分解したばかりの企画を起票するEntry Aと、`spec-interview`のインタビュー途中で発見された懸念を起票するEntry Bのどちらの場合も対象）。

1. `gh-sub-issue`拡張機能がインストール済みであることを確認する:

```bash
gh extension list | grep -q sub-issue || gh extension install yahsan2/gh-sub-issue
```

インストールが失敗した場合（ネットワークが無い等）、処理を止め、ユーザーに`yahsan2/gh-sub-issue`を手動でインストールしてから再試行するよう伝える — 黙って通常のissue作成にフォールバックしてはならない。

2. 「新規タスクを起票する」と同じ手順で`task-template.md`を埋める（REQ-N行はそのまま転記、必須／任意セクションの扱いも同様）。
3. 指定された親epic issue番号`<epic-N>`のsub-issueとしてタスクを作成する:

```bash
gh sub-issue create --parent <epic-N> --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

4. 呼び出し元へ報告する: 「Task filed as issue #<N> (sub-issue of epic #<epic-N>).」

## 操作: PRグループとして起票する（単一issue）

`spec-interview`が、split mode = PR groupで確定した台帳と、グループ→REQ-IDの対応表を引き渡してきたときに呼ばれる。

1. 通常どおりタスクを起票する（「新規タスクを起票する」を参照）。
2. `## PRグループ`セクション（`task-template.md`を参照）を追加し、各グループの名前とREQ-IDを、実装される予定の順序で列挙する。
3. 呼び出し元へ報告する: 「Task filed as issue #<N> with <count> PR group(s).」

## 操作: 既存タスクへ追記する

1. 現在の本文を取得する（上記「現在のREQ台帳を取得する」を参照）。
2. 新しい`REQ-<max+1>:`、`REQ-<max+2>:`、…の行を**やること・要件**セクションの末尾、既存の行の後ろに追記する。既存の行を削除・言い換えしてはならない。
3. 呼び出し元から任意セクション（背景・課題、完了条件、決定事項、設計・実装方針、注意点・既知のトレードオフ）への更新が渡された場合はそれも反映する — それ以外の本文はそのままにしておく。
4. タスクを更新する:

```bash
gh issue edit <N> --body "$(cat <<'EOF'
<updated full body>
EOF
)"
```

5. 呼び出し元へ報告する: 「Task #<N> updated with <count> new REQ line(s).」

## 制約: REQ行は逐語的であること

`spec-to-tests`と`coverage-check`は、タスク本文を`^REQ-(\d+):\s*(.+)$`にマッチする行でgrepして要件を特定する（`plugins/sd-tdd/scripts/coverage-check/parse.js`を参照）。この正規表現は行そのものだけを見ており、どの見出しの下にあるかは問わない — そのため周辺の説明文の並べ替えは安全だが、`REQ-<id>:`行のテキストを編集することは安全ではない。あるREQが誤りだと判明した場合は、`spec-interview`が新しい行でそれをsupersede（置き換え）する。このskill自身が既存のREQ行のテキストを編集することはない。

タスクissueの親は常にepic-issueであり（`epic-filing`を参照）、epic-issueが`REQ-<id>:`行を持つことは決してない。したがってREQ行はタスクissue自身にのみ存在する — 親issueへ複製されることはなく、`coverage-check`が参照する先も常にタスクissue番号のみである。
