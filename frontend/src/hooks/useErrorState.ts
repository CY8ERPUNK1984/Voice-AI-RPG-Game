import { useState, useEffect } from 'react';
import { ErrorState } from '../types';
import { errorHandler } from '../services/ErrorHandler';

export function useErrorState() {
  const [errorState, setErrorState] = useState<ErrorState>({
    asrError: null,
    llmError: null,
    ttsError: null,
    connectionError: null,
  });

  useEffect(() => {
    const unsubscribe = errorHandler.onError(() => {
      setErrorState(errorHandler.getErrorState());
    });

    return unsubscribe;
  }, []);

  return errorState;
}