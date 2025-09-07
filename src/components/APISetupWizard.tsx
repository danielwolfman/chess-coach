import { useState, useEffect } from 'react';
import { ttsAdapter } from '../services/tts-adapter';

interface APISetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'welcome' | 'provider-select' | 'get-key' | 'enter-key' | 'test-key' | 'complete';
type TTSProviderType = 'openai' | 'google-cloud' | 'lemonfox' | 'web-speech';

export function APISetupWizard({ isOpen, onClose, onComplete }: APISetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<TTSProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if API keys already exist and provider preferences
  useEffect(() => {
    if (isOpen) {
      // Check current TTS provider
      const currentProvider = ttsAdapter.getProvider();
      setSelectedProvider(currentProvider as TTSProviderType);
      
      // Check for existing API keys
      const openaiKey = localStorage.getItem('chess-coach-openai-api-key');
      const googleCloudKey = localStorage.getItem('chess-coach-google-cloud-api-key');
      const lemonfoxKey = localStorage.getItem('chess-coach-lemonfox-api-key');
      
      if (currentProvider === 'openai' && openaiKey) {
        setApiKey(openaiKey);
        setCurrentStep('test-key');
      } else if (currentProvider === 'google-cloud' && googleCloudKey) {
        setApiKey(googleCloudKey);
        setCurrentStep('test-key');
      } else if ((currentProvider as string) === 'lemonfox' && lemonfoxKey) {
        setApiKey(lemonfoxKey);
        setCurrentStep('test-key');
      } else if (currentProvider === 'web-speech') {
        // Web Speech API doesn't need API key
        setCurrentStep('complete');
      } else {
        setCurrentStep('welcome');
      }
    }
  }, [isOpen]);

  const handleNext = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('provider-select');
        break;
      case 'provider-select':
        if (selectedProvider === 'web-speech') {
          // Web Speech doesn't need API key, go straight to complete
          ttsAdapter.setProvider(selectedProvider);
          setCurrentStep('complete');
        } else {
          setCurrentStep('get-key');
        }
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
      case 'provider-select':
        setCurrentStep('welcome');
        break;
      case 'get-key':
        setCurrentStep('provider-select');
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
      if (selectedProvider === 'openai') {
        // Test OpenAI API
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
            ttsAdapter.setProvider('openai');
            ttsAdapter.reinitialize();
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
      } else if (selectedProvider === 'google-cloud') {
        // Test Google Cloud TTS API
        const testRequestBody = {
          input: { text: 'Hello, this is a test.' },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Standard-C',
            ssmlGender: 'FEMALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0
          }
        };

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testRequestBody)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audioContent) {
            // Save the key and mark as successful
            localStorage.setItem('chess-coach-google-cloud-api-key', apiKey.trim());
            ttsAdapter.setProvider('google-cloud');
            ttsAdapter.reinitialize();
            setTestResult('success');
            setCurrentStep('complete');
          } else {
            setTestResult('error');
            setErrorMessage('API key test succeeded but no audio content was returned.');
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setTestResult('error');
          
          if (response.status === 401) {
            setErrorMessage('Invalid API key or insufficient permissions.');
          } else if (response.status === 403) {
            setErrorMessage('API not enabled for this project or quota exceeded.');
          } else if (response.status === 400) {
            setErrorMessage('Invalid request. Please check your API key format.');
          } else {
            setErrorMessage(
              errorData.error?.message || 
              `API key test failed (${response.status}): ${response.statusText}`
            );
          }
        }
      } else if (selectedProvider === 'lemonfox') {
        // Test Lemonfox by requesting a tiny audio clip
        const response = await fetch('https://api.lemonfox.ai/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ input: 'Hello', voice: 'sarah', response_format: 'mp3', speed: 1.0 })
        });

        if (response.ok) {
          // Save the key and mark as successful
          localStorage.setItem('chess-coach-lemonfox-api-key', apiKey.trim());
          ttsAdapter.setProvider('lemonfox');
          ttsAdapter.reinitialize();
          setTestResult('success');
          setCurrentStep('complete');
        } else {
          const errorText = await response.text();
          setTestResult('error');
          setErrorMessage(errorText || `API key test failed (${response.status}): ${response.statusText}`);
        }
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
    // Save empty keys (user can set them up later via TTS settings)
    localStorage.removeItem('chess-coach-openai-api-key');
    localStorage.removeItem('chess-coach-google-cloud-api-key');
    
    // Set to web speech as fallback
    ttsAdapter.setProvider('web-speech');
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
    'provider-select': 2,
    'get-key': 3,
    'enter-key': 4,
    'test-key': 5,
    complete: 6
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
            {[1, 2, 3, 4, 5, 6].map((step) => (
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
            Step {stepProgress[currentStep]} of 6
          </p>
        </div>

        {/* Step Content */}
        <div className="p-6 min-h-[300px]">
          {currentStep === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">🧠</div>
              <h3 className="text-2xl font-bold">Welcome to AI-Powered Chess Coaching!</h3>
              <p className="text-gray-600">
                Get personalized mistake analysis and improvement tips with high-quality text-to-speech feedback.
                Choose your preferred TTS provider to get started.
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

          {currentStep === 'provider-select' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🎯 Choose Your TTS Provider</h3>
              <p className="text-gray-600">
                Select your preferred text-to-speech provider for voice feedback:
              </p>

              <div className="space-y-3">
                {/* OpenAI Option */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProvider === 'openai'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedProvider('openai')}
                  style={{
                    backgroundColor: selectedProvider === 'openai' ? 'var(--color-surface)' : 'transparent',
                    borderColor: selectedProvider === 'openai' ? '#3b82f6' : 'var(--color-border)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedProvider === 'openai'}
                      onChange={() => setSelectedProvider('openai')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold">OpenAI GPT-4o-mini TTS</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        High-quality AI voices with natural intonation and emotion
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Pricing:</span> $0.60 per 1M input chars + $12 per 1M audio tokens (~$0.015/minute)
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        <span className="font-medium">✓ Requires:</span> OpenAI API key
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Cloud Option */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProvider === 'google-cloud'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedProvider('google-cloud')}
                  style={{
                    backgroundColor: selectedProvider === 'google-cloud' ? 'var(--color-surface)' : 'transparent',
                    borderColor: selectedProvider === 'google-cloud' ? '#3b82f6' : 'var(--color-border)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedProvider === 'google-cloud'}
                      onChange={() => setSelectedProvider('google-cloud')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold">Google Cloud Text-to-Speech</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Multiple voice types: Standard, WaveNet, and Neural voices
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Pricing:</span> Standard: $4.00/1M chars, WaveNet: $16.00/1M chars
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        <span className="font-medium">✓ Requires:</span> Google Cloud API key
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lemonfox Option */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProvider === 'lemonfox'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedProvider('lemonfox')}
                  style={{
                    backgroundColor: selectedProvider === 'lemonfox' ? 'var(--color-surface)' : 'transparent',
                    borderColor: selectedProvider === 'lemonfox' ? '#3b82f6' : 'var(--color-border)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedProvider === 'lemonfox'}
                      onChange={() => setSelectedProvider('lemonfox')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold">Lemonfox.ai Text-to-Speech</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Fast, natural voices via Lemonfox API
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Pricing:</span> See Lemonfox pricing
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        <span className="font-medium">✓ Requires:</span> Lemonfox API key
                      </div>
                    </div>
                  </div>
                </div>

                {/* Web Speech Option */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProvider === 'web-speech'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedProvider('web-speech')}
                  style={{
                    backgroundColor: selectedProvider === 'web-speech' ? 'var(--color-surface)' : 'transparent',
                    borderColor: selectedProvider === 'web-speech' ? '#3b82f6' : 'var(--color-border)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedProvider === 'web-speech'}
                      onChange={() => setSelectedProvider('web-speech')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold">Browser Text-to-Speech</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Built-in browser voices (quality varies by system)
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Pricing:</span> Free (uses system voices)
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        <span className="font-medium">✓ No API key required</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>💡 Recommendation:</strong> OpenAI offers the most natural voices for chess coaching, 
                while Google Cloud provides excellent quality with more voice options. Browser TTS is a good 
                free option but quality depends on your system.</p>
              </div>
            </div>
          )}

          {currentStep === 'get-key' && selectedProvider === 'openai' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">📋 Getting Your OpenAI API Key</h3>
              <p className="text-gray-600">
                Follow these steps to get your API key from OpenAI:
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
                <p><strong>💳 Pricing:</strong> GPT-4o-mini TTS costs $0.60 per 1M input chars + $12 per 1M audio tokens (~$0.015/minute).</p>
              </div>
            </div>
          )}

          {currentStep === 'get-key' && selectedProvider === 'google-cloud' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🔑 Getting Your Google Cloud API Key</h3>
              <p className="text-gray-600">
                Follow these steps to get your Google Cloud Text-to-Speech API key:
              </p>
              
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    Visit{' '}
                    <button 
                      onClick={() => copyToClipboard('https://console.cloud.google.com/')}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      console.cloud.google.com
                    </button>
                    {' '}and sign in
                  </div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                  <div>Create or select a project</div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                  <div>Enable the <strong>"Cloud Text-to-Speech API"</strong></div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
                  <div>Go to <strong>APIs & Services → Credentials</strong></div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">5</span>
                  <div>Click <strong>"Create Credentials" → "API Key"</strong></div>
                </li>
                
                <li className="flex gap-3">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">6</span>
                  <div><strong>Copy the API key</strong> and close the dialog</div>
                </li>
              </ol>

              <div className="bg-yellow-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>💳 Pricing:</strong> Standard voices: $4.00 per 1M chars (~$0.004/minute), WaveNet: $16.00 per 1M chars (~$0.016/minute).</p>
              </div>
            </div>
          )}

          {currentStep === 'get-key' && selectedProvider === 'lemonfox' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🔑 Getting Your Lemonfox API Key</h3>
              <p className="text-gray-600">
                Create an API key in your Lemonfox dashboard, then paste it on the next screen.
              </p>
              <div className="bg-yellow-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>Tip:</strong> Free tiers may have limits. Check lemonfox.ai for details.</p>
              </div>
            </div>
          )}

          {currentStep === 'enter-key' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🔑 Enter Your API Key</h3>
              <p className="text-gray-600">
                Paste your {selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'google-cloud' ? 'Google Cloud' : 'Lemonfox'} API key below. It will be stored securely in your browser.
              </p>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  {selectedProvider === 'openai' ? 'OpenAI API Key' : selectedProvider === 'google-cloud' ? 'Google Cloud API Key' : 'Lemonfox API Key'}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedProvider === 'openai' ? 'sk-proj-...' : selectedProvider === 'google-cloud' ? 'AIza...' : 'lfx_...'}
                  className="w-full px-4 py-3 border-2 rounded-lg text-sm font-mono"
                  style={{ 
                    borderColor: apiKey.trim() ? 'var(--color-success, #10b981)' : 'var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)'
                  }}
                />
                <p className="text-xs text-gray-500">
                  {selectedProvider === 'openai' 
                    ? 'Your API key starts with "sk-" and is stored only on your device'
                    : selectedProvider === 'google-cloud' 
                      ? 'Your API key starts with "AIza" and is stored only on your device'
                      : 'Your API key is stored only on your device'
                  }
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <p><strong>🔒 Privacy:</strong> Your API key is stored locally in your browser and never sent to our servers. Only {selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'google-cloud' ? 'Google Cloud' : 'Lemonfox'} will receive your chess data for analysis.</p>
              </div>
            </div>
          )}

          {currentStep === 'test-key' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">🧪 Testing Your API Key</h3>
              
              {!isTestingKey && testResult === null && (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    Let's verify your API key works and has access to{' '}
                    {selectedProvider === 'openai' ? 'GPT TTS models' : selectedProvider === 'google-cloud' ? 'Google Cloud TTS' : 'Lemonfox TTS'}.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                    <p>We'll make a quick test request to check:</p>
                    <ul className="text-left mt-2 space-y-1">
                      <li>• API key is valid</li>
                      <li>• {selectedProvider === 'openai' ? 'Account has GPT TTS access' : 'Text-to-Speech API is enabled'}</li>
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
                    Your API key is valid and {selectedProvider === 'openai' ? 'has access to GPT TTS' : selectedProvider === 'google-cloud' ? 'Google Cloud TTS is working' : 'Lemonfox TTS is working'}. You're all set!
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
