interface PgnHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;
  WhiteElo?: string;
  BlackElo?: string;
  ECO?: string;
  Opening?: string;
  TimeControl?: string;
  [key: string]: string | undefined;
}

export interface PgnExportOptions {
  headers?: PgnHeaders;
  includeTimestamp?: boolean;
  filename?: string;
}

export function formatPgnHeaders(headers: PgnHeaders = {}): string {
  const defaultHeaders: Required<Pick<PgnHeaders, 'Event' | 'Site' | 'Date' | 'Round' | 'White' | 'Black' | 'Result'>> = {
    Event: 'Chess Coach Game',
    Site: 'Chess Coach App',
    Date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
    Round: '1',
    White: 'Player',
    Black: 'Player',
    Result: '*',
    ...headers
  };

  const headerLines: string[] = [];
  
  Object.entries(defaultHeaders).forEach(([key, value]) => {
    if (value !== undefined) {
      headerLines.push(`[${key} "${value}"]`);
    }
  });

  return headerLines.join('\n');
}

export function formatPgnGame(pgn: string, options: PgnExportOptions = {}): string {
  const headers = formatPgnHeaders(options.headers);
  
  const cleanPgn = pgn.trim();
  
  if (cleanPgn === '' || cleanPgn === '1. ') {
    return `${headers}\n\n*`;
  }

  return `${headers}\n\n${cleanPgn}`;
}

export function downloadPgnFile(content: string, filename?: string): void {
  const defaultFilename = filename || `chess-game-${new Date().toISOString().split('T')[0]}.pgn`;
  
  const blob = new Blob([content], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function exportGameToPgn(pgn: string, options: PgnExportOptions = {}): void {
  const formattedPgn = formatPgnGame(pgn, options);
  downloadPgnFile(formattedPgn, options.filename);
}

export function parsePgnFile(content: string): { headers: PgnHeaders; moves: string } {
  const lines = content.trim().split('\n');
  const headers: PgnHeaders = {};
  let moveStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('[') && line.endsWith(']')) {
      const match = line.match(/^\[(\w+)\s+"([^"]*)"\]$/);
      if (match) {
        headers[match[1]] = match[2];
      }
    } else if (line === '') {
      continue;
    } else {
      moveStart = i;
      break;
    }
  }
  
  const moves = lines.slice(moveStart).join('\n').trim();
  
  return { headers, moves };
}

export function generateGameFilename(gameId?: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const id = gameId ? `-${gameId.slice(-8)}` : '';
  return `chess-game-${timestamp}${id}.pgn`;
}