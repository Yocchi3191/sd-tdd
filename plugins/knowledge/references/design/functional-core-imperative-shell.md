---
name: functional-core-imperative-shell
description: 副作用の有無でオブジェクトをFunctional Core(純粋)とImperative Shell(副作用)に二分し、CQRSのオブジェクト版として配置判断に使う
domain: design
tags: [functional-core-imperative-shell, cqrs, side-effects, purity, layered-architecture]
origin: ゲーム開発 (2026-07-17)
---

**原則**: オブジェクトを副作用の有無で二分する。Functional Core = 純粋関数オブジェクト(入力から出力を計算するだけ。例: Adapter, Entity)。Imperative Shell = 他のオブジェクトを呼び出し副作用を起こすオブジェクト(例: Controller, UseCase)。この二分はCQRSのオブジェクト版であり、「このクラスは副作用を起こすか」を配置判断の軸に加える。

**なぜ**: レイヤー([[layered-call-chain]])だけで配置を決めると、同じ層の中に副作用あり/なしが混在し得る。例えばPresentation層に「入力を変換するだけのAdapter」と「次のオブジェクトを呼ぶController」が両方存在すると、「Adapterから次を呼んでもいいのでは」という逸脱が起きやすい(layered-call-chainで指摘されている逸脱と同種)。Functional Core/Imperative Shellの二分を明示すると、「副作用を起こしていいのはShellだけ」という一段抽象的なルールになり、逸脱を機械的に判定しやすくなる。

**どう適用するか**: 新しいクラスを設計するとき、まず「これは副作用を起こすか」を問う。起こさないならFunctional Core(Adapter/Entity/純粋変換関数)として、外部依存を持たず入出力だけで完結させる。起こすならImperative Shell(Controller/UseCase)として、副作用(呼び出し・永続化・状態変更)はここに集約する。[[layered-call-chain]]のレイヤー配置と組み合わせて使う: レイヤーは「どこに置くか」、Functional Core/Imperative Shellは「副作用を持たせてよいか」を判定する直交した軸。
