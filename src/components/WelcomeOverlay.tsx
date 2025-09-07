// No React hooks needed here

interface WelcomeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupAI: () => void;
}

export function WelcomeOverlay({ isOpen, onClose, onSetupAI }: WelcomeOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto relative overflow-hidden"
        style={{ 
          background: 'var(--color-canvas)', 
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)'
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="text-9xl">♔♕♖♗♘♙</div>
        </div>
        
        {/* Content */}
        <div className="relative p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">♟️</div>
            <h1 className="text-3xl font-bold mb-2">Welcome to Chess Coach!</h1>
            <p className="text-lg text-gray-600">
              Your personal AI-powered chess improvement companion
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Features */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">✨ What you'll get:</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">●</span>
                  <span><strong>Instant mistake detection</strong> - Know immediately when you make errors</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">●</span>
                  <span><strong>AI-powered explanations</strong> - Understand why moves fail and what's better</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">●</span>
                  <span><strong>Voice coaching</strong> - Hear explanations while you play</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 mt-0.5">●</span>
                  <span><strong>Adaptive difficulty</strong> - Opponent adjusts to your level</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">●</span>
                  <span><strong>Performance tracking</strong> - See your improvement over time</span>
                </li>
              </ul>
            </div>

            {/* Getting Started */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">🚀 Getting Started:</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span><strong>Start playing</strong> - The board is ready, make your first move!</span>
                </div>
                <div className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span><strong>Watch for mistakes</strong> - You'll hear a chime and see an "Explain Mistake" button</span>
                </div>
                <div className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span><strong>Enable AI coaching</strong> - Click "🤖 AI Setup" for personalized analysis</span>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onSetupAI}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              🤖 Set Up AI Coaching
              <span className="text-xs bg-blue-500 px-2 py-1 rounded">Recommended</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
              style={{ 
                borderColor: 'var(--color-border)',
                background: 'transparent'
              }}
            >
              Start Playing Now
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>
              <strong>Free to play!</strong> AI coaching requires OpenAI API key (~$0.01-0.05 per analysis)
            </p>
            <p className="mt-1">
              You can enable AI features anytime by clicking "🤖 AI Setup" in the navigation
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl hover:opacity-70 transition-opacity"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
