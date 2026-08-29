---
name: submit
description: 現在の作業ツリーの変更をコミットしてDraft PRを開きたいときに使う — 例:「submitして」「今の変更をPRにして」。未コミットの変更を推定メッセージでコミットし、head/baseブランチを自動検出してpushし、pr-template.mdからDraft PRを作成する。PRをready for reviewに変換することは決して行わない — それはreview-prの役目である。
---

# Submit

作業ツリーの内容を、pushされたブランチとDraft PRに変換する。他のskillが先に走っている必要はない。

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

baseブランチはリポジトリのデフォルトブランチを検出して使う:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

現在のブランチが`<base-branch>`そのものである場合、submitする対象が無い旨をユーザーに伝えて停止する — PRにはbaseと異なるheadブランチが必要である。

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

このskill自身のディレクトリ（この`SKILL.md`と同じ場所）に`pr-template.md`があるか確認する。これはPR本文の構造に関する唯一の正とする情報源であり、ここでその内容を重複して持たせることはしない。

- **既に存在する場合:** そのまま再利用する — 絶対に上書きしない。
- **存在しない場合:** 続行する前に作成する — PR本文をテンプレート無しで即興生成することはしない。以下を順に含める必要がある: 任意の`Closes #<ISSUE_NUMBER>`行（issue番号が渡されなかった場合に削除する旨のコメント付き）、`<SUMMARY>`プレースホルダを持つ`## 概要`セクション、`<REQ_LIST>`プレースホルダを持つ任意の`## 変更対象のREQ`セクション（REQ台帳が無い場合に削除する旨のコメント付き）。

## Step 5: テンプレートを埋めてDraft PRを作成する

`pr-template.md`を読み込み、プレースホルダを埋める:

- `<ISSUE_NUMBER>`: 今回の呼び出しにissue番号が渡されていれば、それを埋めて`Closes #<ISSUE_NUMBER>`行を残す。issue番号が渡されていなければ、その行ごと削除する — 何も続かない中途半端な`Closes #`を残さないこと、また、issue番号が無いことをエラー扱いにしないこと。
- `<SUMMARY>`: コミットされた変更が何をするものかを、diffから推定した簡潔な要約。
- `## 変更対象のREQ`セクションと`<REQ_LIST>`: issue番号が渡されていて、かつそのissueに`REQ-<n>:`行がある場合のみ残す。`gh issue view <N> --json body -q .body`で本文を取得し、このdiffに関係するアクティブなREQ-IDを列挙する。issue番号が無い場合、またはREQ行が1件も無い場合はセクションごと削除する — 空のヘッダーを残さないこと。REQ台帳が無いこと自体はエラーではない。

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

作成されたPRのURLをユーザーに報告する。

ここで`gh pr ready`を実行することは絶対にない — このskillはDraft PRの作成のみを行い、レビュー可能状態への変換は`rally:review-pr`の責務である。
