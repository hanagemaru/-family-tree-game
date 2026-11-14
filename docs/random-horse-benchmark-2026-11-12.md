# 18-card random horse-stage benchmark

- Data: `wikidata-pedigree-v1` (991 records, 872 named)
- Generator: `horse-stage-v1`; candidate attempts: 24 per seed
- Generated: **1000/1000** (100.0%); errors: {}
- Unique 18-card sets: **997**; duplicated sets: **3**; unique horses used: **853**
- Soft-quality target (3–5 generations, ≥2 visible forks, ≥1 grandparent path, ≤8 same-sire offspring): **929/1000**
- Largest group by recorded lineage: {"サンデーサイレンス":280,"ブライアンズタイム":221,"キングカメハメハ":107,"シンボリクリスエス":87,"シンボリルドルフ":82,"ノーザンテースト":81,"ディープインパクト":55,"グラスワンダー":43,"トニービン":19,"未分類":13,"クロフネ":8,"ロードカナロア":4}
- Distinct starting horses: 442

| Metric | Mean | Min | Max |
|---|---:|---:|---:|
| generations | 4.917 | 3 | 8 |
| branches | 3.174 | 1 | 6 |
| sharedParentGroups | 3.743 | 2 | 8 |
| parentEdges | 16.387 | 8 | 19 |
| maternalEdges | 3.374 | 0 | 8 |
| grandparentPaths | 5.101 | 2 | 11 |
| largestSireGroup | 5.744 | 2 | 8 |
| maxRowCards | 7.099 | 3 | 11 |
| crossings | 4.722 | 0 | 176 |
| scale360x320 | 0.206 | 0.15845070422535212 | 0.2719033232628399 |
| width | 1637.282 | 898 | 2162 |
| height | 1035.325 | 604 | 1729 |
| score | 121.778 | 34.01288343558281 | 156.22412060301508 |

## Examples
- Seed 1 (グラスワンダー, 5 generations, 4 visible forks): コスモヘレノス、メイショウカンパク、オースミグラスワン、マイネルスケルツィ、グラスワンダー、サクラメガワンダー、シルヴァーホーク、ロベルト、ヘイルトゥリーズン、Bramalea、ヘイロー、アーネストリー、クリスエス、サンデーサイレンス、チューニー、アイーンベル、サイレントネーム、スズカフェニックス
- Seed 2 (シンボリクリスエス, 5 generations, 3 visible forks): サトノアポロ、ユールシンギング、シンボリクリスエス、クリーバレン、クリスエス、ルヴァンスレーヴ、エアアンセム、シャープ・クイーン、コルテジア、ブライアンズタイム、エリモマキシム、エリモブライアン、エリモダンディー、ナイキアースワーク、トーセンブライト、ロベルト、Bramalea、ビッグゴールド
- Seed 3 (サンデーサイレンス, 5 generations, 3 visible forks): コイントス、ディープサイレンス、ゴールドヘイロー、タヤスアゲイン、メジロベイリー、サンデーサイレンス、ヘイロー、ミスキャスト、コスマー、グッバイヘイロー、ヘイルトゥリーズン、アルマームード、ローゼンクロイツ、ノースフライト、オフサイドトラップ、ブラックタキシード、ロベルト、レディパステル

## Limitations
- All 18 cards were replayed through core.newGame/place and diagram.layoutFamily/buildDiagram.
- A connected and finishable problem does not imply manually verified real-world pedigree.
- Crossings and 360x320 camera scale are deterministic geometric proxies, not visual screenshot review.
- Some lineage categories overlap; perRoot uses the largest recorded direct-offspring membership.
