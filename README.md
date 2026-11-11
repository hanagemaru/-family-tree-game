# 家系図ならべ（仮）

歴史人物と競走馬のカードをドラッグして、家系図・血統図を広げるブラウザゲーム。

- 手札は最大5枚。カードを置くと、左下の山札から自動で補充。
- 場のカードへドロップしてから、固定の選択画面で「親・子・配偶者・兄弟姉妹」を選んで配置。
- 小さい相手は一覧から選択。ドロップ失敗やキャンセル後も選択札を保持。
- 同じ人物は1枚。複数の正しい関係から配置可能。
- タップ → 場のカード → 関係選択、キーボードによる代替操作あり。
- 場と手札は境目のない一枚のテーブル。盤面のスワイプ移動、ピンチ・ボタンで拡縮、全体表示・盤面だけの閲覧。
- 両親の横線から子への枝、接続点の●、交差の切れ目、カード選択時の関係線の強調。
- 2段階の任意ヒント、詰まり防止の自動補充（任意の手札交換は廃止）、自動保存、完成記録。
- 徳川家18人、競走馬24頭の2ステージ。追加カードは史料と血統データで出典を確認。

## 試作

旧試作環境: https://family-tree-cards.ideal-betta-1941.chatgpt.site

このURLが現行PRブランチを配信しているとは限りません。改修版は [PR #1](https://github.com/hanagemaru/-family-tree-game/pull/1) に保持し、マージ前に直接プレビューで試します。公開URLはPRの説明欄を参照してください。

## 開発

依存パッケージなし。Node.js 22以上とPython 3で動作。

```sh
npm test
npm run build
npm run dev
```

`http://localhost:5173` を開く。`dist/` は任意の静的ホスティングへ配置できる。
ES Modulesを使用するため、`index.html` の直接ファイル開きではなくHTTPサーバーを使う。

## 構成

- `src/core.js`: 関係判定、手札、配置、保存データ検証、カメラ計算
- `src/diagram.js`: 家族単位の配置、関係線、接続点、交差の切れ目
- `src/interaction.js`: ドラッグの見た目と判定位置、カードのヒット領域、ドロップ後の分岐
- `src/data.js`: 登場人物・馬、実親子・婚姻、ヒント、出典
- `src/app.js`: Pointer Events、画面、盤面、ローカル保存
- `docs/design.md`: 決定事項、今回の暫定仕様、未決事項
- `docs/validation.md`: 検証内容と未確認事項
- `docs/review-2026-10-15.md`: 操作の再設計後の自己レビューと修正記録

企画元: [hanage-ideas / new-game-ideas.md](https://github.com/hanagemaru/hanage-ideas/blob/main/games/new-game-ideas.md)
