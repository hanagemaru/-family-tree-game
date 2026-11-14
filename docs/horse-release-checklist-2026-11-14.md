# 「競走馬血統ならべ」初回公開チェックリスト（2026-11-14）

## 確定
- 正式名：**競走馬血統ならべ**（「ならべ」シリーズ第1弾）。
- 第1弾は競走馬のみ公開。徳川家は将来別アプリ。共通エンジンの切り出しは現時点で不要。
- リポジトリ：`hanagemaru/-family-tree-game` を競走馬単独の公開起点として使う。

## 実装済み（feature/horse-pedigree-narabe-launch-20261114）
- [x] タイトル、ページ説明、OG・Twitterのテキスト共有メタデータを競走馬専用へ更新。
- [x] トップから歴史人物の紹介を外す。「ランダム18頭」「固定24頭」の2モードだけ表示。
- [x] シリーズ表記「ならべシリーズ 第1弾」、馬の親子関係のデモに統一。
- [x] スポーツトレカ風の控えめな競走馬ブランドアイコン・faviconを独自SVGで作成。
- [x] Web App Manifestを追加。ホーム画面に追加するための基本メタデータ。
- [x] ビルド対象に`launch.css`、`manifest.webmanifest`を追加。
- [x] 既存の徳川家データ・ゲーム判定・保存データは**削除せず**維持。公開メニューからは非表示。
- [x] 血統の出典画面を競走馬向けに整理。Wikidata/日本語Wikipediaの出典と留保を説明。
- [x] READMEとリリース方針を正式名へ更新。

## コード検証
- [x] Node.js 101件・Python 6件・静的ビルドが成功（[CI #43603705597](https://github.com/hanagemaru/-family-tree-game/actions/runs/43603705597)）。
- [x] Chromium / WebKit の390×844相当の実ブラウザでホーム2モード・ドラッグ・ヒント・完成を確認（同CI、画面画像もartifactに保存）。
- [ ] iPhone実機のSafariで縦表示・手札・スクロール・ヒント・全体ズームを目視確認。
- [ ] Android Chromeなどの別端末があれば追試。

## 本番公開のための未完了
- [ ] **URLの正式決定**。ハブ側の現行方針に従い `hanage.app` のパス配下でゲーム本体を公開する。**提案**：`https://hanage.app/games/horse-pedigree/play/`。従来提案の `keito.hanage.app` は取り下げる。
- [ ] `hanage-hub` に紹介ページ `/games/horse-pedigree/`、必要なら遊び方 `/games/horse-pedigree/how-to-play/` を追加する。紹介からゲーム本体は**別タブ**で開く。既存のPutt・Sweeperを壊さない。
- [ ] 競走馬アプリのリポジトリと配信Workerはハブと分離したまま、**Cloudflare Workers（Static Assets）の専用パスRoute**でゲームを配信する。Puttの本番構成を参考に `/games/horse-pedigree/play` と `/games/horse-pedigree/play/*` の2Routeを検証する。**ハブのWorkerやCustom Domainを上書きしない**。
- [ ] `npm run build` の `dist/` を専用Workerで配信する設定を追加する。Workerのアセットベースパス、JS/CSS/JSONの相対パス、Web App Manifestの `start_url` と `scope` を本番パスに合わせてテストする。
- [ ] 公開前に本番ZoneのRoute競合を監査し、独立プレビューで動作確認・切り戻し手順を確立する。承認なしに既存ルートやWorkerを変更しない。
- [ ] 本番URLでHTML・CSS・JS・血統JSON・iPhone実機操作を確認し、`www.hanage.app` のゲーム専用パスが重複オリジンとして残らないよう既存Putt同様にリダイレクト方針を検討する。
- [ ] 本番URLが確定したら canonical・OG URL を設定し、サイトマップとハブの作品一覧・紹介ページからリンクする。未公開URLをサイトマップに追加しない。
- [ ] ハブの公開設定とゲーム配信の順序を調整する。まずゲームURLが正常に開けることを確認し、その後ハブの「遊ぶ」導線を公開する。
- [ ] 広告・アクセス解析を導入する場合は、プライバシー案内と公開要件を追加検証（現状は広告/解析を新設していない）。
- [ ] 使用したデータのライセンス・出典の最終確認。特にWikipediaの版と記事リンクを維持する。
- [ ] 商標・同名サービスとの重複がないか正式公開前に確認。
- [ ] 開始からクリアまで数回のランダム問題を実機試遊し、難易度やレイアウトに破綻がないか確認。

## 運用上の注意
- 今回の改修はゲームのルールや保存形式を変更しない。既存のローカル保存キー `family-tree-game:v1` は維持。
- 公開済みサイトを既に設定したと主張しない。Worker Route・ハブの新しい紹介ページ・公開URLは未設定。独自の新サブドメインは作成しない。
- Web App Manifestの追加のみでオフライン対応が成立するわけではない。Service Workerは未導入。
- 新しい写真素材は未導入。既存の共通ベクター馬図柄を使用する。

## URL設計の根拠（2026-11-14 追記）

- 現行の正本：[`hanage-hub/docs/PROJECT_STATUS.md`](https://github.com/hanagemaru/hanage-hub/blob/main/docs/PROJECT_STATUS.md) 冒頭「2026-11-14: Puttをhanage.app配下で本番公開」。
- 公開済みの先行例：Putt紹介 `https://hanage.app/games/putt/`、ゲーム `https://hanage.app/games/putt/play/`。
- ハブとゲームのリポジトリ・Workerは分離し、同一オリジン `hanage.app` のゲーム別パスで配信。
- 旧URLを維持する移行方針は既存のPutt / Sweeperのためのもの。競走馬版には既存の本番サブドメインがないため、最初から `hanage.app` のパスで公開すればよい。
- `horse-pedigree` は英語として短く、血統が主題と分かる候補。日本語正式タイトル「競走馬血統ならべ」とURLの字面を一対一に合わせる必要はない。**未承認のためURLは仮案**。
