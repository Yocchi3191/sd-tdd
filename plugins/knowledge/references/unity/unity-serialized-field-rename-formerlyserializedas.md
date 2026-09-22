---
name: unity-serialized-field-rename-formerlyserializedas
description: SerializeFieldのリネームはFormerlySerializedAsを付け、実際にdirty化して保存確認するまで外してはいけない
domain: unity
tags: [unity, serialization, scriptableobject, refactoring, formerlyserializedas]
origin: ゲーム開発 (2026-09)
---

**原則**: UnityでSerializeFieldのフィールド名を変更する際は、新フィールドに`[FormerlySerializedAs("旧名")]`を付ける。かつ、既存アセットを実際にdirty化してディスクへ保存し、ファイル中身が新フィールド名に更新されたことを確認してから属性を外す。「Inspectorで開いて見ただけ」「File > Save Project」だけでは不十分。

**なぜ**: `_correction`というフィールドを`_arousalCorrection`にリネームしたケースで発生。属性を付けなければ次にUnityが読み込んだ瞬間、既存アセットの値が新フィールドに紐付かず既定値(0)にリセットされる。属性を付けてInspector上の値が正しく見えていても、Save Projectはdirtyなオブジェクトのみをディスクへ書き出すため、値を実際に変更していない限りアセットはdirty化されず、ファイルは旧フィールド名のまま残る。この状態で属性を外すと、次回ロード時に値が再び0に落ちる。

**どう適用するか**: (1) SerializeFieldのリネームは`[FormerlySerializedAs]`とセットで行う。(2) 対象アセット全部を実際にdirty化（スクリプトで`EditorUtility.SetDirty` + `AssetDatabase.SaveAssets()`を一括実行するのが確実）し、テキストとして中身を確認できるならファイルの中身を見て新フィールド名で書き出されたことを確認する。(3) 確認が取れてから初めて属性を外す。
