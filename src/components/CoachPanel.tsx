import { useState, useRef, useEffect } from 'react';
import type { CoachState, MistakeReviewOutput } from '@/types/coach';
import { ttsAdapter } from '@/services/tts-adapter';

interface CoachPanelProps {
  coachState: CoachState;
  mistakeAvailable: any;
  onRequestMistakeExplanation: (moveIndex: number) => void;
  onClearMistakeAvailable: () => void;
  resignedInfo?: { reason: string } | null;
  devRationale?: string;
  showDevRationale?: boolean;
}

export function CoachPanel({
  coachState,
  mistakeAvailable,
  onRequestMistakeExplanation,
  onClearMistakeAvailable,
  resignedInfo,
  devRationale,
  showDevRationale
}: CoachPanelProps) {
  const [ttsSession, setTtsSession] = useState<any>(null);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const streamedTextRef = useRef<HTMLDivElement>(null);

  // Auto-scroll streamed text
  useEffect(() => {
    if (streamedTextRef.current) {
      streamedTextRef.current.scrollTop = streamedTextRef.current.scrollHeight;
    }
  }, [coachState.streamedText]);

  // Start TTS when streaming begins
  useEffect(() => {
    if (coachState.isStreaming && !ttsSession && coachState.streamedText) {
      const session = ttsAdapter.begin(`coach-${Date.now()}`);
      setTtsSession(session);
      session.feed(coachState.streamedText);
    } else if (ttsSession && coachState.streamedText) {
      ttsSession.feed(coachState.streamedText);
    }
  }, [coachState.isStreaming, coachState.streamedText, ttsSession]);

  // Stop TTS when streaming completes
  useEffect(() => {
    if (!coachState.isStreaming && ttsSession) {
      // Give TTS a moment to finish current sentence before stopping
      setTimeout(() => {
        if (ttsSession) {
          ttsSession.stop('streaming_completed');
        }
        setTtsSession(null);
      }, 1000);
    }
  }, [coachState.isStreaming, ttsSession]);

  const handleCopyText = async () => {
    const textToCopy = coachState.streamedText || 'No content available';
    
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

  const handleClose = () => {
    if (ttsSession) {
      ttsSession.stop('panel_closed');
      setTtsSession(null);
    }
    onClearMistakeAvailable();
  };

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

  return (
    <div className="ui-card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-medium">Coach</h3>
        {mistakeAvailable && !coachState.isStreaming && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRequestMistakeExplanation(mistakeAvailable.moveIndex)}
              className="px-3 py-1 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Explain Mistake
            </button>
            <button
              onClick={onClearMistakeAvailable}
              className="px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] rounded"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Streaming or completed analysis */}
      {coachState.currentTask && (coachState.isStreaming || coachState.streamedText) && (
        <div className="mt-3 border rounded-md p-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              {coachState.isStreaming ? 'Analyzing...' : 'Analysis Complete'}
            </div>
            <div className="flex items-center gap-2">
              {coachState.streamedText && (
                <button
                  onClick={handleCopyText}
                  className="px-2 py-1 text-xs border rounded hover:bg-[var(--color-surface)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {copyFeedback || 'Copy'}
                </button>
              )}
              {ttsSession && ttsSession.isActive() && (
                <button
                  onClick={handleStopSpeaking}
                  className="px-2 py-1 text-xs border rounded hover:bg-[var(--color-surface)] text-red-600"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  Stop Speaking
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                ×
              </button>
            </div>
          </div>

          {/* Streamed content or parsed output */}
          <div 
            ref={streamedTextRef}
            className="text-sm max-h-64 overflow-y-auto"
            style={{ background: 'var(--color-surface)' }}
          >
            {coachState.parsedOutput ? (
              renderParsedOutput(coachState.parsedOutput)
            ) : (
              <div className="whitespace-pre-wrap font-mono text-xs p-2">
                {coachState.streamedText}
                {coachState.isStreaming && (
                  <span className="animate-pulse">█</span>
                )}
              </div>
            )}
          </div>

          {coachState.error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
              Error: {coachState.error}
            </div>
          )}
        </div>
      )}

      {/* Mistake available notification */}
      {mistakeAvailable && !coachState.currentTask && (
        <div className="mt-2 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-lg p-4 border border-red-200/50 dark:border-red-800/30">
          <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-300">
            {mistakeAvailable.class === 'blunder' ? '💥 Blunder' : 
             mistakeAvailable.class === 'mistake' ? '⚠️ Mistake' : '📍 Inaccuracy'} detected!
          </div>
          <div className="text-red-700 dark:text-red-400 text-xs mt-2">
            That move might not have been the best choice. Click "Explain Mistake" to learn more.
          </div>
        </div>
      )}

      {/* Default state */}
      {!mistakeAvailable && !coachState.currentTask && (
        <p className="text-sm text-[var(--color-muted)]">
          Hints, tips, and insights will appear here.
        </p>
      )}

      {/* Resignation info */}
      {resignedInfo && (
        <div
          className="mt-2 text-sm rounded-md border px-3 py-2 text-red-700 font-semibold"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          {resignedInfo.reason}
        </div>
      )}

      {/* Dev rationale */}
      {showDevRationale && devRationale && (
        <div
          className="mt-2 text-sm rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          {devRationale}
        </div>
      )}
    </div>
  );
}