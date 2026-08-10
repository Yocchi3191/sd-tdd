---
name: review-pr
description: Use when the user wants a specific PR reviewed and, if clean, converted to ready for review — e.g. "PR #40をレビューして", "review-pr 40", or when run's own review step (after a Draft PR already exists) delegates here. Resolves BASE_SHA/HEAD_SHA/PLAN_OR_REQUIREMENTS/DESCRIPTION from the PR itself, then delegates to sd-tdd:review for the actual review. On a clean result (no Critical/Important findings), converts the PR to ready for review via `gh pr ready`; otherwise leaves it Draft and reports the outstanding findings.
---

# Review PR

入力が「現在の作業ブランチ」ではなくPR番号である場合の、`sd-tdd:review`に対する薄いアダプタ。レビュー本体は`review`が担い、このskillはそれをPR形式の入力に合わせるアダプタと、PRが存在して初めて意味を持つロジック（クリーンな結果の場合にready for reviewへ切り替える処理）だけを担う。

## Step 1: PR番号は必須

このskillは常にPR番号を必要とする。指定が無ければ求める — 現在のブランチから推測することは絶対にしない（それは`review`の仕事であり、このskillの仕事ではない）。

## Step 2: PRからBASE_SHAとHEAD_SHAを解決する

```bash
gh pr view <N> --json baseRefName,headRefName,title,body
```

その出力から実際の`baseRefName`・`headRefName`の値を取得し、以下のすべてのコマンド内の`<baseRefName>`/`<headRefName>`をそれらの値に置き換える — 以下の2つのブロックはどちらもこの値に依存している。

両方のrefをfetchし、ローカルのgitがdiffを取れるようコミットを用意する:

```bash
git fetch origin <baseRefName> <headRefName>
```

```bash
git merge-base origin/<baseRefName> origin/<headRefName>
git rev-parse origin/<headRefName>
```

- `BASE_SHA` = `git merge-base`の出力 — PRのheadブランチが実際のbaseブランチから分岐した地点（リポジトリのデフォルトブランチとは限らない — これにより、デフォルトブランチのみを対象とする`review`自身の自己算出とは異なり、PRグループの積み上げPRに対しても`review-pr`が正しく動作する）。
- `HEAD_SHA` = PRのheadブランチの最新コミット（`git rev-parse origin/<headRefName>`）。

**適用範囲についての補足:** これはPRのheadブランチが`origin`上に存在することを前提としている（このプロジェクトのworktreeベースのワークフローでは常に成立する）。フォーク由来のPRのheadブランチはこの方法では解決できない — この点はスコープ外とし、`submit`が`origin`へのpushについて置いている前提と同じである。

`gh pr view <N>`が失敗した場合（該当PRが無い、リポジトリ指定が誤っている等）、処理を止めてユーザーに報告する。部分的なデータのまま処理を進めてはならない。

## Step 3: PR本文からPLAN_OR_REQUIREMENTSを解決する

Step 2で取得したPR本文からissue参照を探す:

```
/(?:Closes|Part of) #(\d+)/i
```

同じ本文内に`Closes #N`と`Part of #M`の両方が存在する場合は`Closes`を優先する — このPRが完全に解決することを意図しているissueを名指ししており、より具体的なシグナルだからである。

- **マッチした場合:** そのissueのREQ台帳を取得し、PLAN_OR_REQUIREMENTSとして使う:

```bash
gh issue view <matched-N> --json body -q .body
```

このコマンドが失敗した場合（issueが削除された、番号が誤っている、非公開でアクセスできない等）、処理を止めたりPLAN_OR_REQUIREMENTSを空のままにしたりせず、下記の「マッチしない場合」と同様にPR自身のタイトルと本文にフォールバックし、参照先issueを取得できなかった旨を最終報告に記載する。

- **マッチしない場合:** 他の方法でissueを探しに行かない。代わりにPR自身のタイトルと本文（Step 2で取得済み）をPLAN_OR_REQUIREMENTSとして使う。`Closes`/`Part of`参照の無いPRは正常な状態であり、エラーではない。

## Step 4: DESCRIPTIONを解決する

PRが何を行うかの簡潔な要約。タイトルと本文（Step 2）から推測する — 1〜2文程度。

## Step 5: sd-tdd:reviewに委譲する

`sd-tdd:review`を呼び出し、上記で解決した4つの値（BASE_SHA、HEAD_SHA、PLAN_OR_REQUIREMENTS、DESCRIPTION）を渡す。これにより`review`はStep 0のショートカットを取り、`superpowers:requesting-code-review`のディスパッチへ直行する — `review`に「現在の作業ブランチ」からこれらを再算出させてはならず、ここから直接`superpowers:requesting-code-review`を呼び出してもいけない。必ず`review`を経由させ、実際のレビューディスパッチを担う場所を一箇所に保つ。

## Step 6: レビュー結果に応じて行動する

`review`が報告するAssessmentを読む:

- **CriticalまたはImportantの指摘が一件も無い場合**（Minorな指摘のみ、または指摘無し）: 対象PRをready for reviewに切り替える:

```bash
gh pr ready <N>
```

その上で、PRのURLと簡潔なレビューサマリ（Minor指摘があればそれも含む）をユーザーに報告する。

- **CriticalまたはImportantの指摘が一件でもある場合:** PRをDraftのままにする — `gh pr ready`は実行しない。残っている指摘内容をそのままユーザーに報告する。このskill自体はリトライ・自動修正・再レビューへのループバックを行わない。修正がpushされた後に`review-pr`を改めて呼び出すことが再レビューにあたる（リトライ・エスカレーションの上限があるとすれば、それはこのskillをループで駆動する`run`側の関心事であり、このskill自身の関心事ではない）。
