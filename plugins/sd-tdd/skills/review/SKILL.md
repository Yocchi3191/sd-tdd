---
name: review
description: ユーザーがPRの存在を前提とせず、現在の作業ブランチをレビューしてほしいときに使う。たとえば "reviewして"、"今の変更をレビューして"、"コードレビューして"。superpowers:requesting-code-review経由でcontext-resetされたsubagentをディスパッチし、ブランチの分岐点から最新コミットまでの差分をレビューする。PRをready for reviewに変換することは決して行わない — それはreview-prの役目であり、PR番号が渡されたときにこのskillをラップする。
---

# Review

PRの存在を前提とせず、現在の作業ブランチの差分に対してコードレビューを実行する。これは`sd-tdd:submit`の"レビュー版"にあたるskillで、`submit`が変更をPRに変換するのに対し、`review`は変更をレビューするだけである — 作業の途中、PRがまだ存在しない段階、あるいはセカンドオピニオンが欲しいときにいつでも使える。`sd-tdd:review-pr`は、入力が「現在のブランチ」ではなくPR番号である場合に、このskillの上に被せる薄いアダプタである。

## Step 0: BASE_SHA/HEAD_SHA/PLAN_OR_REQUIREMENTS/DESCRIPTIONは既に揃っているか？

この呼び出しの時点でこれら4つがすべて解決済みとして渡されている場合(例: `sd-tdd:review-pr`がPRの実際のbase/headとbodyから解決して渡すケース) — Step 1〜3は完全にスキップし、渡された値のままStep 4に進む。以下のStep 1〜3は、何も渡されなかったときに「現在のブランチ」からこれらの値を導出するためだけに存在する。

## Step 1: 現在のブランチからBASE_SHAとHEAD_SHAを算出する

```bash
git branch --show-current
```

これが何も出力しない場合(detached HEAD)は、reviewには名前付きブランチが必要であることをユーザーに伝えて停止する。

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

現在のブランチがこのデフォルトブランチ*そのもの*である場合は、レビュー対象が無いことをユーザーに伝えて停止する — レビューには独自のコミットを持つブランチが必要である。

ここで、`<default-branch>`をデフォルトブランチ名に置き換えたうえで:

```bash
git merge-base HEAD origin/<default-branch>
git rev-parse HEAD
```

- `BASE_SHA` = `git merge-base`の出力 — 現在のブランチがリポジトリのデフォルトブランチから分岐した地点。
- `HEAD_SHA` = 現在のブランチの最新コミット(`git rev-parse HEAD`)。

このブランチにPRが存在するかどうかに関わらず、無条件にこれを行う — これらのSHAをユーザーに尋ねたり、先にPRの存在を要求したり、PRを探しに行ったりすることは決してしない。

**スコープの制約:** これは常にリポジトリの*デフォルト*ブランチとの差分を取る。スタックされたブランチ(例: デフォルトブランチではなく別のfeatureブランチを元にしたPRグループブランチ)の場合、報告される差分にはそのベースブランチ自身のコミットも含まれてしまう — non-defaultなベースを検出・対象化する手段は無い。これはバグではなく既知の制約として扱うこと: 異なるベースが必要な呼び出し元(例: 別のPRにスタックされたPRをレビューする`review-pr`)は、このStepに頼らず、自分自身でBASE_SHAを解決してStep 0経由で渡す必要がある。

## Step 2: PLAN_OR_REQUIREMENTSを決定する

- **この呼び出しにissue番号が渡されている場合:** そのissueのREQ台帳を取得し、PLAN_OR_REQUIREMENTSとして使う:

```bash
gh issue view <N> --json body -q .body
```

- **issue番号が渡されていない場合:** issue番号を探しに行かない。コミットログと差分の内容(`git log <BASE_SHA>..<HEAD_SHA>`、`git diff <BASE_SHA>..<HEAD_SHA>`)から、このブランチが何を達成しようとしているかの簡潔な要約を推定し、それをPLAN_OR_REQUIREMENTSとして使う。ここでissue番号が無いのは正常な状態であり、エラーではない。

## Step 3: DESCRIPTIONを決定する

Step 2で使ったのと同じコミットログ/差分から推定した、実装内容の簡潔な要約 — 1〜2文。

## Step 4: superpowers:requesting-code-review経由でレビュアーをディスパッチする

`superpowers:requesting-code-review`をそこに記載されている通りに呼び出す — このskillは新しいレビュー用プロンプトやテンプレートを一切導入しない。そのテンプレートには以下を埋める:

- `DESCRIPTION`: Step 3の結果。
- `PLAN_OR_REQUIREMENTS`: Step 2の結果。
- `BASE_SHA` / `HEAD_SHA`: Step 1の結果。

## Step 5: 結果を報告する — PRの状態は決して変更しない

レビュアーのStrengths / Issues / Recommendations / Assessmentをそのままユーザーに報告する。

レビューの結果がどうであれ — Critical/Importantな指摘が一件も無いクリーンな結果であっても — このskillは`gh pr ready`、`gh pr merge`、その他PRの状態を変更するコマンドを一切実行しない。Draft PRをready for reviewに変換するのは`review-pr`の責務であり、このskillの責務ではない。`review`はPRの存在すら前提としないため、PRの状態について一切関与しない。
