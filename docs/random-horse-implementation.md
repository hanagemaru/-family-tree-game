# 競走馬18枚・生成器（作業ブランチ）

## データと再現手順

- `data/source/horse-audit-2026-11-11.json`：GitHub Actions [#43021772462](https://github.com/hanagemaru/-family-tree-game/actions/runs/43021772462) の元データから抽出したQID・名前・父・母。
- `data/source/lineage-audit-2026-11-11.json`：GitHub Actions [#43024294135](https://github.com/hanagemaru/-family-tree-game/actions/runs/43024294135) の13系統の子QID・父母情報。
- `data/source/wikidata-live-entities-2026-11-12.json`：2026-11-12にWikidataから補完して保存した父P22・母P25・表示名・生年の追加原本（オフライン再構築用）。
- `data/horse-pedigree.v1.json`：整形・検査済みで**凍結された**ゲーム入力。991個体（名前解決872、未解決119）。出題は解決済みの個体だけ。元ファイルと加工コードを固定すれば完全一致で再生成できる。
- QIDは個体識別子。父 `P22`・母 `P25` を区別し、名付けが不明な馬はQIDを保持して出題から除外する。データに親が見つからなくても「実際に親がいない」と解釈しない。

```sh
python3 scripts/build_horse_snapshot.py \
  --horse-audit data/source/horse-audit-2026-11-11.json \
  --lineage-audit data/source/lineage-audit-2026-11-11.json \
  --enriched-input data/source/wikidata-live-entities-2026-11-12.json
python3 -m unittest discover -s tests -p 'test_*.py'
npm test
npm run build
node scripts/benchmark-horse-stages.mjs --runs=1000 --attempts=24
```

Wikidataを再取得してから同じデータを再生成する場合、`--enrich --save-enriched data/source/wikidata-live-entities-YYYY-MM-DD.json` を付け、生成された原本をコミットする。今回固定したソースで再作成するときは `--enriched-input data/source/wikidata-live-entities-2026-11-12.json` を使用する。外部APIを使うのは取得時のみで、ゲーム生成とテストはオフライン。

## 処理

1. `scripts/build_horse_snapshot.py`：父母が複数主張される場合、その欄は除外。自己親・父母同一・世代サイクル・生年から不可能と判定できる親子辺も除外し、`docs/horse-data-audit-2026-11-12.json` に理由を保存。同名異個体はQIDを維持し、同一問題内での同名出題を回避する。**実際の血縁を独立した外部原本で照合できたわけではない**。
2. `src/random-horse-stage.js`：再現可能な乱数で起点を選び、父母・産駒・共通親を持つきょうだいから連結集合を拡張。選択時にすべての直接親子世代差が1、兄弟は同世代であることを確認。18頭の候補群を複数作り、世代数・内部の分岐・祖父母ルート・母系・同一父産駒への集中・盤面横幅を加点／減点する。構造上の上位2候補について完成盤面の交差・表示倍率も比較し、最終評価する。枚数以外の配合比率は固定しない。
3. 採用候補を**既存 `newGame` / `place` / `ensurePlayable`** で全枚配置し、毎ターン `layoutFamily`、最後に `buildDiagram` / `renderGeometry` を実行。360×320の盤面倍率と交差数を算出。失敗した候補は除外。
4. `scripts/benchmark-horse-stages.mjs`：100～1000個以上のシードで成功率、失敗理由、問題重複、系統偏り、世代、分岐、母系、画面幾何を実測。人間の認識しやすさや実際の競馬ファンの正答率は未検証。

## 互換性と範囲

- `src/data.js` の徳川18人／競走馬24頭および `src/app.js` と保存キーは**変更しない**。生成器は別モジュールであり、現在のゲーム画面には追加しない。
- ランダム問題のセーブ／リロードやランキング・画像は実装対象外。将来、問題IDとデータ版の永続化仕様を別途設計する。
- 問題がつながることと、見やすく覚えやすい良問であることは異なる。実測の分布とサンプルの目視評価を踏まえて次の難易度調整を行う。

## 監査・残課題

- データ検査結果は `docs/horse-data-audit-2026-11-12.json`。今回取得分では構造的不整合による関係削除は0件。異常検出器の動作は `tests/test_horse_snapshot.py` に自己親・循環・複数親・不可能生年・同名の合成テストを置く。**0件は実父母を実証した意味ではない。**
- `docs/random-horse-benchmark-2026-11-12.{json,md}` に生成実測の集計とサンプルを記録。世代・分岐は良好でも、線の交差やモバイル全体表示時の縮小は改良余地がある。数値は幾何学的代理指標で、実機の見やすさは未評価。
- 既存の `src/data.js`、`src/app.js`、保存形式は触れていない。画面への導線追加は次のPRに分離する。

### 2026-11-12 実測とセルフレビュー

- GitHub Actions [実測 #43222711312](https://github.com/hanagemaru/-family-tree-game/actions/runs/43222711312) は改訂後の生成器・オフライン固定データで **1,000/1,000件完走成功**。異なる18枚セットは997件、良問の構造ソフト目標は929件。
- 同じ1,000シードで初期版は関係線交差の平均12.65か所、2候補の盤面も採点する改訂後は **4.722か所**。ただし最大176か所の外れ値が残る。盤面品質の**保証**には別途しきい値や配置アルゴリズムの対策が必要。
- 360×320pxの全体表示時の平均倍率は0.206倍で、縮小画面上の文字を常時読める水準ではない。ズーム／スクロールを前提とした既存UIとの実機接続検証が必要。
- 計測値と系統の偏りは [集計レポート](random-horse-benchmark-2026-11-12.md)、個別3例の図は [seed 1](samples/horse-seed-1.svg)・[seed 2](samples/horse-seed-2.svg)・[seed 3](samples/horse-seed-3.svg)。同じシードで再生成するコードは `scripts/export-horse-stage-diagrams.mjs`。
- コードレビューにより、元の固定2ステージのソースと保存形式は不変。シードが異なれば常に違うカード集合になるとは限らず、1,000件中3回の重複が実際にあった。将来のフリープレイでは問題履歴による重複回避が必要。

GitHub Actionsの1000件リプレイは手動の [Random horse snapshot and replay audit](https://github.com/hanagemaru/-family-tree-game/actions/workflows/random-horse-snapshot.yml) で再実行可能。PRのたびに実行するCIでは既存モード回帰テストと新規100シードテスト、Pythonの異常データテスト、ビルドを確認する。
