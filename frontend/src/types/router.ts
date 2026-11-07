declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    isFullScreen?: boolean;
    hasSplashBackground?: boolean;
  }
}

declare module '@tanstack/history' {
  interface HistoryState {
    onboardingStep?: number;
    profileEditView?: 'styles';
  }
}

export {};
