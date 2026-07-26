# Lichess Position Training: 2,000-Puzzle Dataset Expansion

- Previous production puzzles: 1000
- New validated puzzles: 1000
- Final production puzzles: 2000
- Existing shards preserved byte-for-byte: 40
- New shards: 40
- Final shards: 80
- Shard size: 25
- First new puzzle: 00f99
- Last new puzzle: 01OSA
- Official source: Lichess puzzle database CSV export
- Training model: position-objective-dynamic-defence
- Exact stored continuation required: false

The first database move is used only to repair the source FEN into the position presented to the solver. The trainer continues to judge objective-preserving moves dynamically rather than requiring the stored Lichess continuation.
