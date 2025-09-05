import { describe, it, expect, beforeEach } from 'vitest';

import ChessGame from '../chess';

describe('ChessGame', () => {
  let game: ChessGame;

  beforeEach(() => {
    game = new ChessGame();
  });

  describe('Legal and Illegal Moves', () => {
    it('should allow legal pawn moves', () => {
      expect(game.isLegalMove('e2e4')).toBe(true);
      expect(game.isLegalMove('e2e3')).toBe(true);
      expect(game.isLegalMove('d2d4')).toBe(true);
      expect(game.isLegalMove('d2d3')).toBe(true);
    });

    it('should reject illegal pawn moves', () => {
      expect(game.isLegalMove('e2e5')).toBe(false);
      expect(game.isLegalMove('e2e1')).toBe(false);
      expect(game.isLegalMove('a1a2')).toBe(false);
    });

    it('should allow legal knight moves', () => {
      expect(game.isLegalMove('Nf3')).toBe(true);
      expect(game.isLegalMove('Nc3')).toBe(true);
      expect(game.isLegalMove('Nh3')).toBe(true);
      expect(game.isLegalMove('Na3')).toBe(true);
    });

    it('should reject illegal knight moves', () => {
      expect(game.isLegalMove('Ne4')).toBe(false);
      expect(game.isLegalMove('Nd5')).toBe(false);
    });

    it('should reject moves when pieces are blocked', () => {
      expect(game.isLegalMove('Bc4')).toBe(false);
      expect(game.isLegalMove('Qd5')).toBe(false);
      expect(game.isLegalMove('Ra5')).toBe(false);
    });

    it('should handle piece notation and coordinate notation', () => {
      const move1 = game.move('e4');
      expect(move1).toBeTruthy();
      expect(move1?.san).toBe('e4');

      const move2 = game.move('e7e5');
      expect(move2).toBeTruthy();
      expect(move2?.san).toBe('e5');
    });

    it('should track move history correctly', () => {
      game.move('e4');
      game.move('e5');
      game.move('Nf3');
      
      const history = game.history();
      expect(history).toHaveLength(3);
      expect(history[0].san).toBe('e4');
      expect(history[1].san).toBe('e5');
      expect(history[2].san).toBe('Nf3');
    });

    it('should handle undo correctly', () => {
      game.move('e4');
      game.move('e5');
      
      expect(game.history()).toHaveLength(2);
      
      const undoMove = game.undo();
      expect(undoMove).toBeTruthy();
      expect(undoMove?.san).toBe('e5');
      expect(game.history()).toHaveLength(1);
      
      const undoMove2 = game.undo();
      expect(undoMove2).toBeTruthy();
      expect(undoMove2?.san).toBe('e4');
      expect(game.history()).toHaveLength(0);
    });

    it('should handle promotion moves', () => {
      const promotionFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
      game.load(promotionFen);
      
      expect(game.isLegalMove('a8=Q')).toBe(true);
      expect(game.isLegalMove('a8=R')).toBe(true);
      expect(game.isLegalMove('a8=B')).toBe(true);
      expect(game.isLegalMove('a8=N')).toBe(true);
      
      const move = game.move('a8=Q');
      expect(move).toBeTruthy();
      expect(move?.promotion).toBe('q');
    });

    it('should handle en passant', () => {
      game.move('e4');
      game.move('a6');
      game.move('e5');
      game.move('d5');
      
      expect(game.isLegalMove('exd6')).toBe(true);
      
      const enPassantMove = game.move('exd6');
      expect(enPassantMove).toBeTruthy();
      expect(enPassantMove?.flags).toContain('e');
    });

    it('should handle castling', () => {
      game.move('e4');
      game.move('e5');
      game.move('Nf3');
      game.move('Nc6');
      game.move('Bc4');
      game.move('Bc5');
      
      expect(game.isLegalMove('O-O')).toBe(true);
      
      const castleMove = game.move('O-O');
      expect(castleMove).toBeTruthy();
      expect(castleMove?.flags).toContain('k');
    });
  });

  describe('Check Detection', () => {
    it('should detect when king is in check', () => {
      const checkFen = '8/8/8/8/4K3/3k4/8/3R4 b - - 0 1';
      game.load(checkFen);
      
      expect(game.inCheck()).toBe(true);
      
      const state = game.getState();
      expect(state.inCheck).toBe(true);
    });

    it('should not detect check when king is safe', () => {
      expect(game.inCheck()).toBe(false);
      
      game.move('e4');
      expect(game.inCheck()).toBe(false);
    });

    it('should prevent moves that leave king in check', () => {
      const pinnedFen = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
      game.load(pinnedFen);
      
      const legalMoves = game.moves();
      expect(legalMoves).not.toContain('Nxd7');
    });

    it('should require getting out of check', () => {
      const checkFen = '8/8/8/8/4K3/3k4/8/3R4 b - - 0 1';
      game.load(checkFen);
      
      expect(game.inCheck()).toBe(true);
      
      const legalMoves = game.moves();
      expect(legalMoves).toContain('Kc4');
      expect(legalMoves).toContain('Ke2');
      expect(legalMoves).toContain('Kc2');
    });
  });

  describe('Checkmate Detection', () => {
    it('should detect checkmate', () => {
      const checkmateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      game.load(checkmateFen);
      
      expect(game.inCheckmate()).toBe(true);
      expect(game.isGameOver()).toBe(true);
      
      const state = game.getState();
      expect(state.inCheckmate).toBe(true);
      expect(state.gameOver).toBe(true);
    });

    it('should detect scholars mate', () => {
      game.move('e4');
      game.move('e5');
      game.move('Bc4');
      game.move('Nc6');
      game.move('Qh5');
      game.move('Nf6');
      game.move('Qxf7#');
      
      expect(game.inCheckmate()).toBe(true);
      expect(game.isGameOver()).toBe(true);
    });

    it('should not detect checkmate when king has escape squares', () => {
      const notCheckmateFen = '8/8/8/8/4K3/3k4/8/3R4 b - - 0 1';
      game.load(notCheckmateFen);
      
      expect(game.inCheck()).toBe(true);
      expect(game.inCheckmate()).toBe(false);
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('Stalemate Detection', () => {
    it('should detect stalemate', () => {
      const stalemateFen = '8/8/8/8/8/8/p7/k1K5 b - - 0 1';
      game.load(stalemateFen);
      
      expect(game.inStalemate()).toBe(true);
      expect(game.isGameOver()).toBe(true);
      expect(game.inCheck()).toBe(false);
      
      const state = game.getState();
      expect(state.inStalemate).toBe(true);
      expect(state.gameOver).toBe(true);
    });

    it('should not detect stalemate when moves are available', () => {
      expect(game.inStalemate()).toBe(false);
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('Repetition Detection', () => {
    it('should detect threefold repetition', () => {
      game.move('Nf3');
      game.move('Nf6');
      game.move('Ng1');
      game.move('Ng8');
      game.move('Nf3');
      game.move('Nf6');
      game.move('Ng1');
      game.move('Ng8');
      
      expect(game.inThreefoldRepetition()).toBe(true);
      expect(game.inDraw()).toBe(true);
      
      const state = game.getState();
      expect(state.inDraw).toBe(true);
    });

    it('should not detect repetition before three occurrences', () => {
      game.move('Nf3');
      game.move('Nf6');
      game.move('Ng1');
      game.move('Ng8');
      game.move('Nf3');
      game.move('Nf6');
      
      expect(game.inThreefoldRepetition()).toBe(false);
      expect(game.inDraw()).toBe(false);
    });

    it('should handle insufficient material draw', () => {
      const insufficientFen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
      game.load(insufficientFen);
      
      expect(game.insufficientMaterial()).toBe(true);
      expect(game.inDraw()).toBe(true);
    });
  });

  describe('FEN and PGN handling', () => {
    it('should load and export FEN correctly', () => {
      const testFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      
      expect(game.load(testFen)).toBe(true);
      const loadedFen = game.fen();
      expect(loadedFen.split(' ')[0]).toBe(testFen.split(' ')[0]);
    });

    it('should validate FEN strings', () => {
      const validFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const invalidFen = 'invalid-fen-string';
      
      expect(game.validateFen(validFen).valid).toBe(true);
      expect(game.validateFen(invalidFen).valid).toBe(false);
    });

    it('should load and export PGN correctly', () => {
      const testPgn = '1. e4 e5 2. Nf3 Nc6 3. Bc4';
      
      expect(game.loadPgn(testPgn)).toBe(true);
      expect(game.pgn()).toContain('e4');
      expect(game.pgn()).toContain('e5');
      expect(game.pgn()).toContain('Nf3');
    });

    it('should create game from FEN', () => {
      const testFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const fenGame = ChessGame.fromFen(testFen);
      
      const loadedFen = fenGame.fen();
      expect(loadedFen.split(' ')[0]).toBe(testFen.split(' ')[0]);
      expect(fenGame.turn()).toBe('b');
    });

    it('should create game from PGN', () => {
      const testPgn = '1. e4 e5 2. Nf3';
      const pgnGame = ChessGame.fromPgn(testPgn);
      
      const history = pgnGame.history();
      expect(history.length).toBeGreaterThan(0);
      expect(pgnGame.turn()).toBe('b');
    });
  });

  describe('Additional utilities', () => {
    it('should determine square colors', () => {
      expect(game.squareColor('a1')).toBe('dark');
      expect(game.squareColor('a2')).toBe('light');
      expect(game.squareColor('h1')).toBe('light');
      expect(game.squareColor('h8')).toBe('dark');
    });

    it('should get pieces on squares', () => {
      const piece = game.get('e1');
      expect(piece).toEqual({ type: 'k', color: 'w' });
      
      const emptySquare = game.get('e4');
      expect(emptySquare).toBeFalsy();
    });

    it('should handle piece placement and removal', () => {
      game.clear();
      
      expect(game.put({ type: 'q', color: 'w' }, 'e4')).toBe(true);
      expect(game.get('e4')).toEqual({ type: 'q', color: 'w' });
      
      const removedPiece = game.remove('e4');
      expect(removedPiece).toEqual({ type: 'q', color: 'w' });
      expect(game.get('e4')).toBeFalsy();
    });

    it('should reset to starting position', () => {
      game.move('e4');
      game.move('e5');
      
      expect(game.history()).toHaveLength(2);
      
      game.reset();
      
      expect(game.history()).toHaveLength(0);
      expect(game.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });

    it('should provide ASCII board representation', () => {
      const ascii = game.ascii();
      expect(ascii).toContain('r');
      expect(ascii).toContain('k');
      expect(ascii).toContain('q');
    });

    it('should track current turn', () => {
      expect(game.turn()).toBe('w');
      
      game.move('e4');
      expect(game.turn()).toBe('b');
      
      game.move('e5');
      expect(game.turn()).toBe('w');
    });
  });
});