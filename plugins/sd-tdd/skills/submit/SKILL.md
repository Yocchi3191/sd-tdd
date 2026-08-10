---
name: submit
description: Use when the user wants to commit the current working-tree changes and open a Draft PR without running the full sd-tdd:run pipeline — e.g. "submitして", "今の変更をPRにして", or when run's own "Creating the PR" step delegates here. Commits any uncommitted changes with an inferred message, auto-detects the head/base branches, pushes, and opens a Draft PR from pr-template.md. When an explicit base branch was supplied (a PR-group step), also links the new PR into a GitHub stacked PR on top of the prior group's PR via the gh-stack extension. Never converts a PR to ready for review — that is review-pr's job.
---

# Submit

作業ツリーの内容を、pushされたブランチとDraft PRに変換する。sd-tddパイプラインの他のステップが先に走っている必要はない。これは`run`の「PR作成」ステップに相当する単体コマンド版であり、途中から再開する場合やREQ台帳のオーケストレーションが不要な場合に単独でも使える。

## Step 1: 未コミットの変更をコミットする

```bash
git status --porcelain
```

- **出力なし（クリーン）:** コミット対象なし — そのままStep 2へ進む。空コミットは絶対に作成しない。
- **何らかの出力がある（staged・unstaged・untrackedのいずれか）:** すべてをstageし、変更内容から推定したメッセージでコミットする — メッセージをユーザーに尋ねることは絶対にしない:

```bash
git add -A
git diff --cached
```

推定するメッセージが「何が変わったか」を正しく反映するように（ファイル数や行数だけでなく）、`--stat`だけでなくstaged diff全体を読むこと — diffが大きすぎて全文を読めない場合のみ、切り詰めのガードとして`git diff --cached --stat`にフォールバックする。何が変わったかを簡潔に説明するコミットメッセージを推定し（なぜ変えたかはPR本文の役割なのでここには書かない）、コミットする:

```bash
git commit -m "<推定したメッセージ>"
```

## Step 2: headブランチとbaseブランチを検出する

headブランチは現在チェックアウトされているブランチそのもの:

```bash
git branch --show-current
```

これが何も出力しない場合（detached HEAD）、submitにはPRを開くための名前付きブランチが必要である旨をユーザーに伝えて停止する — まずブランチをcheckoutまたは作成してもらう。

**baseブランチ:** 呼び出し元（例: PRグループのステップにおける`sd-tdd:run`）がbaseブランチを明示的に渡してきた場合は、その値をそのまま`<base-branch>`として使う — 以下のデフォルトブランチ検出は完全にスキップする。これがスタックされたPRグループのステップで、baseをリポジトリのデフォルトブランチではなく前グループのブランチにする仕組みである。submit自身はどちらが正しいかについて意見を持たず、与えられた値をそのまま使うだけである。

一方、baseブランチが渡されなかった場合は、リポジトリのデフォルトブランチを検出してそれを使う:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

取得した名前をそのまま以降のステップで`<base-branch>`として使う。

現在のブランチが（どちらの方法で決定されたにせよ）`<base-branch>`そのものである場合、submitする対象が無い旨をユーザーに伝えて停止する — PRにはbaseと異なるheadブランチが必要である。

## Step 3: push

pushする前に、新しく送るものがあるかを確認する:

```bash
git rev-list --count '@{u}' 2>/dev/null && git rev-list --count '@{u}..HEAD'
```

- **最初のコマンドが失敗する**（upstreamが未設定 — ブランチが一度もpushされていない）: pushする。
- **2番目のコマンドが`0`を出力する**（ローカルHEADがupstreamより先のコミットを持たない）: pushをスキップする — 送るものが無い。
- **それ以外:** pushする。

```bash
git push -u origin <head-branch>
```

## Step 4: pr-template.mdの存在を確認する

このskill自身のディレクトリ（この`SKILL.md`と同じ場所）に`pr-template.md`があるか確認する。これはPR本文の構造に関する唯一の正とする情報源であり、ここでその内容を重複して持たせることはしない — 変更が必要になった場合に編集すべき場所が一つで済むようにするためである。

- **既に存在する場合:** そのまま再利用する — 絶対に上書きしない。
- **存在しない場合:** 続行する前に作成する — PR本文をテンプレート無しで即興生成することはしない。以下を順に含める必要がある: 任意の`Closes #<ISSUE_NUMBER>`行（issue番号が渡されなかった場合に削除する旨のコメント付き）、`<SUMMARY>`プレースホルダを持つ`## 概要`セクション、`<REQ_LIST>`プレースホルダを持つ`## 変更対象のREQ`セクション、そして`<STRUCTURAL_REQ_LIST>`プレースホルダを持つ任意の`## 構造的制約（テストによる担保なし、レビューで確認してください）`セクション（`[structural]`REQが該当しない場合はセクションごと削除する旨のコメント付き）。各プレースホルダの埋め方はStep 5を参照。

