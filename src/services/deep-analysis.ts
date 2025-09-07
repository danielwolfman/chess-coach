import { getStockfishEngine, type SearchResult } from '@/engine';
import { Chess } from 'chess.js';
import { detectBasicMotifs } from './coach-context';

export interface DeepAnalysisResult {
  bestLine: string[];      // Best continuation in SAN notation
  refutationLine: string[]; // Line that refutes the played move
  motifs: string[];        // Detected tactical motifs
  evaluation: {
    before: number;        // Position eval before the mistake (cp)
    after: number;         // Position eval after the mistake (cp)  
    best: number;          // Eval if best move was played (cp)
  };
}

export interface DeepAnalysisOptions {
  depth?: number;          // Search depth (default based on level)
  timeMs?: number;         // Max time in milliseconds
  multipv?: number;        // Number of variations to analyze
}

/**
 * Perform deep engine analysis for mistake explanation
 */
export async function performDeepAnalysis(
  fenBefore: string,
  fenAfter: string,
  playedMove: string,
  level: number,
  options: DeepAnalysisOptions = {}
): Promise<DeepAnalysisResult> {
  const engine = getStockfishEngine();
  await engine.initialize();

  // Configure analysis parameters based on level
  const depth = options.depth ?? Math.min(16, 8 + Math.floor(level / 3));
  const timeMs = options.timeMs ?? Math.min(1200, 600 + level * 30);
  const multipv = options.multipv ?? 3;

  try {
    // Analyze position before the move to get best continuation
    const beforeAnalysis = await engine.search(fenBefore, {
      depth,
      time: timeMs,
      multipv
    });

    // Analyze position after the move
    const afterAnalysis = await engine.search(fenAfter, {
      depth: Math.max(10, depth - 2),
      time: Math.floor(timeMs * 0.7),
      multipv: 2
    });

    // Convert UCI moves to SAN
    const bestLine = convertUciToSan(fenBefore, beforeAnalysis.pv?.slice(0, 6) || []);
    const refutationLine = convertUciToSan(fenAfter, afterAnalysis.pv?.slice(0, 6) || []);

    // Detect motifs based on evaluation patterns and position changes
    const deltaCp = (afterAnalysis.score_cp || 0) - (beforeAnalysis.score_cp || 0);
    const motifs = detectAdvancedMotifs(fenBefore, fenAfter, playedMove, deltaCp, beforeAnalysis, afterAnalysis);

    return {
      bestLine,
      refutationLine,
      motifs,
      evaluation: {
        before: beforeAnalysis.score_cp || 0,
        after: afterAnalysis.score_cp || 0,
        best: beforeAnalysis.pvs?.[0]?.score_cp || beforeAnalysis.score_cp || 0
      }
    };
  } catch (error) {
    console.error('Deep analysis failed:', error);
    
    // Fallback analysis with basic motif detection
    const basicMotifs = detectBasicMotifs(fenBefore, fenAfter, Math.abs(
      (await quickEval(fenAfter)) - (await quickEval(fenBefore))
    ));

    return {
      bestLine: [],
      refutationLine: [],
      motifs: basicMotifs,
      evaluation: {
        before: await quickEval(fenBefore),
        after: await quickEval(fenAfter),
        best: 0
      }
    };
  }
}

/**
 * Convert UCI moves to SAN notation
 */
function convertUciToSan(startingFen: string, uciMoves: string[]): string[] {
  if (!uciMoves.length) return [];

  try {
    const chess = new Chess(startingFen);
    const sanMoves: string[] = [];

    for (const uciMove of uciMoves) {
      try {
        const move = chess.move(uciMove);
        if (move) {
          sanMoves.push(move.san);
        } else {
          break; // Invalid move, stop conversion
        }
      } catch (e) {
        break; // Invalid move, stop conversion
      }
    }

    return sanMoves;
  } catch (error) {
    console.warn('Failed to convert UCI to SAN:', error);
    return [];
  }
}

/**
 * Quick evaluation using existing evaluation service
 */
async function quickEval(fen: string): Promise<number> {
  // Use the existing material-based evaluation as fallback
  const { evaluateFenForPlayer } = await import('./evaluation');
  const chess = new Chess(fen);
  const turn = chess.turn();
  return evaluateFenForPlayer(fen, turn);
}

/**
 * Advanced motif detection using engine analysis
 */
function detectAdvancedMotifs(
  fenBefore: string,
  fenAfter: string,
  playedMove: string,
  deltaCp: number,
  beforeAnalysis: SearchResult,
  afterAnalysis: SearchResult
): string[] {
  const motifs: string[] = [];

  try {
    const chessBefore = new Chess(fenBefore);
    const chessAfter = new Chess(fenAfter);

    // Material-based motifs
    if (deltaCp > 300) {
      motifs.push('hanging piece');
    } else if (deltaCp > 900) {
      motifs.push('lost queen');
    } else if (deltaCp > 500) {
      motifs.push('lost rook');
    } else if (deltaCp > 150) {
      motifs.push('material loss');
    }

    // Mate threat analysis
    if (beforeAnalysis.mate && beforeAnalysis.mate > 0 && (!afterAnalysis.mate || afterAnalysis.mate <= 0)) {
      motifs.push('missed forced mate');
    } else if (!beforeAnalysis.mate && afterAnalysis.mate && afterAnalysis.mate < 0) {
      motifs.push('allowed checkmate');
    }

    // Tactical patterns based on evaluation swing
    const evalSwing = Math.abs(deltaCp);
    if (evalSwing > 200) {
      // Check for common tactical motifs by analyzing piece positions
      if (hasUndefendedPieces(chessAfter)) {
        motifs.push('undefended piece');
      }
      
      if (evalSwing > 400) {
        motifs.push('tactical blunder');
      }
    }

    // Check-related motifs
    if (chessBefore.inCheck() && !chessAfter.inCheck()) {
      motifs.push('failed to address check properly');
    } else if (!chessBefore.inCheck() && chessAfter.inCheck()) {
      motifs.push('moved into check');
    }

    // Positional motifs for smaller mistakes
    if (evalSwing < 100 && evalSwing > 30) {
      motifs.push('positional inaccuracy');
    }

    // Engine depth-based confidence
    if (beforeAnalysis.pv && beforeAnalysis.pv.length > 3) {
      motifs.push('deep analysis available');
    }

  } catch (error) {
    console.warn('Advanced motif detection failed:', error);
    // Fall back to basic motifs
    return detectBasicMotifs(fenBefore, fenAfter, deltaCp);
  }

  return motifs.length > 0 ? motifs : ['evaluation loss'];
}

/**
 * Check if position has undefended pieces (simplified)
 */
function hasUndefendedPieces(chess: Chess): boolean {
  try {
    const board = chess.board();
    let undefendedCount = 0;

    // This is a simplified check - in a real implementation,
    // you'd want to analyze piece attacks and defenses more thoroughly
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type !== 'k' && piece.type !== 'p') {
          // Simplified heuristic: count pieces that might be hanging
          // In a real implementation, you'd check if the piece is actually defended
          const square = String.fromCharCode(97 + file) + String(8 - rank);
          const attacks = chess.moves({ square: square as any, verbose: false });
          if (attacks.length === 0) {
            undefendedCount++;
          }
        }
      }
    }

    return undefendedCount > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get analysis depth based on player level
 */
export function getAnalysisDepthForLevel(level: number): number {
  // Level 1-5: depth 8-10
  // Level 6-10: depth 11-13  
  // Level 11-15: depth 14-16
  // Level 16-20: depth 17-18
  return Math.max(8, Math.min(18, 8 + Math.floor(level / 2.5)));
}
