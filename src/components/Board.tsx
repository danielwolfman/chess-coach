import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import type { Square } from '@/rules/chess'

export interface BoardProps {
  position?: string // FEN string
  highlights?: string[] // array of squares to highlight (e.g., ['e4', 'e5'])
  lastMove?: { from: string; to: string } // last move made for highlighting
  draggable?: boolean // whether pieces can be dragged
  clickable?: boolean // whether pieces can be clicked to move
  size?: number // board size in pixels
  theme?: 'default' | 'wood' | 'dark'
  onMove?: (move: { from: string; to: string; promotion?: string }) => void
  showCoordinates?: boolean
  animationDuration?: number // animation duration in ms
}

interface PieceSymbols {
  [key: string]: string
}

const PIECE_SYMBOLS: PieceSymbols = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
}

// More beautiful piece symbols with better Unicode support
const ENHANCED_PIECE_SYMBOLS: PieceSymbols = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
}

const THEMES = {
  default: {
    light: '#f0d9b5',
    dark: '#b58863',
    highlight: 'rgba(247, 236, 116, 0.8)',
    selected: 'rgba(240, 98, 146, 0.9)',
    legalMove: 'rgba(105, 240, 174, 0.7)',
    lastMove: 'rgba(255, 213, 79, 0.8)',
    check: '#ff5722',
    capture: '#e91e63',
    border: '#8b4513'
  },
  wood: {
    light: '#f4e4bc',
    dark: '#d18b47',
    highlight: '#bdd16a',
    selected: '#f06292',
    legalMove: '#69f0ae',
    lastMove: '#ffd54f',
    check: '#ff5722',
    capture: '#e91e63',
    border: '#8b4513'
  },
  dark: {
    light: '#769656',
    dark: '#eeeed2',
    highlight: '#bbcb44',
    selected: '#f06292',
    legalMove: '#69f0ae',
    lastMove: '#ffd54f',
    check: '#ff5722',
    capture: '#e91e63',
    border: '#4a4a4a'
  }
}

interface AnimatingPiece {
  piece: string
  from: string
  to: string
  startTime: number
}

interface CaptureAnimation {
  square: string
  startTime: number
}

