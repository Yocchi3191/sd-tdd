---
name: design-planning
description: Use when a human brings a concrete design proposal (interface design, responsibility split, architecture decision) and wants a pairing partner to review and refine it, before or alongside spec-interview — spec-interview only produces a testable REQ ledger (acceptance criteria) and treats architecture decisions as out of scope. Unlike superpowers:brainstorming (AI proposes, human approves), here the human brings the design and Claude collaborates on it like a pair-programming partner, raising YAGNI/simplicity observations in natural conversation rather than forced question-and-answer. Once a design decision is finalized, hands it to task-filing instead of writing to the issue itself.
---

# Design Planning

`sd-tdd:run` のパイプラインには「設計フェーズ」（インターフェース設計・責務分割・アーキテクチャ判断）が存在しない。`spec-interview` が作るのはREQ台帳（受け入れ条件）だけで、アーキテクチャ判断はその対象外。このスキルはその空白を埋める — 人間が持ち込んだ設計案に対し、AIがペアプログラミングの相方のように、YAGNI・シンプルさの観点で気づいたことを自然に伝え、一緒に設計をブラッシュアップする。

対話の向きは `superpowers:brainstorming` とは逆であることに注意する。brainstormingは「AIが提案 → 人間が承認」。このスキルは「人間が設計案を持ち込む → AIが一緒にブラッシュアップする」。そのまま流用しない。

## 対話の進め方

- 問答法（質問形式）を強制しない。気づいたことは疑問文でも平叙文でも、そのときに自然な言い方で伝えればよい。
- 「疑問形にしない」「同じ論点を繰り返し聞かない」といった禁止事項をここに列挙することはしない。通常の対話であれば自然に問題にならない — 型にはめる方がかえって不自然な対話を生む。
- 人間が持ち込んだ設計案を起点に、責務分割・インターフェース・依存関係・YAGNI（将来のための過剰な抽象化）などの観点で気づいたことを伝える。人間の判断を尊重しつつ、双方が納得するまで一緒に磨き上げる姿勢を保つ。

## 設計判断が確定したら

決定内容が固まったら、次の3点を含む形でまとめる:

1. **決定内容**: 何を決めたか
2. **検討した代替案**: 他にどんな選択肢を検討したか
3. **却下理由**: なぜその代替案を採らなかったか

この3点構成は `task-filing` の `task-template.md` にある `## 決定事項` セクションのコメント（「検討した代替案と、それを採用しなかった理由」）にそのまま対応する。

## issueへの書き込みは行わない

このスキル自身は `gh issue edit` などでissueを直接更新しない。確定した設計判断は `task-filing` に渡す:

- 対象のissueが既にある場合: `task-filing` の「Append to an existing task」operationに渡し、`## 決定事項` セクションを更新してもらう。
- 対象のissueがまだ無い場合: このスキル自身は新規issueを起票しない。`task-filing` の「File a new task」operationは `## やること・要件` へのREQ台帳の転記を必須とするが、design-planningが扱うのは設計判断であってREQ台帳ではないため、このスキル単独でその必須項目を満たせない。まず `spec-interview` → `task-filing` でREQ台帳付きのissueを起票してもらい、issueが成立してから上記の「Append to an existing task」操作で決定事項を渡す。

対話が長くなり、`task-filing` に渡すまでの間に内容が失われる懸念がある場合（対象issueがまだ無く、成立を待つ間も含む）は、確定した決定を都度、一時ファイルに書き出しておく。`task-filing` への引き渡しが完了すれば、一時ファイルはその後不要になる。

## スコープ

`sd-tdd:run` パイプラインへの組み込みは `run` の「Starting new work」フロー（コードベース調査の直後）で行われる（issue #42）。単体でも呼び出して使える。
