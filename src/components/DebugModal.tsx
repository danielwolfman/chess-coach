import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CoachState, MistakeReviewContext, MistakeReviewOutput } from '@/types/coach';
import { ttsAdapter } from '@/services/tts-adapter';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  mistakeContext?: MistakeReviewContext;
}

export function DebugModal({ isOpen, onClose, mistakeContext }: DebugModalProps) {
  const [debugState, setDebugState] = useState<CoachState>({
    isStreaming: false,
    streamedText: '',
    currentTask: null,
    parsedOutput: null,
    error: null
  });
  const [ttsSession, setTtsSession] = useState<any>(null);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const streamedTextRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll functions
  useEffect(() => {
    if (streamedTextRef.current) {
      streamedTextRef.current.scrollTop = streamedTextRef.current.scrollHeight;
    }
  }, [debugState.streamedText]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Track last fed text length to avoid re-feeding entire text
  const [lastFedLength, setLastFedLength] = useState(0);

  // Start TTS when streaming begins
  useEffect(() => {
    if (debugState.isStreaming && !ttsSession && debugState.streamedText) {
      const session = ttsAdapter.begin(`debug-${Date.now()}`);
      setTtsSession(session);
      session.feed(debugState.streamedText);
      setLastFedLength(debugState.streamedText.length);
    } else if (ttsSession && debugState.streamedText) {
      // Only feed the new text that hasn't been fed yet
      const newText = debugState.streamedText.slice(lastFedLength);
      if (newText.length > 0) {
        ttsSession.feed(newText);
        setLastFedLength(debugState.streamedText.length);
      }
    }
  }, [debugState.isStreaming, debugState.streamedText, ttsSession, lastFedLength]);

  // When streaming completes, let TTS finish naturally
  useEffect(() => {
    if (!debugState.isStreaming && ttsSession) {
      const checkTtsComplete = () => {
        if (ttsSession && !ttsSession.isActive()) {
          setTtsSession(null);
          setLastFedLength(0);
        } else if (ttsSession) {
          setTimeout(checkTtsComplete, 500);
        }
      };
      setTimeout(checkTtsComplete, 1000);
    }
  }, [debugState.isStreaming, ttsSession]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const mockApiRequest = () => {
    if (!mistakeContext) {
      addLog('ERROR: No mistake context available');
      return;
    }

    addLog('=== MOCK API REQUEST START ===');
    
    // Mock the API request logging
    const mockRequest = {
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-5',
      messageCount: 2,
      hasApiKey: true,
      systemPrompt: {
        role: 'system',
        content: `You are a friendly, encouraging chess coach who speaks naturally to players. Avoid technical jargon like "centipawns" or overly analytical language. Your goal is to help players improve through clear, human explanations.

When analyzing a mistake:
- Give it a descriptive name that explains what went wrong (e.g., "Missed a tactical opportunity" or "Overlooked opponent's threat")
- Explain in conversational language why the move created problems
- Suggest a better approach or mindset for similar positions
- Provide a concrete alternative line of play (up to 6 moves in algebraic notation)

Speak as if you're sitting next to the player, using encouraging language. Focus on learning opportunities rather than dwelling on the error. Never suggest illegal moves.

Respond with a JSON object in this exact format:
{
  "name": "Friendly description of what went wrong",
  "why": "Conversational explanation of why this created problems",
  "better_plan": "Encouraging description of the right approach",
  "line": ["move1", "move2", "move3"]
}`
      },
      userPrompt: {
        role: 'user',
        content: `Position: ${mistakeContext.fen}
Player: ${mistakeContext.playerColor} (Level ${mistakeContext.level})
Recent moves: ${mistakeContext.lastMovesSan.slice(-8).join(' ')}

The player just made a move that wasn't the strongest choice. The computer analysis shows this move worsened their position.

${mistakeContext.annotations.best_line?.length ? `A better line would have been: ${mistakeContext.annotations.best_line.join(' ')}` : ''}
${mistakeContext.annotations.motifs?.length ? `Key tactical themes in this position: ${mistakeContext.annotations.motifs.join(', ')}` : ''}

Please help the player understand what went wrong with their move and suggest a better approach. Be encouraging and focus on learning. Remember: only suggest moves that are legal in this position.`
      }
    };

    addLog(`REQUEST URL: ${mockRequest.url}`);
    addLog(`REQUEST MODEL: ${mockRequest.model}`);
    addLog(`REQUEST BODY:\n${JSON.stringify({
      model: mockRequest.model,
      messages: [mockRequest.systemPrompt, mockRequest.userPrompt],
      stream: true,
      max_completion_tokens: 1000
    }, null, 2)}`);

    // Mock the streaming response
    addLog('=== MOCK API RESPONSE START ===');
    addLog('Response Status: 200 OK');
    addLog('Response Headers: {"content-type": "text/event-stream", "x-request-id": "mock-123"}');

    // Start streaming simulation
    simulateStreaming();
  };

  const simulateStreaming = async () => {
    setDebugState(prev => ({
      ...prev,
      isStreaming: true,
      streamedText: '',
      currentTask: 'mistake_review',
      error: null
    }));

    addLog('Starting streaming simulation...');

    // Mock streaming chunks
    const mockResponse = `{
  "name": "Missed a powerful tactic",
  "why": "You had a beautiful opportunity to create a double attack with your knight, but instead played a move that allowed me to consolidate my position. Sometimes we get focused on one plan and miss the tactics that are right in front of us!",
  "better_plan": "Look for forcing moves first - checks, captures, and threats. In this position, your knight could have jumped to a square that attacks both my queen and my rook simultaneously.",
  "line": ["Nf5+", "Kh8", "Nxd6", "cxd6", "Rxd6", "Qc7"]
}`;

    // Simulate chunk-by-chunk streaming
    const chunks = mockResponse.split('');
    let accumulatedText = '';

    for (let i = 0; i < chunks.length; i++) {
      // Check if user stopped streaming (we'll use a flag instead of state)
      
      const chunk = chunks[i];
      accumulatedText += chunk;
      
      // Log the streaming data format
      if (i === 0) {
        addLog(`STREAM CHUNK: data: {"choices":[{"delta":{"content":"${chunk}"}}]}`);
      } else if (i % 10 === 0) { // Log every 10th chunk to avoid spam
        addLog(`STREAM CHUNK: data: {"choices":[{"delta":{"content":"${chunk}"}}]}`);
      }

      setDebugState(prev => ({
        ...prev,
        streamedText: accumulatedText
      }));

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    // Complete streaming
    addLog('STREAM CHUNK: data: [DONE]');
    addLog('=== MOCK API RESPONSE END ===');

    setDebugState(prev => ({
      ...prev,
      isStreaming: false
    }));

    // Parse and validate the response
    try {
      const parsed: MistakeReviewOutput = JSON.parse(accumulatedText);
      setDebugState(prev => ({
        ...prev,
        parsedOutput: parsed
      }));
      addLog(`PARSED OUTPUT: ${JSON.stringify(parsed, null, 2)}`);
    } catch (error) {
      addLog(`PARSING ERROR: ${error}`);
      setDebugState(prev => ({
        ...prev,
        error: `Failed to parse response: ${error}`
      }));
    }

    // Mock TTS input/output
    mockTTSProcessing(accumulatedText);
  };

  const mockTTSProcessing = (text: string) => {
    addLog('=== MOCK TTS PROCESSING START ===');
    
    // Extract the response content for TTS
    let ttsText = text;
    try {
      const parsed = JSON.parse(text);
      ttsText = `${parsed.name}. ${parsed.why} ${parsed.better_plan}`;
    } catch (e) {
      // Use raw text if parsing fails
    }

    addLog(`TTS INPUT: "${ttsText}"`);
    addLog(`TTS VOICE: alloy`);
    addLog(`TTS SPEED: 1.0`);
    addLog(`TTS MODEL: gpt-4o-mini-tts`);

    // Mock sentence extraction
    const sentences = ttsText.match(/[^.!?]+[.!?]+/g) || [ttsText];
    addLog(`TTS SENTENCES EXTRACTED: ${sentences.length}`);
    
    sentences.forEach((sentence, i) => {
      addLog(`TTS SENTENCE ${i + 1}: "${sentence.trim()}"`);
      addLog(`TTS API REQUEST ${i + 1}:`);
      addLog(`  URL: https://api.openai.com/v1/audio/speech`);
      addLog(`  BODY: ${JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: sentence.trim(),
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.0,
        instructions: 'Speak as a friendly, encouraging chess coach with a warm and supportive tone.'
      }, null, 2)}`);
      addLog(`TTS RESPONSE ${i + 1}: [Audio Blob - ${Math.floor(sentence.length * 150)} bytes]`);
    });

    addLog('=== MOCK TTS PROCESSING END ===');
  };

  const handleCopyText = async () => {
    const textToCopy = debugState.streamedText || 'No content available';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  const handleStopSpeaking = () => {
    if (ttsSession) {
      ttsSession.stop('user_stopped');
      setTtsSession(null);
    }
  };

  const handleStopStreaming = () => {
    setDebugState(prev => ({
      ...prev,
      isStreaming: false
    }));
    addLog('User stopped streaming');
  };

  const handleClose = () => {
    if (ttsSession) {
      ttsSession.stop('modal_closed');
      setTtsSession(null);
    }
    setDebugState({
      isStreaming: false,
      streamedText: '',
      currentTask: null,
      parsedOutput: null,
      error: null
    });
    setLogs([]);
    onClose();
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!isOpen) return null;

  const renderParsedOutput = (output: MistakeReviewOutput) => {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-red-800 mb-1">{output.name}</h4>
        </div>
        
        <div>
          <h5 className="font-medium text-sm text-gray-700 mb-1">Why this failed:</h5>
          <p className="text-sm text-gray-600">{output.why}</p>
        </div>
        
        <div>
          <h5 className="font-medium text-sm text-gray-700 mb-1">Better plan:</h5>
          <p className="text-sm text-gray-600">{output.better_plan}</p>
        </div>
        
        {output.line.length > 0 && (
          <div>
            <h5 className="font-medium text-sm text-gray-700 mb-1">Suggested line:</h5>
            <div className="text-sm font-mono bg-gray-100 p-2 rounded">
              {output.line.join(' ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold">Debug Coach Streaming</h2>
          <button
            onClick={handleClose}
            className="px-3 py-1 text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel - Coach Output */}
          <div className="flex-1 flex flex-col p-2 sm:p-4 border-r min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm sm:text-base">Coach Output</h3>
              <div className="flex gap-1 sm:gap-2">
                <button
                  onClick={mockApiRequest}
                  disabled={debugState.isStreaming}
                  className="px-2 py-1 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded transition-colors"
                >
                  {debugState.isStreaming ? 'Streaming...' : 'Start Debug'}
                </button>
                {debugState.isStreaming && (
                  <button
                    onClick={handleStopStreaming}
                    className="px-2 py-1 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>

            {/* Streaming or completed analysis */}
            {debugState.currentTask && (debugState.isStreaming || debugState.streamedText) && (
              <div className="flex-1 border rounded-md p-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {debugState.isStreaming ? 'Analyzing...' : 'Analysis Complete'}
                  </div>
                  <div className="flex items-center gap-2">
                    {debugState.streamedText && (
                      <button
                        onClick={handleCopyText}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
                      >
                        {copyFeedback || 'Copy'}
                      </button>
                    )}
                    {ttsSession && ttsSession.isActive() && (
                      <button
                        onClick={handleStopSpeaking}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-100 text-red-600"
                      >
                        Stop Speaking
                      </button>
                    )}
                  </div>
                </div>

                {/* Streamed content or parsed output */}
                <div 
                  ref={streamedTextRef}
                  className="text-sm max-h-96 overflow-y-auto bg-gray-50 p-2 rounded"
                >
                  {debugState.parsedOutput ? (
                    renderParsedOutput(debugState.parsedOutput)
                  ) : (
                    <div className="whitespace-pre-wrap font-mono text-xs">
                      {debugState.streamedText}
                      {debugState.isStreaming && (
                        <span className="animate-pulse">█</span>
                      )}
                    </div>
                  )}
                </div>

                {debugState.error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    Error: {debugState.error}
                  </div>
                )}
              </div>
            )}

            {!debugState.currentTask && (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Click "Start Debug Stream" to simulate the coaching pipeline
              </div>
            )}
          </div>

          {/* Right Panel - Debug Logs */}
          <div className="w-1/2 flex flex-col p-2 sm:p-4 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm sm:text-base">Debug Logs</h3>
              <button
                onClick={clearLogs}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
              >
                Clear
              </button>
            </div>
            
            <div 
              ref={logsRef}
              className="flex-1 bg-gray-900 text-green-400 p-3 rounded font-mono text-xs overflow-y-auto"
            >
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1 whitespace-pre-wrap">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 flex-shrink-0">
          <div className="text-xs text-gray-600">
            <strong>Context:</strong> {mistakeContext ? 
              `${mistakeContext.playerColor} to move, Level ${mistakeContext.level}, Position: ${mistakeContext.fen.slice(0, 30)}...` : 
              'No mistake context available'
            }
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
