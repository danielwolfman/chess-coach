/**
 * Setup wizard service to manage first-time user experience
 */
export class SetupWizardService {
  private static SETUP_COMPLETED_KEY = 'chess-coach-setup-completed';
  private static WIZARD_DISMISSED_KEY = 'chess-coach-wizard-dismissed';
  private static WELCOME_SEEN_KEY = 'chess-coach-welcome-seen';

  /**
   * Check if user needs to see the setup wizard
   */
  static shouldShowWizard(): boolean {
    // Don't show if setup is already completed
    if (localStorage.getItem(this.SETUP_COMPLETED_KEY) === 'true') {
      return false;
    }

    // Don't show if user has dismissed the wizard
    if (localStorage.getItem(this.WIZARD_DISMISSED_KEY) === 'true') {
      return false;
    }

    // Don't show if API key is already configured
    if (localStorage.getItem('chess-coach-openai-api-key')) {
      // Mark as completed if they already have a key
      this.markSetupCompleted();
      return false;
    }

    return true;
  }

  /**
   * Check if user has dismissed the wizard permanently
   */
  static isWizardDismissed(): boolean {
    return localStorage.getItem(this.WIZARD_DISMISSED_KEY) === 'true';
  }

  /**
   * Mark setup as completed
   */
  static markSetupCompleted(): void {
    localStorage.setItem(this.SETUP_COMPLETED_KEY, 'true');
    localStorage.removeItem(this.WIZARD_DISMISSED_KEY); // Clear dismissal if setup is completed
  }

  /**
   * Mark wizard as dismissed (user chose "skip for now")
   */
  static markWizardDismissed(): void {
    localStorage.setItem(this.WIZARD_DISMISSED_KEY, 'true');
  }

  /**
   * Check if user should see welcome overlay
   */
  static shouldShowWelcome(): boolean {
    return localStorage.getItem(this.WELCOME_SEEN_KEY) !== 'true';
  }

  /**
   * Mark welcome as seen
   */
  static markWelcomeSeen(): void {
    localStorage.setItem(this.WELCOME_SEEN_KEY, 'true');
  }

  /**
   * Reset setup state (for testing or if user wants to reconfigure)
   */
  static resetSetup(): void {
    localStorage.removeItem(this.SETUP_COMPLETED_KEY);
    localStorage.removeItem(this.WIZARD_DISMISSED_KEY);
    localStorage.removeItem(this.WELCOME_SEEN_KEY);
  }

  /**
   * Check if the user has a valid API key configuration
   */
  static hasValidConfiguration(): boolean {
    const apiKey = localStorage.getItem('chess-coach-openai-api-key');
    return !!(apiKey && apiKey.trim().startsWith('sk-'));
  }

  /**
   * Show setup wizard after a delay (for better UX)
   */
  static shouldShowWizardAfterDelay(): Promise<boolean> {
    return new Promise((resolve) => {
      // Wait a bit before showing wizard so user can see the main app first
      setTimeout(() => {
        resolve(this.shouldShowWizard());
      }, 2000); // 2 second delay
    });
  }

  /**
   * Get setup status for display purposes
   */
  static getSetupStatus(): {
    completed: boolean;
    dismissed: boolean;
    hasApiKey: boolean;
    shouldShow: boolean;
  } {
    return {
      completed: localStorage.getItem(this.SETUP_COMPLETED_KEY) === 'true',
      dismissed: localStorage.getItem(this.WIZARD_DISMISSED_KEY) === 'true',
      hasApiKey: !!localStorage.getItem('chess-coach-openai-api-key'),
      shouldShow: this.shouldShowWizard()
    };
  }
}

/**
 * Hook to check wizard state and trigger it at appropriate times
 */
export function useSetupWizard() {
  const showWizard = () => {
    return SetupWizardService.shouldShowWizard();
  };

  const completeSetup = () => {
    SetupWizardService.markSetupCompleted();
  };

  const dismissWizard = () => {
    SetupWizardService.markWizardDismissed();
  };

  const resetSetup = () => {
    SetupWizardService.resetSetup();
  };

  return {
    showWizard,
    completeSetup,
    dismissWizard,
    resetSetup,
    hasValidConfiguration: SetupWizardService.hasValidConfiguration(),
    setupStatus: SetupWizardService.getSetupStatus()
  };
}