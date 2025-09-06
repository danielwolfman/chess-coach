export type MoveClass = 'ok' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveInsight {
  moveIndex: number;                 // ply index
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp: number;              // from player POV
  evalAfterCp: number;               // from player POV
  deltaCpFromPlayerView: number;     // >0 means got worse for player
  class: MoveClass;
}

export interface MistakeAvailable {
  moveIndex: number;
  class: MoveClass;
  deltaCp: number;
}

export interface MistakeReviewContext {
  task: 'mistake_review';         // or 'tip' | 'rationale'
  playerColor: 'white' | 'black';
  level: number;                  // 1..20
  fen: string;                    // current position
  lastMovesSan: string[];         // up to 12, newest last
  pgnHash: string;                // continuity, not full PGN
  annotations: {
    eval_before: number;          // cp from player POV
    eval_after: number;           // cp from player POV
    delta_cp: number;
    best_line?: string[];         // SAN, ≤ 6 plies
    refutation_line?: string[];   // SAN, ≤ 6 plies
    motifs?: string[];            // e.g. 'hanging piece', 'fork threat'
  };
}

export interface MistakeReviewOutput {
  name: string;          // "Blunder: missed discovered attack"
  why: string;           // 1–2 sentences
  better_plan: string;   // short plan
  line: string[];        // best line in SAN, ≤ 6 plies
}

export type CoachTask = 'mistake_review' | 'tip' | 'rationale';

export interface CoachState {
  isStreaming: boolean;
  currentTask: CoachTask | null;
  streamedText: string;
  parsedOutput: MistakeReviewOutput | null;
  error: string | null;
}