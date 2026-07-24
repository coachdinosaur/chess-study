window.ADVANCED_PAWN_MODULE_11 = {
  level: "Advanced Pawn",
  module: 11,
  moduleTitle: "Blunder Prevention in Chess",
  courseDescription: "A practical safety system for identifying what changed, detecting immediate threats, testing candidate moves, and verifying the opponent's strongest forcing reply before committing.",
  sourceTitle: "Blunder Prevention in Chess — A Practical and Conceptual Reference for Avoiding Common Mistakes",
  positionCount: 9,
  legalPositionCount: 9,
  sourcePlacementCount: 9,
  positionSummary: "Eight guided board laboratories containing nine legal FEN positions",
  heroPieces: ["wQ", "bN", "wK"],
  objectives: [
    { title: "Detect", text: "Identify threats, loose pieces, exposed kings, tactical alignments, and unreliable defenders." },
    { title: "Test", text: "Generate alternatives and try to refute each candidate with the opponent's strongest reply." },
    { title: "Verify", text: "Perform a final check for checks, captures, threats, opened lines, and stalemate before moving." }
  ],
  reviewQuestions: [
    { question: "What are the first three questions after an opponent moves?", answer: "What changed? What is threatened? What checks, captures, and direct threats now exist?" },
    { question: "What does tactical falsification mean?", answer: "Try to prove your candidate fails by searching for the opponent's strongest forcing reply." },
    { question: "What is the essential final question before playing a move?", answer: "After I make this move, what is the strongest forcing thing my opponent can do?" }
  ],
  lessons: [
    {
      number: 1,
      title: "Blunder Prevention in Chess",
      slug: "blunder-prevention-in-chess",
      description: "Build a repeatable safety process using threat detection, candidate testing, tactical falsification, and nine guided FEN positions.",
      intro_html: "<p>A blunder is a serious and usually avoidable deterioration of a position. Blunder prevention creates a final verification layer between choosing a move and playing it.</p>",
      positions: [
        { id: "blunder-prevention-1", label: "What Changed? Stop the Immediate Threat", side_to_move: "black", fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3", prompt: "Identify White's threat and stop it before developing routinely.", solution: "White threatens Qxf7#. Black must answer the threat; 3...Nf6?? allows mate.", notes: [] },
        { id: "blunder-prevention-2", label: "The Phantom Defender", side_to_move: "black", fen: "4r1k1/8/8/8/1b6/2B5/4N3/3QK3 b - - 0 1", prompt: "Can Black capture the bishop on c3 even though the knight appears to defend it?", solution: "1...Bxc3+ wins because the e2-knight is absolutely pinned.", notes: [] },
        { id: "blunder-prevention-3", label: "Loose Targets and the Fork Square", side_to_move: "white", fen: "r3k2r/ppp2ppp/2n5/1N6/8/8/PPPP1PPP/R3K2R w KQkq - 0 1", prompt: "Find the checking knight fork.", solution: "1.Nxc7+ followed by Nxa8 wins the rook.", notes: [] },
        { id: "blunder-prevention-4", label: "Back-Rank Danger and Creating Luft", side_to_move: "black", fen: "6k1/4Rppp/8/q7/8/8/6PP/6K1 b - - 0 1", prompt: "Stop White's back-rank mate threat.", solution: "1...h6 or 1...h5 creates luft; 1...Qd5?? allows 2.Re8#.", notes: [] },
        { id: "blunder-prevention-5", label: "The Free Queen That Is Not Free", side_to_move: "black", fen: "rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5", prompt: "Test 5...Bxd1 against White's forcing replies.", solution: "5...Bxd1?? 6.Bxf7+ Ke7 7.Nd5#; 5...dxe5 avoids the mating net.", notes: [] },
        { id: "blunder-prevention-6-a", label: "Opposition — Black to Move", side_to_move: "black", fen: "8/8/4k3/8/4K3/4P3/8/8 b - - 0 1", prompt: "Determine whether White can force promotion.", solution: "Black to move gives White the opposition and access to a key square.", notes: [] },
        { id: "blunder-prevention-6-b", label: "Opposition — White to Move", side_to_move: "white", fen: "8/8/4k3/8/4K3/4P3/8/8 w - - 0 1", prompt: "Compare this position with the same board when Black moves first.", solution: "White to move lets Black hold the opposition and draw with correct defense.", notes: [] },
        { id: "blunder-prevention-7", label: "Winning Without Stalemating", side_to_move: "white", fen: "k7/8/2K5/1Q6/8/8/8/8 w - - 0 1", prompt: "Find mate and avoid the stalemate move.", solution: "1.Qb7# wins; 1.Qb6?? is stalemate.", notes: [] },
        { id: "blunder-prevention-8", label: "A World Champion's Missing Final Check", side_to_move: "black", fen: "5N1k/q5p1/7p/4P3/pp2Q3/8/1P4PP/2b4K b - - 0 34", prompt: "Test 34...Qe3 by scanning every White check.", solution: "34...Qe3?? 35.Qh7#. The final check scan would have exposed the mate.", notes: [] }
      ],
      filename: "advanced-pawn-m11-lesson-01-blunder-prevention-in-chess.html",
      previous: "advanced-pawn-m10-lesson-09-discussing-the-game-respectfully.html",
      next: null
    }
  ]
};
