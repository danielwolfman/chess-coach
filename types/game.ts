// Core chess types
export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = 
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8'
  | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8'
  | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8'
  | 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'e7' | 'e8'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8'
  | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7' | 'g8'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8';

export interface Piece {
  type: PieceType;
  color: Color;
}

// Move types
export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
  san?: string;
  captured?: PieceType;
  piece?: PieceType;
  flags?: string;
}

export interface AnnotatedMove extends Move {
  moveNumber: number;
  color: Color;
  timestamp: number;
  timeSpent: number;
  evaluation?: number;
  comment?: string;
}

// Game state enums
export enum GameStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  CHECKMATE = 'checkmate',
  STALEMATE = 'stalemate',
  DRAW_BY_REPETITION = 'draw_by_repetition',
  DRAW_BY_FIFTY_MOVE_RULE = 'draw_by_fifty_move_rule',
  DRAW_BY_INSUFFICIENT_MATERIAL = 'draw_by_insufficient_material',
  DRAW_BY_AGREEMENT = 'draw_by_agreement',
  ABANDONED = 'abandoned'
}

export enum GameResult {
  WHITE_WINS = '1-0',
  BLACK_WINS = '0-1',
  DRAW = '1/2-1/2',
  UNKNOWN = '*'
}

export enum TimeControl {
  BULLET = 'bullet',
  BLITZ = 'blitz',
  RAPID = 'rapid',
  CLASSICAL = 'classical',
  CORRESPONDENCE = 'correspondence',
  UNLIMITED = 'unlimited'
}

export enum GameMode {
  PRACTICE = 'practice',
  ANALYSIS = 'analysis',
  PUZZLE = 'puzzle',
  LESSON = 'lesson'
}

// Game interface
export interface Game {
  id: string;
  mode: GameMode;
  status: GameStatus;
  result: GameResult;
  currentFen: string;
  startFen?: string;
  pgn: string;
  moves: AnnotatedMove[];
  currentTurn: Color;
  moveCount: number;
  halfMoveClock: number;
  fullMoveNumber: number;
  inCheck: boolean;
  inCheckmate: boolean;
  inStalemate: boolean;
  inDraw: boolean;
  createdAt: number;
  updatedAt: number;
  timeControl?: TimeControl;
  whiteTimeRemaining?: number;
  blackTimeRemaining?: number;
  increment?: number;
  metadata?: {
    white?: string;
    black?: string;
    event?: string;
    site?: string;
    date?: string;
    round?: string;
    eco?: string;
    opening?: string;
  };
}

// Settings enums
export enum ThemeColor {
  BROWN = 'brown',
  BLUE = 'blue',
  GREEN = 'green',
  PURPLE = 'purple',
  GREY = 'grey'
}

export enum PieceStyle {
  CLASSIC = 'classic',
  MODERN = 'modern',
  MINIMALIST = 'minimalist'
}

export enum BoardOrientation {
  WHITE = 'white',
  BLACK = 'black'
}

export enum AnnotationLevel {
  NONE = 'none',
  BASIC = 'basic',
  DETAILED = 'detailed',
  COMPREHENSIVE = 'comprehensive'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

// Settings interface
export interface Settings {
  // Display settings
  theme: ThemeColor;
  pieceStyle: PieceStyle;
  boardOrientation: BoardOrientation;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  highlightLastMove: boolean;
  animatePieces: boolean;
  
  // Sound settings
  soundEnabled: boolean;
  moveSound: boolean;
  captureSound: boolean;
  checkSound: boolean;
  
  // Analysis settings
  engineEnabled: boolean;
  engineDepth: number;
  showArrows: boolean;
  showEvaluation: boolean;
  autoAnalysis: boolean;
  annotationLevel: AnnotationLevel;
  
  // Coach settings
  coachEnabled: boolean;
  hintLevel: DifficultyLevel;
  showMistakes: boolean;
  showTacticalHints: boolean;
  showOpeningHints: boolean;
  
  // Time settings
  defaultTimeControl: TimeControl;
  clockEnabled: boolean;
  
  // Accessibility
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

// Progress tracking enums
export enum SkillArea {
  TACTICS = 'tactics',
  OPENINGS = 'openings',
  ENDGAMES = 'endgames',
  STRATEGY = 'strategy',
  CALCULATION = 'calculation'
}

export enum AchievementType {
  MILESTONE = 'milestone',
  STREAK = 'streak',
  SKILL = 'skill',
  TIME_BASED = 'time_based'
}

// Progress interface
export interface Progress {
  // Overall stats
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  winRate: number;
  currentRating: number;
  peakRating: number;
  
  // Time-based stats
  totalPlayTime: number; // in seconds
  averageGameDuration: number; // in seconds
  lastPlayedAt: number; // timestamp
  playStreak: number; // consecutive days
  longestStreak: number;
  
  // Skill-based progress
  tacticsRating: number;
  openingsKnowledge: number;
  endgameSkill: number;
  strategicUnderstanding: number;
  calculationAccuracy: number;
  
  // Learning progress
  lessonsCompleted: number;
  puzzlesSolved: number;
  mistakesMade: number;
  improvementAreas: SkillArea[];
  
  // Recent performance
  recentGames: string[]; // game IDs
  recentAccuracy: number;
  recentMistakes: number;
  
  // Achievements
  achievements: Achievement[];
  
  // Detailed statistics
  openingStats: { [opening: string]: OpeningStats };
  timeControlStats: { [timeControl in TimeControl]?: TimeControlStats };
}

export interface Achievement {
  id: string;
  type: AchievementType;
  title: string;
  description: string;
  unlockedAt: number;
  progress?: number;
  target?: number;
}

export interface OpeningStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  winRate: number;
  averageAccuracy: number;
}

export interface TimeControlStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  winRate: number;
  rating: number;
  peakRating: number;
}

// Utility types for game operations
export interface GameUpdate {
  move: Move;
  timeSpent?: number;
  comment?: string;
}

export interface GameAnalysis {
  gameId: string;
  moves: MoveAnalysis[];
  accuracy: number;
  mistakes: number;
  blunders: number;
  inaccuracies: number;
  bestMoves: number;
}

export interface MoveAnalysis {
  moveNumber: number;
  san: string;
  evaluation: number;
  bestMove?: string;
  classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  comment?: string;
}