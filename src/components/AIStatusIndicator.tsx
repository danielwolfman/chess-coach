import { useState, useEffect } from 'react';
import { SetupWizardService } from '@/services/setup-wizard';

export function AIStatusIndicator() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check API key availability
    const checkApiKey = () => {
      setHasApiKey(SetupWizardService.hasValidConfiguration());
    };

    // Initial check
    checkApiKey();

    // Listen for storage changes (when API key is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chess-coach-openai-api-key') {
        checkApiKey();
      }
    };

    // Listen for online/offline changes
    const handleOnlineChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, []);

  const getStatus = () => {
    if (!hasApiKey) {
      return {
        icon: '🤖',
        text: 'AI Offline',
        color: 'text-gray-500',
        bg: 'bg-gray-100',
        description: 'Click 🤖 AI Setup to enable AI coaching'
      };
    }
    
    if (!isOnline) {
      return {
        icon: '📡',
        text: 'AI Offline',
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        description: 'No internet connection - AI coaching unavailable'
      };
    }

    return {
      icon: '🧠',
      text: 'AI Ready',
      color: 'text-green-600',
      bg: 'bg-green-100',
      description: 'AI-powered mistake analysis available'
    };
  };

  const status = getStatus();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}
        title={status.description}
      >
        <span>{status.icon}</span>
        <span>{status.text}</span>
      </div>
    </div>
  );
}