## Step 5: テンプレートを埋めてDraft PRを作成する

`pr-template.md`を読み込み、プレースホルダを埋める:

- `<ISSUE_NUMBER>`: 今回の呼び出しにissue番号が渡されていれば、それを埋めて`Closes #<ISSUE_NUMBER>`行を残す。issue番号が渡されていなければ、その行ごと削除する — 何も続かない中途半端な`Closes #`を残さないこと、また、issue番号が無いことをエラー扱いにしないこと。
- `<SUMMARY>`: コミットされた変更が何をするものかを、diff（およびissue番号が渡されていればそのREQ台帳）から推定した簡潔な要約。
- `<REQ_LIST>`: issue番号が渡されていれば、このPRのスコープに含まれるREQ-ID（`gh issue view <N> --json body -q .body`で台帳を取得し、このdiffに関係するアクティブなものを列挙する）。issue番号が渡されていなければ、このセクションごと削除する。
- `## 構造的制約`セクションと`<STRUCTURAL_REQ_LIST>`: issue番号が渡されている場合のみ関係する。スコープ内のREQ-IDのうち、`[structural]`タグが付いていて（例: `REQ-3: [structural] namespaceはFoo.Barであること`）まだアクティブな（`[superseded by ...]`になっていない）ものを探す。1件でもあればセクションを残し、該当する各REQのIDと内容を列挙する。1件も無い場合、またはそもそもissue番号が渡されていない場合は、セクション全体を削除する — 空のヘッダーを残さないこと。

PRタイトルは要約から、あるいはissue番号が渡されていればissueのタイトルから導く:

```bash
gh issue view <N> --json title -q .title
```

PRの本文はバッククォートや引用符を含みうる複数行のmarkdownなので、heredocを使ってPRを作成する:

```bash
gh pr create --draft --base <base-branch> --title "<title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

作成されたPRのURLをユーザーに報告し、そのPR番号（`<PR-number>`）を控える — URLの末尾のパスセグメントから取得するか（例: `.../pull/71` → `71`）、明示的に取得する:

```bash
gh pr view <head-branch> --json number -q .number
```

`<PR-number>`は以下のStep 6で必要になる。ここで`gh pr ready`を実行することは絶対にない — このskillはDraft PRの作成のみを行い、レビュー可能状態への変換は`review-pr`の責務であり、このskillの責務ではない。

## Step 6: スタックされたPRへのリンク — baseが明示指定された場合のみ

Step 2の`<base-branch>`がデフォルトブランチの自動検出によるもの（明示的なbaseが渡されていない）場合は、このステップ全体をスキップする。これは呼び出し元が明示的なbaseを渡してきた場合にのみ適用される — それが「このPRは別のPRの上に積む（スタックする）ものである」という合図になる。

headが`<base-branch>`である、既存かつまだopenなPRを探す — それがこのPRのスタック先になる。openなPRを優先し、openなものが無い場合のみ状態を問わずフォールバックする（既にmerge済み・close済みのPRにスタックしても意味が無いため）:

```bash
gh pr list --head <base-branch> --state open --json number -q '.[0].number'
```

- **番号が出力される:** それが`<prior-PR-number>`である — 以下で使う。
- **出力なし:** そのheadブランチに対するopenなPRが無い。状態を問わないフォールバックを試す（openでなくても前のPRがまだ関係している可能性があるため）:

```bash
gh pr list --head <base-branch> --state all --json number -q '.[0].number'
```

- **どちらの方法でもPRが見つからない（出力が空）:** スタックする先が無い（前のPRがまだ存在しないか、close済みの可能性がある） — スタック化をスキップし、PRはStep 5で作成したただのDraft PRのままにする。これはエラーではない。
- **どちらかの検索で（`<prior-PR-number>`として）PR番号が見つかった:** このPRを、今作成したばかりのPR（Step 5の`<PR-number>`）とGitHubのスタックPR機能でリンクする必要がある。それには`gh-stack`拡張機能が必要:

```bash
gh extension list | grep -q gh-stack
```

  - **未インストール:** 自動ではインストールしない。スタックされたPRにはこれが必要である旨をユーザーに伝え、インストールコマンドを提示する: `gh extension install github/gh-stack`。今回の実行ではスタック化をスキップし、PRはStep 5で作成したただのDraft PRのままにする — これはエラーではない。
  - **インストール済み:** 2つのPRを、下（古い方、`<prior-PR-number>`）から上（今回のPR、`<PR-number>`）へのスタックとしてリンクする:

```bash
gh stack link <prior-PR-number> <PR-number>
```

これは既存のスタックの拡張としても正しく機能する — `<prior-PR-number>`が既に前のグループからのスタックの一部である場合、この呼び出しは新しいPRをそのスタックの最上位に追加するのであって、別のスタックを新たに始めるわけではない。
