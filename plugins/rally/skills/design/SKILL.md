---
name: design
description: rally:spec-interviewでissueの要件・仕様が固まった後、設計フェーズの先頭で使う。issueの仕様（REQ）をもとに設計を行い、ADR（何を検討し、なぜその設計にしたか）を作成する — 何を決めるかの判断はユーザーが先に示し、Claudeはそれを踏まえた叩き台や差分で詰める。ADRはissueには一切書かず、PR作成時にPR本文へ展開する。
---

# Design

issueの仕様（REQ）をもとに設計を行い、ADRを作成する。issue起票フェーズではなく、実装に着手するタイミング（設計フェーズ）で呼ばれる — 設計は実装に近いタイミングで決める方が、コードの実態と乖離しない。

**ユーザーがドライバー、Claudeがコ・ドライバー。** 何を決めるかの判断はユーザーが持ち、Claudeはそれを踏まえた叩き台や差分で詰める。

着手前に `references/pairing.md`（このskillが属する `rally` プラグインのルート相対）を読み、そこの詰めルールに従って対話する。詰めルールはそちらが唯一の正であり、このファイルでは繰り返さない。

## Step 1: 作業ブランチを切る

`superpowers:using-git-worktrees` に従って専用のworktreeとブランチを用意する。既に作業ブランチにいる場合はスキップする。

呼び出し順は spec-interview → design → tdd であり、design はこの時点で最初に実装作業へ入る skill である — `rally:tdd` のStep 0を待たず、このskill自身が確立する。Step 4で書く `.rally/adr.md` はworktree内の未追跡ファイルという前提のため、worktreeが無い状態で書き始めてはならない。専用worktreeが確立していれば、後続の `rally:tdd` のStep 0は「既に作業ブランチにいる場合はスキップする」の分岐でそのまま素通りする。

## Step 2: issueの仕様を読む

対象issueの本文を取得し、REQ台帳・背景・完了条件を確認する。ここまでに確定した要件・仕様が、これから行う設計の前提になる。

## Step 3: 軽重を内部で判断する

パッチ相当（1ファイルの修正、既存コードの単純な延長など）だと判断したら、詰めずに「設計不要」と一言で終える。構造・インターフェースに関わる変更なら、Step 4以降で詰める。

重さ分類をissue側の判定結果に依存させない — issue起票時点の情報は着手時点のコード実態を反映しているとは限らないため、このskill自身が着手時点で都度判断する。これは`rally:spec-interview`の調査/改修/構造変更分類とは別の軸ではなく、同じ「どれだけ詰めるか」の判断を着手時点で取り直しているだけである。

## Step 4: 詰める

`references/pairing.md` の詰めルールに従う。責務分割・インターフェース・依存関係・YAGNIの観点で、ユーザーの案への差分（削る・穴を指摘する・差し替えを提案する）を出す。

## Step 5: 決定をまとめる

`references/pairing.md`（9節）の3点フォーマット（決定内容/検討した代替案/却下理由）でまとめる。

まとまった決定は、worktree内の `.rally/adr.md`（未追跡ファイル）に追記していく。issue本文にもissueコメントにも書かない — issueは「何をしてほしいか」の依頼書であり、ADR（何を検討し、なぜその設計にしたか）とは役割が異なる。ADRの永続的な置き場所は、このあと作られるPRの本文である。

初めて `.rally/adr.md` に書き込む前に、`.rally/` が `.gitignore` に含まれているか確認する: `git check-ignore -q .rally`。含まれていなければ `.gitignore` に `.rally/` を追記してコミットしてから書き込む。これを怠ると、`rally:submit` のStep 1（`git add -A`）がStep 5（ADRの読み取り・削除）より先に走り、未追跡のはずの一時ファイルがコミットされてしまう。

## Step 6: 設計の結果、REQを追加すべきと判断したら

`rally:task-filing` の既存タスクへ追記する操作を使い、issueのREQ台帳を更新する。設計の過程でテスト観点の抜けに気づいた場合はここで扱う — ADRの記録とは別の経路である。

## Step 7: 実装へ渡す

決定がまとまったら `rally:tdd` に引き渡す。`.rally/adr.md` はworktree内に残り、`rally:submit` がPR作成時に読み込んで展開する。

## superpowers:brainstormingを呼ばないこと

brainstorming は「Claudeが2〜3案を提示し、人間が承認する」向きで、このskillと真逆。呼ぶとユーザーの役割が承認者に固定され、このskillの目的が消える。

委譲してよいのは、ユーザーが明示的にゼロベースの案出しを求めたときだけ（`references/pairing.md` の脱出ハッチ）。

委譲する場合も、brainstormingのarchitecturalパスが `docs/superpowers/specs/` へdesign docを書いてcommitする手順は踏ませない。案は対話で返させ、Step 5の3点フォーマットで `.rally/adr.md` に記録する。
