import type { GameState } from '@/rules/chess';
import type { PlyAnnotation } from '@/types/annotations';
import type { MistakeReviewContext, MoveInsight } from '@/types/coach';
import { Chess } from 'chess.js';

/**
 * Pack game state and move context for LLM mistake review
 */
export function packMistakeReviewContext(
  gameState: GameState,
  annotations: Record<string, PlyAnnotation>,
  moveIndex: number,
  level: number
): MistakeReviewContext {
  const annotation = annotations[String(moveIndex)];
  if (!annotation) {
    throw new Error(`No annotation found for move index ${moveIndex}`);
  }

  // Determine player color (odd ply = white, even ply = black)
  const playerColor = moveIndex % 2 === 1 ? 'white' : 'black';
  
  // Get last moves in SAN (up to 12 moves, newest last)
  const lastMovesSan = gameState.history
    .slice(-12)
    .map(move => move.san)
    .filter(Boolean);

  // Create a simple hash of the PGN for continuity (not the full PGN to save tokens)
  const pgnHash = gameState.pgn ? 
    btoa(gameState.pgn).substring(0, 16) : 
    `game_${Date.now().toString(36)}`;

  return {
    task: 'mistake_review',
    playerColor,
    level,
    fen: gameState.fen,
    lastMovesSan,
    pgnHash,
    annotations: {
      eval_before: annotation.evalBefore,
      eval_after: annotation.evalAfter,
      delta_cp: annotation.delta,
      // TODO: Add best_line, refutation_line, and motifs from deep engine analysis
      best_line: [],
      refutation_line: [],
      motifs: []
    }
  };
}

/**
 * Extract move insights from annotations for a specific move
 */
export function extractMoveInsight(
  annotations: Record<string, PlyAnnotation>,
  moveIndex: number
): MoveInsight | null {
  const annotation = annotations[String(moveIndex)];
  if (!annotation) return null;

  return {
    moveIndex,
    san: annotation.san,
    uci: annotation.uci,
    fenBefore: '', // TODO: Calculate from previous position
    fenAfter: annotation.fen,
    evalBeforeCp: annotation.evalBefore,
    evalAfterCp: annotation.evalAfter,
    deltaCpFromPlayerView: annotation.delta,
    class: annotation.classification as 'ok' | 'inaccuracy' | 'mistake' | 'blunder'
  };
}

/**
 * Simple motif detection based on evaluation patterns
 * This is a basic implementation - can be enhanced with proper chess analysis
 */
export function detectBasicMotifs(
  fenBefore: string,
  fenAfter: string,
  deltaCp: number
): string[] {
  const motifs: string[] = [];

  try {
    const chessBefore = new Chess(fenBefore);
    const chessAfter = new Chess(fenAfter);

    // Large material swing suggests hanging piece or tactical error
    if (deltaCp > 300) {
      motifs.push('hanging piece');
    } else if (deltaCp > 150) {
      motifs.push('material loss');
    }

    // Check if position went from check to not check (missed check)
    if (chessBefore.inCheck() && !chessAfter.inCheck()) {
      motifs.push('missed check');
    }

    // Basic tactical patterns based on evaluation swing
    if (deltaCp > 500) {
      motifs.push('tactical blunder');
    }

  } catch (e) {
    // If FEN parsing fails, return empty motifs
    console.warn('Failed to parse FEN for motif detection:', e);
  }

  return motifs;
}