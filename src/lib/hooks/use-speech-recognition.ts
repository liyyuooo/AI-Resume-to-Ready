'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  onResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const { language = 'zh-CN', continuous = false, onResult, onInterimResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const optionsRef = useRef({ onResult, onInterimResult, onError });

  useEffect(() => {
    optionsRef.current = { onResult, onInterimResult, onError };
  });

  const SpeechRecognitionConstructor = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);
  const isSupported = !!SpeechRecognitionConstructor;

  useEffect(() => {
    if (!SpeechRecognitionConstructor) {
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      const { onInterimResult: interim, onResult: result } = optionsRef.current;

      if (interimTranscript && interim) {
        interim(interimTranscript);
      }

      if (finalTranscript) {
        if (result) {
          result(finalTranscript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      optionsRef.current.onError?.(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionConstructor, language, continuous]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
