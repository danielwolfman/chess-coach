import { useState, useEffect } from 'react';
import { ttsAdapter } from '@/services/tts-adapter';

interface TTSSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TTSSettings({ isOpen, onClose }: TTSSettingsProps) {
  const [enabled, setEnabled] = useState(true);
  const [rate, setRate] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isOpenAIAvailable, setIsOpenAIAvailable] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');

  // Load current settings
  useEffect(() => {
    if (isOpen) {
      setIsOpenAIAvailable((ttsAdapter as any).isOpenAIAvailable());
      setVoices(ttsAdapter.getVoices());
      
      // Load stored API key
      const storedKey = localStorage.getItem('chess-coach-openai-api-key') || '';
      setApiKey(storedKey);
    }
  }, [isOpen]);

  const handleEnableToggle = (checked: boolean) => {
    setEnabled(checked);
    ttsAdapter.setEnabled(checked);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    ttsAdapter.setRate(newRate);
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    ttsAdapter.setVoice(voiceId);
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    if (key.trim()) {
      localStorage.setItem('chess-coach-openai-api-key', key.trim());
      // Try to reinitialize OpenAI TTS
      const success = (ttsAdapter as any).reinitialize();
      if (success) {
        setIsOpenAIAvailable(true);
        setVoices(ttsAdapter.getVoices());
      }
    } else {
      localStorage.removeItem('chess-coach-openai-api-key');
      setIsOpenAIAvailable(false);
      setVoices([]);
    }
  };

  const testTTS = () => {
    const session = ttsAdapter.begin('test');
    session.feed('Testing chess coach voice. Good move!');
    // Give OpenAI TTS more time to generate and play the audio
    setTimeout(() => {
      if (session.isActive()) {
        // Still playing, wait a bit more
        setTimeout(() => session.stop('test_complete'), 2000);
      } else {
        session.stop('test_complete');
      }
    }, 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
        style={{ background: 'var(--color-canvas)', color: 'var(--color-text)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Text-to-Speech Settings</h2>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-70"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Enable/Disable TTS */}
          <div className="flex items-center justify-between">
            <label className="font-medium">Enable Speech</label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleEnableToggle(e.target.checked)}
              className="w-4 h-4"
            />
          </div>

          {/* API Configuration */}
          <div className="space-y-2">
            <label className="block font-medium">
              OpenAI API Key (optional)
              <span className="text-xs text-gray-500 ml-1">- for higher quality voices</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border rounded-md text-sm"
              style={{ 
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)'
              }}
            />
            <p className="text-xs text-gray-500">
              {isOpenAIAvailable ? 
                '✓ Using OpenAI TTS (high quality)' : 
                'OpenAI TTS not available - add API key for speech'}
            </p>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="block font-medium">Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              style={{ 
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)'
              }}
            >
              <option value="">Default</option>
              {voices.map((voice, index) => (
                <option key={voice.id || index} value={voice.id || voice.voiceURI}>
                  {voice.name} {voice.description && `- ${voice.description}`}
                </option>
              ))}
            </select>
          </div>

          {/* Speech Rate */}
          <div className="space-y-2">
            <label className="block font-medium">
              Speech Rate: {rate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.25"
              max="4.0"
              step="0.1"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Test Button */}
          <button
            onClick={testTTS}
            disabled={!enabled || !isOpenAIAvailable}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
          >
            {isOpenAIAvailable ? 'Test Voice' : 'Add API Key to Enable TTS'}
          </button>

          {/* Help Text */}
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>OpenAI TTS:</strong> Requires API key, costs ~$0.015/1K characters, highest quality</p>
            <p>This app uses OpenAI TTS exclusively for the best natural voice experience.</p>
          </div>
        </div>
      </div>
    </div>
  );
}