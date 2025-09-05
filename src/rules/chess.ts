import { Chess, Square as ChessSquare, PieceSymbol, Color as ChessColor, Move as ChessMove } from 'chess.js';

export type Square = ChessSquare;
export type Color = ChessColor;
export type PieceType = PieceSymbol;

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

export interface GameMove extends ChessMove {
  san: string;
  captured?: PieceType;
  piece: PieceType;
  color: Color;
  flags: string;
}

export interface GameState {
  fen: string;
  pgn: string;
  turn: Color;
  inCheck: boolean;
  inCheckmate: boolean;
  inStalemate: boolean;
  inDraw: boolean;
  gameOver: boolean;
  history: GameMove[];
}

export class ChessGame {
  private chess: Chess;
  private moveHistory: GameMove[] = [];

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  static fromFen(fen: string): ChessGame {
    return new ChessGame(fen);
  }

  static fromPgn(pgn: string): ChessGame {
    const game = new ChessGame();
    game.loadPgn(pgn);
    return game;
  }

  get(square: Square): Piece | null {
    return this.chess.get(square) || null;
  }

  put(piece: Piece, square: Square): boolean {
    return this.chess.put(piece, square);
  }

  remove(square: Square): Piece | null {
    return this.chess.remove(square) || null;
  }

  clear(): void {
    this.chess.clear();
  }

  reset(): void {
    this.chess.reset();
    this.moveHistory = [];
  }

  load(fen: string): boolean {
    try {
      this.chess.load(fen);
      this.moveHistory = [];
      return true;
    } catch {
      return false;
    }
  }

  loadPgn(pgn: string): boolean {
    try {
      this.chess.loadPgn(pgn);
      this.moveHistory = this.chess.history({ verbose: true }) as GameMove[];
      return true;
    } catch {
      return false;
    }
  }

  moves(options?: { square?: Square; verbose?: boolean }): string[] | GameMove[] {
    if (options?.verbose) {
      return this.chess.moves({ ...options, verbose: true }) as GameMove[];
    }
    return this.chess.moves(options || {}) as string[];
  }

  move(move: string | Move): GameMove | null {
    const moveResult = this.chess.move(move);
    if (moveResult) {
      this.moveHistory.push(moveResult as GameMove);
      return moveResult as GameMove;
    }
    return null;
  }

  undo(): GameMove | null {
    const undoResult = this.chess.undo();
    if (undoResult) {
      this.moveHistory.pop();
      return undoResult as GameMove;
    }
    return null;
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  inCheck(): boolean {
    return this.chess.isCheck();
  }

  inCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  inStalemate(): boolean {
    return this.chess.isStalemate();
  }

  inDraw(): boolean {
    return this.chess.isDraw();
  }

  inThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  insufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  fen(): string {
    return this.chess.fen();
  }

  pgn(): string {
    return this.chess.pgn();
  }

  ascii(): string {
    return this.chess.ascii();
  }

  turn(): Color {
    return this.chess.turn();
  }

  history(): GameMove[] {
    return [...this.moveHistory];
  }

  getState(): GameState {
    return {
      fen: this.fen(),
      pgn: this.pgn(),
      turn: this.turn(),
      inCheck: this.inCheck(),
      inCheckmate: this.inCheckmate(),
      inStalemate: this.inStalemate(),
      inDraw: this.inDraw(),
      gameOver: this.isGameOver(),
      history: this.history(),
    };
  }

  isLegalMove(move: string | Move): boolean {
    try {
      const currentFen = this.fen();
      const testMove = this.chess.move(move);
      if (testMove) {
        this.chess.load(currentFen);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  validateFen(fen: string): { valid: boolean; error?: string } {
    try {
      new Chess(fen);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid FEN' 
      };
    }
  }

  squareColor(square: Square): 'light' | 'dark' {
    const color = this.chess.squareColor(square);
    return color === 'light' || color === 'dark' ? color : 'light';
  }
}

export default ChessGame;