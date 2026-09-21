/**
 * STTManager — Gestion intelligente du Speech-to-Text
 * Mode offline : simulation avec feedback pédagogique
 * Mode online : Web Speech API réel
 */
export class STTManager {
  #recognition = null;
  #isSupported = false;
  #isListening = false;
  #deviceTier = 'unknown';
  #isOffline = false;
  #simulationMode = false;
  #turnCounter = 0;      // ✅ Compteur global de tours
  #currentTurnId = 0;    // ✅ ID du tour courant (protection contre callbacks tardifs)
  #lastStartAttempt = 0;
  #simulationCleanup = null; // ✅ Anti-boucle : timestamp du dernier startListening
  #simulationStream = null;
  #simulationAudioContext = null;
  #simulationAnimationFrameId = null;
  #simulationFinished = false;

  // ✅ V5.110: Fonction centralisée de décision du moteur
  getCurrentSTTMode() {
    if (!navigator.onLine) return 'SIMULATION';
    if (!this.#sttEnabled) return 'SIMULATION';
    if (!this.#isSupported) return 'SIMULATION';
    return 'WEB_API';
  }




  constructor() {
    this.#detectCapabilities();
    this.#setupNetworkListeners();
  }

  #setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.#isOffline = false;
      this.#detectCapabilities();
      console.log('[STTManager] ✅ Connexion rétablie, STT réel disponible');
    });

