import { useState, useEffect } from 'react';

interface APISetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'welcome' | 'get-key' | 'enter-key' | 'test-key' | 'complete';

export function APISetupWizard({ isOpen, onClose, onComplete }: APISetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [apiKey, setApiKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if API key already exists
  useEffect(() => {
    if (isOpen) {
      const existingKey = localStorage.getItem('chess-coach-openai-api-key');
      if (existingKey) {
        setApiKey(existingKey);
        setCurrentStep('test-key');
      } else {
        setCurrentStep('welcome');
      }
    }
  }, [isOpen]);

  const handleNext = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('get-key');
        break;
      case 'get-key':
        setCurrentStep('enter-key');
        break;
      case 'enter-key':
        if (apiKey.trim()) {
          setCurrentStep('test-key');
        }
        break;
      case 'test-key':
        testApiKey();
        break;
      case 'complete':
        onComplete();
        onClose();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'get-key':
        setCurrentStep('welcome');
        break;
      case 'enter-key':
        setCurrentStep('get-key');
        break;
      case 'test-key':
        setCurrentStep('enter-key');
        break;
      case 'complete':
        setCurrentStep('test-key');
        break;
    }
  };

  const testApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsTestingKey(true);
    setTestResult(null);
    setErrorMessage('');

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const hasGPT5 = data.data?.some((model: any) => 
          model.id === 'gpt-5' || model.id.includes('gpt-5') || model.id.includes('gpt-4.1')
        );
        
        if (hasGPT5) {
          // Save the key and mark as successful
          localStorage.setItem('chess-coach-openai-api-key', apiKey.trim());
          setTestResult('success');
          setCurrentStep('complete');
        } else {
          setTestResult('error');
          setErrorMessage('API key valid but no GPT-5 access found. You may need to upgrade your OpenAI plan.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setTestResult('error');
        setErrorMessage(
          errorData.error?.message || 
          `API key test failed (${response.status}): ${response.statusText}`
        );
      }
    } catch (error) {
      setTestResult('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Network error - please check your connection'
      );
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSkip = () => {
    // Save empty key (user can set it up later via TTS settings)
    localStorage.removeItem('chess-coach-openai-api-key');
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for browsers without clipboard API
    });
  };

  if (!isOpen) return null;

  const stepProgress = {
    welcome: 1,
    'get-key': 2,
    'enter-key': 3,
    'test-key': 4,
    complete: 5
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-auto"
        style={{ 
          background: 'var(--color-canvas)', 
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)'
        }}
      >
        {/* Header with Progress */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">🤖 AI Coach Setup</h2>
            <button
              onClick={onClose}
              className="text-2xl hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  step <= stepProgress[currentStep] 
                    ? 'bg-blue-500' 
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Step {stepProgress[currentStep]} of 5
          </p>
        </div>

        {/* Step Content */}
        <div className="p-6 min-h-[300px]">
          {currentStep === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">🧠</div>
              <h3 className="text-2xl font-bold">Welcome to AI-Powered Chess Coaching!</h3>
              <p className="text-gray-600">
                Get personalized mistake analysis and improvement tips powered by GPT-5. 
                We'll help you set up your OpenAI API key in just a few steps.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>What you'll get:</strong></p>
                <ul className="text-left mt-2 space-y-1">
                  <li>• Detailed explanations of your mistakes</li>
                  <li>• Personalized improvement suggestions</li>
                  <li>• High-quality voice feedback</li>
                  <li>• Advanced tactical analysis</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 'get-key' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">📋 Getting Your OpenAI API Key</h3>
              <p className="text-gray-600">
                Follow these steps to get your GPT-5 API key from OpenAI:
              </p>
              
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    Visit{' '}
                    <button 
                      onClick={() => copyToClipboard('https://platform.openai.com/api-keys')}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      platform.openai.com/api-keys
                    </button>
                    {' '}and sign in
                  </div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                  <div>Click <strong>"Create new secret key"</strong></div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                  <div>Give it a name like <code className="bg-gray-100 px-1 rounded">"Chess Coach"</code></div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
                  <div><strong>Copy the key immediately</strong> (you won't see it again!)</div>
                </li>
              </ol>

              <div className="bg-yellow-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>💳 Pricing:</strong> GPT-5 costs ~$1.25 per 1M input tokens. For chess coaching, expect around $0.01-0.05 per analysis.</p>
              </div>
            </div>
          )}

          {currentStep === 'enter-key' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🔑 Enter Your API Key</h3>
              <p className="text-gray-600">
                Paste your OpenAI API key below. It will be stored securely in your browser.
              </p>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full px-4 py-3 border-2 rounded-lg text-sm font-mono"
                  style={{ 
                    borderColor: apiKey.trim() ? 'var(--color-success, #10b981)' : 'var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)'
                  }}
                />
                <p className="text-xs text-gray-500">
                  Your API key starts with "sk-" and is stored only on your device
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>🔒 Privacy:</strong> Your API key is stored locally in your browser and never sent to our servers. Only OpenAI will receive your chess data for analysis.</p>
              </div>
            </div>
          )}

          {currentStep === 'test-key' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🧪 Testing Your API Key</h3>
              
              {!isTestingKey && testResult === null && (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    Let's verify your API key works and has access to GPT-5.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                    <p>We'll make a quick test request to check:</p>
                    <ul className="text-left mt-2 space-y-1">
                      <li>• API key is valid</li>
                      <li>• Account has GPT-5 access</li>
                      <li>• Connection is working</li>
                    </ul>
                  </div>
                </div>
              )}

              {isTestingKey && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Testing your API key...</p>
                </div>
              )}

              {testResult === 'success' && (
                <div className="text-center space-y-4">
                  <div className="text-6xl mb-4">✅</div>
                  <h4 className="text-xl font-bold text-green-600">Success!</h4>
                  <p className="text-gray-600">
                    Your API key is valid and has access to GPT-5. You're all set!
                  </p>
                </div>
              )}

              {testResult === 'error' && (
                <div className="text-center space-y-4">
                  <div className="text-6xl mb-4">❌</div>
                  <h4 className="text-xl font-bold text-red-600">Test Failed</h4>
                  <div className="text-left bg-red-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                    <p className="font-medium text-red-800 mb-2">Error:</p>
                    <p className="text-red-700">{errorMessage}</p>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Please check your API key and try again, or skip setup to configure later.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold">You're All Set!</h3>
              <p className="text-gray-600">
                Your AI chess coach is now ready to help you improve your game.
              </p>
              
              <div className="bg-green-50 p-4 rounded-lg text-left text-sm" style={{ background: 'var(--color-surface)' }}>
                <p className="font-medium mb-2">What happens next:</p>
                <ul className="space-y-1">
                  <li>• Make moves and play against the coach</li>
                  <li>• When you make mistakes, click "Explain Mistake"</li>
                  <li>• Get detailed AI analysis with voice feedback</li>
                  <li>• Improve your chess skills faster!</li>
                </ul>
              </div>

              <p className="text-xs text-gray-500">
                You can always change your API key later via the 🔊 TTS button in the navigation.
              </p>
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div 
          className="px-6 py-4 border-t flex justify-between items-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex gap-2">
            {currentStep !== 'welcome' && currentStep !== 'complete' && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                ← Back
              </button>
            )}
            
            {currentStep !== 'complete' && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                Skip for now
              </button>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={
              (currentStep === 'enter-key' && !apiKey.trim()) || 
              isTestingKey ||
              (currentStep === 'test-key' && testResult === 'error')
            }
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {currentStep === 'complete' ? 'Start Coaching!' : 
             currentStep === 'test-key' && !isTestingKey ? 'Test Key' :
             isTestingKey ? 'Testing...' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}