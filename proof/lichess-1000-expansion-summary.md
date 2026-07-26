# Lichess Position Training: 1,000-Puzzle Expansion

- Previous production puzzles: 500
- New validated puzzles: 500
- Final production puzzles: 1000
- Existing shards preserved byte-for-byte: 20
- New shards: 20
- Final shards: 40
- Shard size: 25
- First new puzzle: 000Pw
- Last new puzzle: 00f7K
- Official source: Lichess puzzle database CSV export
- Training model: position-objective-dynamic-defence
- Exact stored continuation required: false

The first database move is used only to repair the source FEN into the position presented to the solver. The trainer continues to judge objective-preserving moves dynamically rather than requiring the stored Lichess continuation.