    window.addEventListener('offline', () => {
      this.#isOffline = true;
      this.#simulationMode = true;
      console.log('[STTManager] ⚠️ Mode offline, simulation STT activée');
    });
  }

  #detectCapabilities() {
    // ✅ FIX 1 : Déterminer l'état réseau IMMÉDIATEMENT (pas attendre l'événement)
    this.#isOffline = !navigator.onLine;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.#isSupported = !!SpeechRecognition;

    // Détection du tier appareil
    if (window.deviceCheck) {
      if (window.deviceCheck.isVeryLowEnd()) {
        this.#deviceTier = 'low';
      } else if (window.deviceCheck.isLowEnd()) {
        this.#deviceTier = 'mid';
      } else {
        this.#deviceTier = 'high';
      }
    } else {
      const ram = navigator.deviceMemory || 4;
      if (ram < 2) this.#deviceTier = 'low';
      else if (ram < 4) this.#deviceTier = 'mid';
      else this.#deviceTier = 'high';
    }

      // ✅ Règle stricte de sélection du moteur
      // Règle :
      //   1. Si !navigator.onLine → simulation FORCÉE (peu importe le toggle)
      //   2. Sinon → respecter le toggle utilisateur
      
      let engineSelected = '';
      let toggleValue = '';
      
      if (this.#isOffline) {
        // Offline = simulation OBLIGATOIRE
        this.#simulationMode = true;
        engineSelected = 'SIMULATION (offline forced)';
        toggleValue = 'ignored (offline)';
      } else {
        // Online = respecter le toggle
        // ✅ V5.60: Clé unifiée 'dagospeak:sttSettings'
        const settings = JSON.parse(localStorage.getItem('dagospeak:sttSettings') || '{}');
        const userWantsRealSTT = settings.sttEnabled !== false;
        toggleValue = userWantsRealSTT ? 'web-api' : 'simulation';
        
        if (!userWantsRealSTT || !this.#isSupported) {
          this.#simulationMode = true;
          engineSelected = userWantsRealSTT ? 'SIMULATION (not supported)' : 'SIMULATION (user toggle)';
        } else {
          this.#simulationMode = false;
          engineSelected = 'WEB_API';
        }
      }

      // ✅ Logs explicites
      console.log(`[STTManager] 🌐 Network: ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`);
      console.log(`[STTManager] ⚙️ Toggle: ${toggleValue}`);
      console.log(`[STTManager] 🎯 EngineSelected: ${engineSelected}`);
      console.log(`[STTManager] Support: ${this.#isSupported}, Tier: ${this.#deviceTier}, Offline: ${this.#isOffline}, Simulation: ${this.#simulationMode}`);
  }

  /**
   * ✅ V5.87: Re-lire les settings et mettre à jour simulationMode
   * Appelée automatiquement par startListening()
   */
  refreshSettings() {
    const rawSettings = localStorage.getItem('dagospeak:sttSettings');
    console.log(`[STTManager] 🔍 DEBUG: rawSettings =`, rawSettings);
    const settings = JSON.parse(rawSettings || '{}');
    console.log(`[STTManager] 🔍 DEBUG: parsed settings =`, settings);
    console.log(`[STTManager] 🔍 DEBUG: settings.sttEnabled =`, settings.sttEnabled, `(type: ${typeof settings.sttEnabled})`);
    
    // ✅ V5.89: Traiter undefined comme false (simulation par défaut)
    const userWantsRealSTT = settings.sttEnabled !== false && settings.sttEnabled !== undefined;
    
    if (this.#isOffline) {
      this.#simulationMode = true;
      console.log(`[STTManager] ✅ refreshSettings: offline → simulation forcée`);
    } else if (!userWantsRealSTT) {
      this.#simulationMode = true;
      console.log(`[STTManager] ✅ refreshSettings: sttEnabled=${settings.sttEnabled} → simulation`);
    } else if (!this.#isSupported) {
      this.#simulationMode = true;
      console.log(`[STTManager] ✅ refreshSettings: Web Speech non supporté → simulation`);
    } else {
      this.#simulationMode = false;
      console.log(`[STTManager] ✅ refreshSettings: sttEnabled=${settings.sttEnabled} → web-api`);
    }
  }


  /**
   * Vérifie si le STT est disponible (réel ou simulé)
   */
  isAvailable() {
    return true; // Toujours disponible (réel ou simulé)
  }

  /**
   * Vérifie si on utilise la simulation
   */
  isSimulationMode() {
    return this.#simulationMode;
  }

  /**
      // ✅ Protection anti-boucle : pas plus d'1 appel toutes les 2s
      const now = Date.now();
      if (this.#lastStartAttempt && now - this.#lastStartAttempt < 2000) {
        console.warn('[STTManager] ⚠️ startListening ignoré (anti-boucle < 2s)');
        callbacks.onError?.('rate-limited');
        return false;
      }
      this.#lastStartAttempt = now;
      
      // ✅ Incrémenter le turnId pour invalider les anciens callbacks
      this.#currentTurnId = ++this.#turnCounter;
      const turnId = this.#currentTurnId;
      
   * Retourne l'ID du tour courant (pour protection callbacks tardifs)
   */
  getCurrentTurnId() {
    return this.#currentTurnId;
  }

  /**
   * Vérifie si un turnId correspond au tour courant
   */
  isCurrentTurn(turnId) {
    return turnId === this.#currentTurnId;
  }

  /**
   * Démarre l'écoute (réelle ou simulée)
   */
     startListening(lang = 'fr-FR', callbacks = {}, expectedText = null) {
      // ✅ V5.87: Re-lire les settings AVANT chaque écoute pour respecter le toggle utilisateur
      const settings = JSON.parse(localStorage.getItem('dagospeak:sttSettings') || '{}');
      const userWantsRealSTT = settings.sttEnabled !== false;
      
      // Si online et utilisateur veut simulation → forcer simulationMode=true
      if (navigator.onLine && !userWantsRealSTT) {
        this.#simulationMode = true;
        console.log(`[STTManager] ✅ V5.87: Toggle utilisateur respecté → simulation forcée (sttEnabled=${settings.sttEnabled})`);
      // ✅ V5.87: Re-lire les settings AVANT chaque écoute
      this.refreshSettings();

      }
      
      console.log(`[STTManager] startListening appelé, isListening=${this.#isListening}, simulationMode=${this.#simulationMode}`);
      
      // ✅ FORÇAGE ABSOLU : Si offline, SIMULATION OBLIGATOIRE (override tout)
      if (!navigator.onLine) {
        this.#simulationMode = true;
        console.log('[STTManager] 🌐 OFFLINE → simulation FORCÉE');
      }
      
      // ✅ Re-log après forçage
      console.log(`[STTManager] 🎯 Mode final: simulationMode=${this.#simulationMode}`);
      // ✅ FORCER simulation si offline (override toute détection précédente)
      if (!navigator.onLine) {
        this.#simulationMode = true;
        console.log('[STTManager] 🌐 Offline détecté → simulation forcée');
      }
      
    if (this.#isListening) {
      console.warn('[STTManager] Écoute déjà active, arrêt de la précédente');
      this.stopListening();
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.startListening(lang, callbacks));
        }, 300);
      });
    }

    // ✅ Mode simulation (offline ou low-end)
    if (this.#simulationMode) {
      return this.#simulateListening(callbacks, expectedText);
    }

    // ✅ Mode réel (Web Speech API)
    return this.#startRealListening(lang, callbacks);
  }

    /**
   * Simulation d'écoute avec détection de fin de parole (VAD)
   */
  #simulateListening(callbacks, expectedText = null) {
    console.log('[STTManager] 🎭 Mode simulation avec détection de fin de parole');

    callbacks.onStart?.();
    this.#isListening = true;

    let hasStartedSpeaking = false;
    let silenceStartTime = null;
    
    // ✅ V5.59: Timeout global de sécurité (15s)
    const GLOBAL_TIMEOUT = 8000; // ✅ V5.88: Réduit de 15s à 8s pour éviter le blocage
    let globalTimeoutId = null;
    let sessionEnded = false;
    
    const endSessionWithFlag = (flag, transcript = '') => {
      if (sessionEnded) return;
      sessionEnded = true;
      
      // ✅ V5.88: Log explicite de fin de session
      console.log(`[STTManager] 🏁 Session terminée avec flag: ${flag}, transcript: "${transcript}"`);
      
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId);
        globalTimeoutId = null;
      }
      
      finishSession();
      callbacks.onResult?.({
        transcript: transcript,
        isReal: false,
        simulated: true,
        attemptDetected: flag === 'complete',
        noSpeechDetected: flag === 'noSpeech',
        incompleteAttempt: flag === 'incomplete'
      });
      callbacks.onEnd?.();
      this.#isListening = false;
    };
    
    globalTimeoutId = setTimeout(() => {
      console.warn('[STTManager] ⏱️ Timeout 8s atteint');
      if (!hasStartedSpeaking) {
        console.log('[STTManager] 🤫 Aucune parole détectée');
        endSessionWithFlag('noSpeech');
      } else {
        console.log('[STTManager] ⚠️ Tentative incomplète');
        endSessionWithFlag('incomplete');
      }
    }, GLOBAL_TIMEOUT);
    let mediaStream = null;
    let audioContext = null;
    let analyser = null;
    let animationFrameId = null;

    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      this.#stopAudioStream(mediaStream, audioContext);

      mediaStream = null;
      audioContext = null;
      analyser = null;

      if (this.#simulationCleanup === cleanup) {
        this.#simulationCleanup = null;
      }

      this.#isListening = false;

      console.log('[STTManager] 🧹 Simulation VAD nettoyée');
    };

    this.#simulationCleanup = cleanup;


    const finishSession = () => {
      if (this.#simulationFinished) return;
      this.#simulationFinished = true;
      
      console.log('[STTManager] 🧹 finishSession() - nettoyage centralisé');
      
      // Annuler l'animation frame
      if (this.#simulationAnimationFrameId !== null) {
        cancelAnimationFrame(this.#simulationAnimationFrameId);
        this.#simulationAnimationFrameId = null;
      }
      
      // Arrêter le MediaStream
      if (this.#simulationStream) {
        this.#simulationStream.getTracks().forEach(track => track.stop());
        this.#simulationStream = null;
      }
      
      // Fermer l'AudioContext
      if (this.#simulationAudioContext && this.#simulationAudioContext.state !== 'closed') {
        try {
          this.#simulationAudioContext.close();
        } catch (e) {
          console.warn('[STTManager] ⚠️ Erreur fermeture AudioContext:', e);
        }
        this.#simulationAudioContext = null;
      }
      
      this.#isListening = false;
    };

    const SILENCE_THRESHOLD = 0.01; // Seuil de silence (RMS)
    const SILENCE_DURATION = 1000; // ✅ V5.88: Réduit de 1.5s à 1s pour terminer plus vite  // 1.5s de silence = fin de parole
    const MIN_SPEECH_DURATION = 500; // Durée minimum de parole avant de considérer la fin

    // Demander l'accès au microphone
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaStream = stream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const startTime = Date.now();

    // ✅ Stocker les ressources pour cleanup centralisé
    this.#simulationStream = mediaStream;
    this.#simulationAudioContext = audioContext;
    this.#simulationFinished = false;

  // ✅ V5.110: Fonction centralisée de décision du moteur
  getCurrentSTTMode() {
    // 1. Offline forcé
    if (!navigator.onLine) return 'SIMULATION';
    
    // 2. Toggle utilisateur OFF
    if (!this.#sttEnabled) return 'SIMULATION';
    
    // 3. Pas de support Web Speech
    if (!this.#isSupported) return 'SIMULATION';
    
    // 4. Mode normal
    return 'WEB_API';
  }


          let finished = false; // ✅ Flag idempotent (AVANT checkAudio pour scope correct)
          let lastRmsLogTime = 0; // Pour log RMS périodique

        const checkAudio = () => {
            if (finished) return; // ✅ Protection contre doubles appels
          analyser.getByteFrequencyData(dataArray);
          
          // Calculer le RMS (Root Mean Square) pour détecter le volume
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength) / 255;

          const elapsed = Date.now() - startTime;

          if (rms > SILENCE_THRESHOLD) {
            // L'utilisateur parle
              // ✅ Log seulement au début de la parole (pas à chaque frame)
              if (!hasStartedSpeaking) {
                console.log('[STTManager] 🎤 Début de parole, RMS:', rms.toFixed(3));
              callbacks.onSpeechStart?.(); // ✅ Notifier app.js que parole a commencé
              }
              hasStartedSpeaking = true;
          } else if (hasStartedSpeaking) {
            // Silence après avoir parlé
            if (silenceStartTime === null) {
                console.log('[STTManager] 🤫 Silence détecté (début du chronométrage)');
              silenceStartTime = Date.now();
            } else {
              const silenceDuration = Date.now() - silenceStartTime;
              
              // Si silence assez long ET parole a duré assez longtemps
              if (silenceDuration > SILENCE_DURATION && elapsed > MIN_SPEECH_DURATION) {
                console.log('[STTManager] ✅ Fin de parole détectée après', silenceDuration, 'ms de silence');

                  // ✅ V5.59: Fin VAD - tentative complète
                  console.log('[STTManager] ✅ Tentative complète détectée');
                  endSessionWithFlag('complete');
                return;
              }
            }
          }

          // Continuer l'analyse
          animationFrameId = requestAnimationFrame(checkAudio);
        this.#simulationAnimationFrameId = animationFrameId;
        };

        checkAudio();
      })
      .catch(error => {
          console.error('[STTManager] ❌ getUserMedia FAILED');
          console.error('[STTManager] name:', error?.name);
          console.error('[STTManager] message:', error?.message);
          console.error('[STTManager] secureContext:', window.isSecureContext);
          console.error('[STTManager] mediaDevices:', !!navigator.mediaDevices);
        callbacks.onError?.('microphone-access-denied');
        this.#isListening = false;
      });

    return true;
  }

  /**
   * Arrête proprement le flux audio
   */
  #stopAudioStream(stream, audioContext) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }
  }

  /**
   * Écoute réelle (Web Speech API)
   */
  #startRealListening(lang, callbacks) {
    try {
      const turnId = this.#currentTurnId; // ✅ Capturer turnId pour ce tour
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.#recognition = new SpeechRecognition();

      this.#recognition.lang = lang;
      this.#recognition.interimResults = false;
      this.#recognition.maxAlternatives = 3;
      this.#recognition.continuous = false;

      this.#recognition.onstart = () => {
        this.#isListening = true;
        callbacks.onStart?.();
      };

             this.#recognition.onresult = (event) => {
          const results = event.results[0];
          const bestResult = results[0];
          callbacks.onResult?.({
            transcript: bestResult.transcript,
            isReal: true,
            confidence: bestResult.confidence,
            alternatives: Array.from(results).map(r => r.transcript)
          });
        };

      this.#recognition.onend = () => {
        this.#isListening = false;
        callbacks.onEnd?.();
      };

      this.#recognition.onerror = (event) => {
        this.#isListening = false;
        
        // ✅ BUG 2 FIX : Bloquer tout retry automatique après erreur critique
        if (event.error === 'network' || event.error === 'not-allowed') {
          console.warn(`[STTManager] 🛑 Erreur critique (${event.error}) - retry automatique BLOQUÉ`);
          console.log('[STTManager] Bouton 🎤 disponible - attendre action utilisateur');
        }
        
        // ✅ Protection contre les callbacks tardifs
        if (!this.isCurrentTurn(turnId)) {
          console.warn('[STTManager] ⚠️ onerror ignoré (tour obsolète)');
          return;
        }
        
        console.error('[STTManager] Erreur:', event.error);
        
        // ✅ Stop net après 'network' : pas de retry automatique
        if (event.error === 'network' || event.error === 'not-allowed') {
          console.warn('[STTManager] 🛑 Erreur critique - arrêt propre, aucun retry automatique');
          if (event.error === 'network') {
            this.#isOffline = true;
            this.#simulationMode = true;
            console.log('[STTManager] 🔄 Bascule automatique en mode simulation');
          }
        }
        
        callbacks.onError?.(event.error);
      };

      this.#recognition.start();
      return true;

    } catch (e) {
      console.error('[STTManager] Erreur démarrage:', e);
      callbacks.onError?.(e.message);
      return false;
    }
  }

  /**
   * Arrête l'écoute
   */
  stopListening() {
    // Mode Web Speech
    if (this.#recognition && this.#isListening) {
      try {
        this.#recognition.stop();
      } catch (e) {
        console.warn('[STTManager] ⚠️ Erreur arrêt Web Speech:', e);
      }
      
      this.#isListening = false;
      return;
    }
    
    // Mode simulation : cleanup centralisé
    if (this.#isListening) {
      console.log('[STTManager] 🛑 stopListening() - arrêt forcé simulation');
      
      // Annuler l'animation frame
      if (this.#simulationAnimationFrameId !== null) {
        cancelAnimationFrame(this.#simulationAnimationFrameId);
        this.#simulationAnimationFrameId = null;
      }
      
      // Arrêter le MediaStream
      if (this.#simulationStream) {
        this.#simulationStream.getTracks().forEach(track => track.stop());
        this.#simulationStream = null;
      }
      
      // Fermer l'AudioContext
      if (this.#simulationAudioContext && this.#simulationAudioContext.state !== 'closed') {
        try {
          this.#simulationAudioContext.close();
        } catch (e) {
          console.warn('[STTManager] ⚠️ Erreur fermeture AudioContext:', e);
        }
        this.#simulationAudioContext = null;
      }
      
      this.#isListening = false;
      console.log('[STTManager] ✅ Ressources simulation nettoyées');
    }
  }

  /**
   * Compare le texte reconnu avec le texte attendu
   * Mode simulation : toujours encourageant
   * Mode réel : comparaison précise
   */
  // ✅ V5.110: Retour structuré avec 3 états séparés

  // ✅ V5.110: Simulation sans micro (pour offline et appareils modestes)
  #simulateListening(options) {
    const { expected, onResult, onEnd } = options;
    setTimeout(() => {
      if (onResult) {
        onResult({
          transcript: expected || 'simulation',
          confidence: 0.95,
          isSimulation: true
        });
      }
      if (onEnd) onEnd();
    }, 1500);
    return Promise.resolve();
  }

  compareTexts(recognized, expected) {
    if (!recognized || !expected) {
      return { score: 0, isCorrect: false, feedback: 'Aucun texte reconnu' };
    }

    // ✅ Mode simulation : feedback toujours encourageant
    if (this.#simulationMode) {
      console.log('[STTManager] 💬 Simulation : feedback encourageant');
      return {
        score: 85, // Score encourageant
        isCorrect: true, // Toujours "correct" en simulation
        feedback: 'Bien prononcé ! Continuez ainsi.',
        isSimulation: true
      };
    }

    // ✅ Mode réel : comparaison précise
    const norm = (text) => text.toLowerCase().trim().replace(/[.,!?]/g, '');
    const rec = norm(recognized);
    const exp = norm(expected);

    // ✅ V5.85: Logique intelligente pour l'alphabet
    // Cas 1: L'attendu est juste une lettre (ex: "A" ou "a")
    if (/^[a-z]$/.test(exp)) {
      if (rec.includes(exp)) {
        console.log(`[STT] ✅ Lettre simple détectée: '${exp}' dans "${rec}"`);
        return { score: 100, isCorrect: true, feedback: 'Parfait !', isSimulation: false };
      }
    }
    
    // Cas 2: L'attendu contient "comme dans X" (ex: "a comme dans anana")
    const commeDansMatch = exp.match(/^([a-z])\s+comme\s+dans\s+/i);
    if (commeDansMatch) {
      const expectedLetter = commeDansMatch[1].toLowerCase();
      
      // Vérifier si la lettre est présente dans le texte reconnu
      if (rec.includes(expectedLetter)) {
        console.log(`[STT] ✅ Lettre détectée: '${expectedLetter}' trouvée dans "${rec}"`);
        return { 
          score: 100, 
          isCorrect: true, 
          feedback: `Parfait ! Lettre ${expectedLetter.toUpperCase()} reconnue.`, 
          isSimulation: false 
        };
      }

    // ✅ V5.86: Cas 3 - Listes de lettres (ex: "a b c", "a e i o")
    const multiLetterMatch = exp.match(/^([a-z](?:\s+[a-z])*)$/);
    if (multiLetterMatch) {
      const expectedLetters = exp.split(/\s+/).filter(l => /^[a-z]$/.test(l));
      if (expectedLetters.length > 0) {
        const foundLetters = expectedLetters.filter(letter => rec.includes(letter));
        const matchRatio = foundLetters.length / expectedLetters.length;
        console.log(`[STT] Liste: ${foundLetters.length}/${expectedLetters.length} trouvées`);
        if (matchRatio >= 0.5) {
          return {
            score: Math.round(matchRatio * 100),
            isCorrect: true,
            feedback: `Bien ! ${foundLetters.length}/${expectedLetters.length} lettres reconnues.`,
            isSimulation: false
          };
        }
      }
    }

    }


    // ✅ V5.84: Cas spéciaux pour les lettres de l'alphabet
    // Si l'attendu est juste une lettre, accepter toute réponse contenant cette lettre
    if (/^[a-z]$/.test(exp)) {
      if (rec.includes(exp) || rec.includes(exp.toUpperCase())) {
        console.log(`[STT] Lettre détectée: ${exp} dans "${rec}"`);
        return { score: 100, isCorrect: true, feedback: 'Parfait !', isSimulation: false };
      }
    }
    
    // Si l'attendu contient "comme dans", accepter la lettre seule OU la phrase complète
    if (exp.includes('comme dans')) {
      const firstLetter = exp.trim().charAt(0).toLowerCase();
      if (rec === firstLetter || rec === firstLetter.toUpperCase()) {
        console.log(`[STT] Lettre seule acceptée: ${firstLetter}`);
        return { score: 100, isCorrect: true, feedback: 'Parfait !', isSimulation: false };
      }
      if (rec.includes(firstLetter) && (rec.includes('comme') || rec.includes('dans'))) {
        console.log(`[STT] Phrase complète acceptée`);
        return { score: 100, isCorrect: true, feedback: 'Excellent !', isSimulation: false };
      }
    }


    if (rec === exp) {
      return { score: 100, isCorrect: true, feedback: 'Parfait !' };
    }

    const words1 = rec.split(' ');
    const words2 = exp.split(' ');

    const common = words1.filter(w => words2.includes(w)).length;
    const baseScore = Math.round((common / Math.max(words1.length, words2.length)) * 100);

    const keywords = ['bonjour', 'merci', 'je', 'tu', 'il', 'elle', 'nous', 'vous',
                      'appelle', 'mange', 'achète', 'veux', 'suis', 'es', 'est',
                      'rouge', 'bleu', 'vert', 'jaune', 'blanc', 'noir'];

    const keywordMatches = keywords.filter(k => rec.includes(k) && exp.includes(k)).length;
    const bonus = keywordMatches * 10;

    const score = Math.min(100, baseScore + bonus);
    const isCorrect = score >= 40; // ✅ V5.84: Réduit de 60 à 40 pour être plus permissif

    const feedback = isCorrect 
      ? 'Très bien !' 
      : (score >= 30 ? 'Presque ! Essaie encore' : 'Utilise les boutons ci-dessous');

    console.log(`[STT] Comparaison: rec="${rec}", exp="${exp}", score=${score}%`);

    return { score, isCorrect, feedback, isSimulation: false };
  }

  /**
   * Retourne le tier de l'appareil
   */
  getTier() {
    return this.#deviceTier;
  }


  /**
   * Vérifie si on est en mode simulation
   */
  isSimulationMode() {
    return this.#simulationMode;
  }

}

export const sttManager = new STTManager();