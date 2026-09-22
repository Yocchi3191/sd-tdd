---
name: layered-call-chain
description: レイヤーごとのオブジェクトの役割と呼び出し関係を図で固定し、配置の意思決定コストをなくす
domain: design
tags: [layered-architecture, call-chain, controller, presentation-layer, ddd, dependency-inversion]
origin: ゲーム開発 (2026-07-17)
---

**原則**: Framework/Presentation/Application/Domainの4層それぞれに置くオブジェクトの種類と、誰が誰を呼んでよいかを次の形に固定する。

- Framework: `RepositoryImpl`, `UI`, `入力デバイス`, `View`, `ステートフルPOCO`
- Presentation: `Controller`, `Adapter`, `Handler`, `Presenter`
- Application: `UseCase`, `IRepository`
- Domain: `Entity`

呼び出し関係:
- `入力デバイス` / `View` / `UI` → `Controller`(唯一の起点)
- `入力デバイス` → `ステートフルPOCO`(Controllerを介さない直接パスも例外として許容)
- `Controller` → `Adapter` / `Handler` / `Presenter`(翻訳・提示のための協力者。次に何を呼ぶかは決めない)
- `Presenter` → `Entity`(readonlyのみ。表示専用)
- `Controller` → `UseCase`
- `UseCase` → `IRepository` / `Entity`
- `RepositoryImpl` ..|> `IRepository`、`RepositoryImpl` → `Entity`

**なぜ**: 新しいクラスを書くたびに「これはControllerに書くべきか、それともAdapterか」「Presenterから直接Entityを書き換えていいか」を都度議論・判断していると、実装者(人間・AI問わず)ごとに置き場所がブレて、レビューも「なぜここに置いたか」の説明合戦になる。DDDの各オブジェクトの基本形を先に図として固定しておけば、配置の判断は「図と一致しているか」の一点に単純化でき、意思決定コストがほぼゼロになる。逆に図から外れる配置(例: Adapterが次のオブジェクトを自分で呼ぶ、Presenterが書き込みをする)は、動作しても「基本形からの逸脱」として機械的に差し戻せる。

**どう適用するか**: 新しいオブジェクトを追加する前に、まずこの図の4層のどこに属するか、どの矢印(呼び出し関係)を持つかを先に決めてから実装する。特に次の2点を強く守る: (1) 「次に何を呼ぶか」を決める権利はController(またはUseCase/RepositoryImpl相当の起点)だけが持ち、翻訳・提示のための協力者(Adapter/Handler/Presenter)は純粋な変換・読み取りに徹する。(2) 書き込みは常にUseCase経由。Presenterなど表示系のみEntityへのreadonlyアクセスを例外として許容する。
