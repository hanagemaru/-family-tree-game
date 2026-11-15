# 競走馬血統ならべ

実在する競走馬の血統をカードでつなぐブラウザゲーム。**1問12頭、最大4世代**。初級・中級・上級では出題される馬の知名度が異なり、毎回ランダムに出題されます。

## ルール

- 手札から馬を選び、場の馬に対して「親・子・きょうだい」の関係を指定して配置。手札は最大5枚。
- 1段階のヒント（場でつながる馬の名前だけ）：**+10秒**。誤回答は**1回+15秒**。1頭の正しい自動配置は**+45秒**（その頭のヒント料金を含む）。
- **実プレイ時間＋各ペナルティ＝補正タイム**。メニュー表示中やページ非表示中はタイマーを停止。
- ランキングは**初級・中級・上級で独立**。匿名プレイヤー1人につき各難易度の自己ベスト1件だけを保存。
- オンラインランキングはプレイ開始時の署名付きチケットと操作履歴をサーバーで検証して登録。端末内の自己ベストはオフラインでも保存。
- 馬名、血統関係、知名度相対順位は出典付きのWikidata・Wikimedia等の固定スナップショットから抽出。
- 徳川家の固定ステージなどは公開画面に表示しません。家系図シリーズ化する場合は別アプリにする方針です。

## 公開準備中の構成

- 本体公開予定URL：`https://hanage.app/games/horse-pedigree/play/`。
- `hanagemaru/hanage-hub` 側の紹介ページ：`/games/horse-pedigree/`。**現時点では公開フラグOFF**のため、サイトの「遊ぶ」から未公開URLへ誘導しない。
- `src/server/worker.js` と `migrations/0001_horse_ranking.sql`：専用Cloudflare Workerと**独立したD1**ランキングDB（Sweeper/PuttのDBは共用しない）。
- `wrangler.hub.jsonc`：本番用のRoute設定案。**D1のdatabase_idは未設定**、`RANKING_SECRET` も本番では別途設定する。公開には接続・検証が必要。
- `wrangler.test.jsonc`：ローカルE2Eテスト専用のダミーID・秘密鍵。**本番に使わないこと**。
- 旧18頭問題は生成器v1〜v4で復元可能。新12頭問題v5とスコアランキングは区別し、過去のスコアを混ぜない。

## 関連資料

- [12頭版・ランキング公開手順](docs/horse-v5-ranking-release-2026-11-15.md)
- [初級知名度調整と実測](docs/horse-easier-beginner-2026-11-15.md)
- [ランダム出題の過去実装](docs/random-horse-implementation.md)
- [シリーズ戦略](docs/release-series-strategy-2026-11-14.md)

## 開発

ゲーム本体の開発にはNode.js 22以上とPython 3を使用。ランキングのWorker/D1ローカル検証には別途Wrangler v4を使用。

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
