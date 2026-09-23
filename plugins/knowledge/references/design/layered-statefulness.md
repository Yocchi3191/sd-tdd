---
name: layered-statefulness
description: レイヤーごとにステートフル/レスを判断し、Presentation層はステートレスに保つ
domain: design
tags: [layered-architecture, state-management, presentation-layer, controller]
origin: ゲーム開発 (2026-07-16)
---

**原則**: Framework層とDomain層はステートフルでよいが、Presentation層とApplication層はステートレスに保つ。コントローラはリクエストごとに使い捨てる。

**なぜ**: 使い回し前提のインターフェース・シグニチャが実は内部にステートを持っていると、呼び出し側にとって驚きが生まれる。前のリクエストの状態が残ったまま次のリクエストで使われるなど、途中のトランザクションにステートが紛れ込むと、再現性のないバグや使いにくいAPIの原因になる。

**どう適用するか**: レイヤー設計時はこの表を判断基準に使う(Framework=フル / Presentation=レス / Application=レス / Domain=フル)。コントローラはリクエストごとに使い捨てる。どうしてもステートフルなPresentationオブジェクトが必要な場合は、それをFramework層のオブジェクトに使わせる構造にし、ロジック自体はAPI(Application/Domain)側に持たせることでPresentation自体はステートレスに保つ。