export function Board({
  position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  highlights = [],
  lastMove,
  draggable = false,
  clickable = true,
  size = 400,
  theme = 'default',
  onMove,
  showCoordinates = true,
  animationDuration = 250
}: BoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverSquare, setDragOverSquare] = useState<string | null>(null)
  const [animatingPieces, setAnimatingPieces] = useState<AnimatingPiece[]>([])
  const [captureAnimations, setCaptureAnimations] = useState<CaptureAnimation[]>([])
  const [prevPosition, setPrevPosition] = useState<string>(position)
  
  const animationFrameRef = useRef<number>()

  const chess = useMemo(() => {
    const game = new Chess()
    try {
      game.load(position)
      return game
    } catch {
      // If position is invalid, return default position
      return new Chess()
    }
  }, [position])

  // Calculate legal moves for selected square
  const calculateLegalMoves = useCallback((square: string): string[] => {
    try {
      const moves = chess.moves({ square: square as Square, verbose: true })
      return moves.map(move => move.to)
    } catch {
      return []
    }
  }, [chess])

  // Handle position changes and trigger animations
  useEffect(() => {
    if (position !== prevPosition) {
      const { moves, captures } = findPieceDifferences(prevPosition, position)
      
      if (moves.length > 0) {
        setAnimatingPieces(moves)
        
        // Clear animations after duration
        setTimeout(() => {
          setAnimatingPieces([])
        }, animationDuration)
      }
      
      if (captures.length > 0) {
        const captureAnims = captures.map(square => ({
          square,
          startTime: Date.now()
        }))
        setCaptureAnimations(captureAnims)
        
        // Clear capture animations after duration
        setTimeout(() => {
          setCaptureAnimations([])
        }, animationDuration * 2)
      }
      
      setPrevPosition(position)
    }
  }, [position, prevPosition, animationDuration])

  // Update legal moves when selected square changes
  useEffect(() => {
    if (selectedSquare) {
      setLegalMoves(calculateLegalMoves(selectedSquare))
    } else {
      setLegalMoves([])
    }
  }, [selectedSquare, calculateLegalMoves])

  // Clear selection when position changes
  useEffect(() => {
    setSelectedSquare(null)
    setLegalMoves([])
  }, [position])
  
  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const board = chess.board()
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1']
  
  const squareSize = size / 8
  const themeColors = THEMES[theme]

  const getSquareColor = (file: number, rank: number) => {
    const isLight = (file + rank) % 2 === 0
    return isLight ? themeColors.light : themeColors.dark
  }

  const getSquareName = (file: number, rank: number) => {
    return files[file] + ranks[rank]
  }

  const getSquarePosition = (square: string) => {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
    const rank = 8 - parseInt(square[1])
    return { x: file * squareSize, y: rank * squareSize }
  }


  const findPieceDifferences = (oldFen: string, newFen: string) => {
    if (!lastMove) return { moves: [], captures: [] }
    
    try {
      const oldGame = new Chess()
      const newGame = new Chess()
      oldGame.load(oldFen)
      newGame.load(newFen)
      
      const oldBoard = oldGame.board()
      const newBoard = newGame.board()
      
      // Use the lastMove to determine animation
      const fromFile = lastMove.from.charCodeAt(0) - 'a'.charCodeAt(0)
      const fromRank = 8 - parseInt(lastMove.from[1])
      const toFile = lastMove.to.charCodeAt(0) - 'a'.charCodeAt(0)
      const toRank = 8 - parseInt(lastMove.to[1])
      
      const movedPiece = newBoard[toRank][toFile]
      const capturedPiece = oldBoard[toRank][toFile]
      
      const moves: AnimatingPiece[] = []
      const captures: string[] = []
      
      if (movedPiece) {
        moves.push({
          piece: PIECE_SYMBOLS[movedPiece.color === 'w' ? movedPiece.type.toUpperCase() : movedPiece.type.toLowerCase()],
          from: lastMove.from,
          to: lastMove.to,
          startTime: Date.now()
        })
      }
      
      if (capturedPiece) {
        captures.push(lastMove.to)
      }
      
      return { moves, captures }
    } catch {
      return { moves: [], captures: [] }
    }
  }

  const isHighlighted = (square: string) => highlights.includes(square)
  const isSelected = (square: string) => selectedSquare === square
  const isLegalMove = (square: string) => legalMoves.includes(square)
  const isDragOver = (square: string) => dragOverSquare === square
  const isLastMove = (square: string) => lastMove && (lastMove.from === square || lastMove.to === square)
  const isKingInCheck = (square: string) => {
    const piece = board[ranks.indexOf(square[1])][files.indexOf(square[0])]
    return piece && piece.type === 'k' && chess.inCheck()
  }
  const isCaptureAnimating = (square: string) => captureAnimations.some(anim => anim.square === square)
  const isAnimating = (square: string) => animatingPieces.some(anim => anim.from === square || anim.to === square)

  const handleSquareClick = useCallback((file: number, rank: number) => {
    if (!clickable) return
    
    const square = getSquareName(file, rank)
    const piece = board[rank][file]
    
    // If we have a selected square and this is a legal move
    if (selectedSquare && isLegalMove(square) && onMove) {
      // Check if this is a promotion move
      const fromSquare = selectedSquare
      const toSquare = square
      const movingPiece = board[7 - parseInt(fromSquare[1]) + 1][fromSquare.charCodeAt(0) - 97]
      
      const isPromotion = movingPiece?.type === 'p' && 
        ((movingPiece.color === 'w' && toSquare[1] === '8') || 
         (movingPiece.color === 'b' && toSquare[1] === '1'))
      
      const move = { 
        from: fromSquare, 
        to: toSquare, 
        promotion: isPromotion ? 'q' : undefined 
      }
      onMove(move)
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }
    
    // If clicking on a piece of the current player, select it
    if (piece && piece.color === chess.turn()) {
      if (selectedSquare === square) {
        // Deselect if clicking the same square
        setSelectedSquare(null)
        setLegalMoves([])
      } else {
        // Select the new square
        setSelectedSquare(square)
      }
    } else {
      // Clear selection if clicking empty square or opponent piece without legal move
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }, [clickable, selectedSquare, board, chess, isLegalMove, onMove])

  const handleDragStart = useCallback((e: React.DragEvent, file: number, rank: number) => {
    if (!draggable) {
      e.preventDefault()
      return
    }
    
    const square = getSquareName(file, rank)
    const piece = board[rank][file]
    
    if (!piece || piece.color !== chess.turn()) {
      e.preventDefault()
      return
    }
    
    setDraggedFrom(square)
    setIsDragging(true)
    
    // Set drag image to be transparent or piece symbol
    const dragImage = new Image()
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', square)
  }, [draggable, board, chess])

  const handleDragEnd = useCallback(() => {
    setDraggedFrom(null)
    setIsDragging(false)
    setDragOverSquare(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, file: number, rank: number) => {
    if (!draggable || !draggedFrom) return
    
    e.preventDefault()
    const square = getSquareName(file, rank)
    setDragOverSquare(square)
    
    // Check if this is a legal move
    const legalMovesFromDragged = calculateLegalMoves(draggedFrom)
    if (legalMovesFromDragged.includes(square)) {
      e.dataTransfer.dropEffect = 'move'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }, [draggable, draggedFrom, calculateLegalMoves])

  const handleDragLeave = useCallback(() => {
    setDragOverSquare(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, file: number, rank: number) => {
    e.preventDefault()
    if (!draggable || !draggedFrom || !onMove) return
    
    const square = getSquareName(file, rank)
    
    // Validate the move
    const legalMovesFromDragged = calculateLegalMoves(draggedFrom)
    if (legalMovesFromDragged.includes(square)) {
      // Check if this is a promotion move
      const fromSquare = draggedFrom
      const toSquare = square
      const movingPiece = board[7 - parseInt(fromSquare[1]) + 1][fromSquare.charCodeAt(0) - 97]
      
      const isPromotion = movingPiece?.type === 'p' && 
        ((movingPiece.color === 'w' && toSquare[1] === '8') || 
         (movingPiece.color === 'b' && toSquare[1] === '1'))
      
      const move = { 
        from: fromSquare, 
        to: toSquare, 
        promotion: isPromotion ? 'q' : undefined 
      }
      onMove(move)
    }
    
    setDragOverSquare(null)
  }, [draggable, draggedFrom, onMove, calculateLegalMoves])

  return (
    <div className="inline-block relative chess-board" style={{ fontSize: 0 }}>
      <div 
        className="border-2"
        style={{ 
          width: size, 
          height: size, 
          borderColor: themeColors.border,
          borderRadius: '8px',
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          position: 'relative'
        }}
      >
        {ranks.flatMap((rank, rankIndex) => 
          files.map((file, fileIndex) => {
            const piece = board[rankIndex][fileIndex]
            const square = getSquareName(fileIndex, rankIndex)
            const isHighlight = isHighlighted(square)
            const isSquareSelected = isSelected(square)
            const isLegalMoveSquare = isLegalMove(square)
            const isDraggedSquare = draggedFrom === square
            const isDragOverSquare = isDragOver(square)
            
            let backgroundColor = getSquareColor(fileIndex, rankIndex)
            if (isHighlight) backgroundColor = themeColors.highlight
            else if (isSquareSelected) backgroundColor = themeColors.selected
            else if (isKingInCheck(square)) backgroundColor = themeColors.check
            else if (isLastMove(square)) backgroundColor = themeColors.lastMove
            else if (isLegalMoveSquare) backgroundColor = themeColors.legalMove
            else if (isDragOverSquare && draggedFrom && calculateLegalMoves(draggedFrom).includes(square)) {
              backgroundColor = themeColors.legalMove
            }
            
            const isCapturingSquare = isCaptureAnimating(square)
            const isPieceAnimating = isAnimating(square)
            const shouldHidePiece = isPieceAnimating && animatingPieces.some(anim => anim.from === square)
            
            return (
              <div
                key={square}
                className={`cursor-pointer select-none flex items-center justify-center chess-square ${
                  isCapturingSquare ? 'chess-square-capture' : ''
                } ${
                  isKingInCheck(square) ? 'chess-square-check' : ''
                } ${
                  isLastMove(square) ? 'chess-square-last-move' : ''
                }`}
                style={{
                  backgroundColor: isCapturingSquare ? themeColors.capture : backgroundColor,
                  opacity: isDraggedSquare && isDragging ? 0.5 : 1,
                  border: isDragOverSquare ? `2px solid ${themeColors.selected}` : 'none',
                  boxSizing: 'border-box',
                  transform: isKingInCheck(square) ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isKingInCheck(square) ? `0 0 10px ${themeColors.check}` : 'none',
                  position: 'relative'
                }}
                onClick={() => handleSquareClick(fileIndex, rankIndex)}
                onDragOver={(e) => handleDragOver(e, fileIndex, rankIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, fileIndex, rankIndex)}
              >
                {piece && !shouldHidePiece && (
                  <span 
                    className={`text-center leading-none chess-piece chess-piece-hover ${
                      draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                      isSquareSelected ? 'chess-piece-selected' : ''
                    } ${
                      isDraggedSquare && isDragging ? 'chess-piece-dragging' : ''
                    }`}
                    style={{ 
                      fontSize: squareSize * 0.7,
                      color: piece.color === 'w' ? '#000' : '#333',
                      userSelect: 'none',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
                    }}
                    draggable={draggable && piece.color === chess.turn()}
                    onDragStart={(e) => handleDragStart(e, fileIndex, rankIndex)}
                    onDragEnd={handleDragEnd}
                  >
                    {PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()]}
                  </span>
                )}
                
                {/* Legal move indicator */}
                {isLegalMoveSquare && !piece && (
                  <div 
                    className="absolute rounded-full bg-current"
                    style={{
                      width: squareSize * 0.3,
                      height: squareSize * 0.3,
                      color: themeColors.selected,
                      opacity: 0.6
                    }}
                  />
                )}
                
                {/* Capture indicator for legal moves on occupied squares */}
                {isLegalMoveSquare && piece && (
                  <div 
                    className="absolute inset-0 border-4 rounded opacity-50"
                    style={{
                      borderColor: themeColors.selected
                    }}
                  />
                )}
                
                {/* Coordinates */}
                {showCoordinates && (
                  <>
                    {rankIndex === 7 && (
                      <span 
                        className="absolute bottom-0 left-1 text-xs font-medium"
                        style={{ color: getSquareColor(fileIndex, rankIndex) === themeColors.light ? themeColors.dark : themeColors.light }}
                      >
                        {file}
                      </span>
                    )}
                    {fileIndex === 7 && (
                      <span 
                        className="absolute top-0 right-1 text-xs font-medium"
                        style={{ color: getSquareColor(fileIndex, rankIndex) === themeColors.light ? themeColors.dark : themeColors.light }}
                      >
                        {rank}
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
        
      {/* Animated pieces */}
      {animatingPieces.map((animPiece, index) => {
          const fromPos = getSquarePosition(animPiece.from)
          const toPos = getSquarePosition(animPiece.to)
          const elapsed = Date.now() - animPiece.startTime
          const progress = Math.min(elapsed / animationDuration, 1)
          
          // Easing function for smooth animation
          const easeOutQuart = 1 - Math.pow(1 - progress, 4)
          
          const currentX = fromPos.x + (toPos.x - fromPos.x) * easeOutQuart
          const currentY = fromPos.y + (toPos.y - fromPos.y) * easeOutQuart
          
          return (
            <div
              key={`${animPiece.from}-${animPiece.to}-${index}`}
              className="absolute pointer-events-none z-20 flex items-center justify-center chess-animated-piece"
              style={{
                left: currentX,
                top: currentY,
                width: squareSize,
                height: squareSize,
                transform: `scale(${1 + progress * 0.05})`,
                opacity: 1
              }}
            >
              <span
                className="text-center leading-none drop-shadow-lg"
                style={{
                  fontSize: squareSize * 0.7,
                  color: animPiece.piece.includes('♔') || animPiece.piece.includes('♕') || 
                         animPiece.piece.includes('♖') || animPiece.piece.includes('♗') || 
                         animPiece.piece.includes('♘') || animPiece.piece.includes('♙') ? '#000' : '#333',
                  userSelect: 'none'
                }}
              >
                {animPiece.piece}
              </span>
            </div>
          )
        })}
      
      {/* Status indicators */}
      {(selectedSquare || draggedFrom || animatingPieces.length > 0) && (
        <div className="absolute top-full left-0 mt-2 text-xs text-gray-600 space-y-1">
          {selectedSquare && <div>Selected: {selectedSquare}</div>}
          {draggedFrom && <div>Dragging from: {draggedFrom}</div>}
          {legalMoves.length > 0 && <div>Legal moves: {legalMoves.length}</div>}
          {animatingPieces.length > 0 && <div>Animating: {animatingPieces.length} piece(s)</div>}
          {lastMove && <div>Last move: {lastMove.from} → {lastMove.to}</div>}
        </div>
      )}
    </div>
  )
}