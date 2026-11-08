/**
 * Moduł dyktafonu / Speech-to-Text korzystający z Web Speech API (iOS Safari / Android Chrome)
 */

export class VoiceDictation {
  constructor({ onResult, onStart, onEnd, onError }) {
    this.onResult = onResult || (() => {});
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onError = onError || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Dyktafon] Web Speech API nie jest wspierane w tej przeglądarce.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pl-PL';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStart();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = (finalTranscript || interimTranscript).trim();
      if (text) {
        this.onResult(text, Boolean(finalTranscript));
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('[Dyktafon] Błąd rozpoznawania mowy:', event.error);
      this.onError(event.error);
      this.isListening = false;
      this.onEnd();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onEnd();
    };
  }

  isSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start() {
    if (!this.recognition) {
      this.onError('Brak wsparcia dla rozpoznawania mowy w Twojej przeglądarce.');
      return;
    }

    try {
      this.recognition.start();
    } catch (e) {
      // Jeśli już był uruchomiony
      console.warn('Speech recognition start error:', e);
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}

