// High quality procedural Web Audio API audio and music synthesizer
export default class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;

    // Volume levels (0.0 to 1.0)
    this.masterVolume = parseFloat(localStorage.getItem('valheim_vol_master') || '0.8');
    this.musicVolume = parseFloat(localStorage.getItem('valheim_vol_music') || '0.65');
    this.sfxVolume = parseFloat(localStorage.getItem('valheim_vol_sfx') || '0.85');
    this.ambientVolume = parseFloat(localStorage.getItem('valheim_vol_ambient') || '0.7');

    // Gain nodes
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambientGain = null;

    // Music playback state
    this.currentBiome = null;
    this.musicTimer = 0;
    this.phraseTimer = 0;
    this.chordStep = 0;
    this.isMusicStarted = false;

    // Ambient wind/nature
    this.ambientNoiseNode = null;
    this.ambientFilterNode = null;

    // Boss battle intense combat music state
    this.isBossMusicActive = false;
    this.bossMusicTimer = 0;
    this.bossBeatTimer = 0;
    this.bossStep = 0;
    this.activeBossDef = null;

    // Hardstyle boss battle tracks provided by user
    this.bossAudioTracks = {
      forestBeast: '/assets/audio/boss_track_1.mp3',
      swampLord: '/assets/audio/boss_track_2.mp3',
      ancientWraith: '/assets/audio/boss_track_3.mp3',
      mountainGolem: '/assets/audio/boss_track_1.mp3',
      runicDragon: '/assets/audio/boss_track_2.mp3',
    };
    this.bossVolumeMultiplier = 0.65; // Balanced boss battle music volume so sound effects & combat are clean
    this.currentBossAudio = null;
    this.bossAudioFadeInterval = null;

    // Mobile-friendly Lazy AudioContext initialization on first user interaction (iOS Safari compliant)
    this._audioUnlocked = false;
    const unlockAudio = () => {
      this.ensureContext();
      if (this._audioUnlocked) {
        window.removeEventListener('pointerup', unlockAudio);
        window.removeEventListener('touchend', unlockAudio);
        window.removeEventListener('click', unlockAudio);
      }
    };
    window.addEventListener('pointerup', unlockAudio, { passive: true });
    window.addEventListener('touchend', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
  }

  initAudioContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        this.ctx = new AudioContextClass();
        this._setupGainRouting();
      } catch (e) {
        console.warn('AudioContext creation notice:', e);
      }
    }
  }

  _setupGainRouting() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, t);
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume * 0.45, t);
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, t);
    this.sfxGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    // Reduced from 0.25 to 0.035 to eliminate the loud humming drone completely
    this.ambientGain.gain.setValueAtTime(this.ambientVolume * 0.035, t);
    this.ambientGain.connect(this.masterGain);

    this.sharedNoiseBuffer = null;
    this._startGentleAmbient();
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this._playSilentUnlockBuffer();
        }).catch(() => {});
      } else if (!this._audioUnlocked) {
        this._playSilentUnlockBuffer();
      }
    }
  }

  _playSilentUnlockBuffer() {
    if (!this.ctx || this._audioUnlocked) return;
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
      this._audioUnlocked = true;
    } catch (e) {}
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('valheim_vol_master', this.masterVolume.toFixed(2));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
    if (this.currentBossAudio) {
      this.currentBossAudio.volume = Math.max(0, Math.min(1, this.masterVolume * this.musicVolume * this.bossVolumeMultiplier));
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('valheim_vol_music', this.musicVolume.toFixed(2));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.45, this.ctx.currentTime, 0.05);
    }
    if (this.currentBossAudio) {
      this.currentBossAudio.volume = Math.max(0, Math.min(1, this.masterVolume * this.musicVolume * this.bossVolumeMultiplier));
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('valheim_vol_sfx', this.sfxVolume.toFixed(2));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setAmbientVolume(val) {
    this.ambientVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('valheim_vol_ambient', this.ambientVolume.toFixed(2));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume * 0.035, this.ctx.currentTime, 0.05);
    }
  }

  // Soft continuous natural wind layer with gentle low-pass pink noise (hum-free)
  _startGentleAmbient() {
    if (!this.ctx || !this.ambientGain || this.ambientNoiseNode) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.08;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // Low cut-off frequency 140Hz eliminates the mid-range hum entirely
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);
      this.ambientFilterNode = filter;

      whiteNoise.connect(filter);
      filter.connect(this.ambientGain);
      whiteNoise.start(0);
      this.ambientNoiseNode = whiteNoise;
    } catch (e) {
      console.warn('Ambient wind init notice:', e);
    }
  }

  startBossMusic(bossDef = null) {
    this.ensureContext();
    if (this.isBossMusicActive) return;
    this.isBossMusicActive = true;
    this.activeBossDef = bossDef;
    this.bossMusicTimer = 0;
    this.bossBeatTimer = 0;
    this.bossStep = 0;

    // Determine boss track
    let trackUrl = '/assets/audio/boss_track_1.mp3';
    const bossId = (bossDef && (bossDef.id || bossDef.type)) ? (bossDef.id || bossDef.type) : 'forestBeast';
    if (this.bossAudioTracks[bossId]) {
      trackUrl = this.bossAudioTracks[bossId];
    } else if (bossId.toLowerCase().includes('swamp') || bossId.toLowerCase().includes('lord') || bossId.toLowerCase().includes('dragon')) {
      trackUrl = '/assets/audio/boss_track_2.mp3';
    } else if (bossId.toLowerCase().includes('wraith') || bossId.toLowerCase().includes('aave')) {
      trackUrl = '/assets/audio/boss_track_3.mp3';
    }

    try {
      if (this.bossAudioFadeInterval) {
        clearInterval(this.bossAudioFadeInterval);
        this.bossAudioFadeInterval = null;
      }

      if (this.currentBossAudio) {
        this.currentBossAudio.pause();
        this.currentBossAudio.currentTime = 0;
      }

      const audio = new Audio(trackUrl);
      audio.loop = true;
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * this.musicVolume * this.bossVolumeMultiplier));
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.currentBossAudio = audio;
          // Mute procedural synth music so the uploaded high-energy hardstyle track plays clean
          if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
          }
        }).catch((err) => {
          console.warn('[AudioManager] Boss audio track autoplay notice (fallback to procedural synth):', err);
          this.currentBossAudio = null;
          if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.55, this.ctx.currentTime, 0.3);
          }
        });
      }
    } catch (err) {
      console.warn('[AudioManager] Failed to load boss audio track, using fallback synth:', err);
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.55, this.ctx.currentTime, 0.3);
      }
    }
  }

  stopBossMusic() {
    if (!this.isBossMusicActive) return;
    this.isBossMusicActive = false;
    this.activeBossDef = null;
    this.musicTimer = 2.0; // Resume ambient music peacefully

    // Fade out boss audio track smoothly and promptly over ~0.4s
    if (this.currentBossAudio) {
      const audioToStop = this.currentBossAudio;
      this.currentBossAudio = null;
      let fadeVol = audioToStop.volume;
      if (this.bossAudioFadeInterval) clearInterval(this.bossAudioFadeInterval);
      this.bossAudioFadeInterval = setInterval(() => {
        fadeVol -= 0.18;
        if (fadeVol <= 0.04) {
          clearInterval(this.bossAudioFadeInterval);
          this.bossAudioFadeInterval = null;
          try {
            audioToStop.pause();
            audioToStop.currentTime = 0;
          } catch (e) {}
        } else {
          audioToStop.volume = Math.max(0, fadeVol);
        }
      }, 50);
    }

    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.45, this.ctx.currentTime, 0.8);
    }
  }

  /**
   * Updates dynamic procedural background music.
   * Shifts to intense, driving war-drums and heavy brass orchestration when boss is engaged!
   */
  updateBiomeMusic(biomeKey = 'meadows', delta = 0.016) {
    this.ensureContext();
    if (!this.ctx || this.musicVolume <= 0.01) return;

    if (this.isBossMusicActive) {
      this._updateBossMusic(delta);
      return;
    }

    if (this.currentBiome !== biomeKey) {
      this.currentBiome = biomeKey;
      this.chordStep = 0;
      this.musicTimer = 0;
      this.phraseTimer = 1.0; // Play initial motif soon after biome change
    }

    // 1. Chord Progression Layer (plays warm sustained orchestral pad chords every 6 seconds)
    this.musicTimer += delta;
    if (this.musicTimer >= 6.0) {
      this.musicTimer = 0;
      this._playBiomeChord(this.currentBiome || 'meadows');
      this.chordStep = (this.chordStep + 1) % 4;
    }

    // 2. Melodic Motifs (plucked harp / kantele / wooden flute phrases)
    this.phraseTimer += delta;
    if (this.phraseTimer >= 3.6) {
      this.phraseTimer = Math.random() * -1.5; // slight random pause between phrases
      this._playBiomeMelody(this.currentBiome || 'meadows');
    }
  }

  // --- Dynamic Hardstyle Boss Battle Engine (152 BPM Aggressive Hardstyle) ---
  _makeDistortionCurve(amount = 28) {
    const k = typeof amount === 'number' ? amount : 28;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  _updateBossMusic(delta) {
    if (!this.ctx || !this.musicGain) return;
    // If uploaded high-energy audio track is playing, skip procedural synthesizer
    if (this.currentBossAudio && !this.currentBossAudio.paused) return;

    // 152 BPM Fast-tempo Hardstyle (0.3947s per beat, 0.0987s per 16th note)
    const stepDuration = 0.0987;
    this.bossBeatTimer += delta;

    while (this.bossBeatTimer >= stepDuration) {
      this.bossBeatTimer -= stepDuration;
      const step = this.bossStep % 16; // 16th-note measure
      const bossType = this.activeBossDef ? this.activeBossDef.type : 'beast';

      // 1. Hardstyle 909 Distorted Kick on every quarter beat (steps 0, 4, 8, 12)
      if (step % 4 === 0) {
        this._playHardstyleKick();
      }

      // 2. Rolling Distorted Reverse Bass on the 16th-note off-beats (steps 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15)
      if (step % 4 !== 0) {
        this._playHardstyleOffbeatBass(step, bossType);
      }

      // 3. Screech Saw Lead Synth (Aggressive Minor Hardstyle Riffs)
      this._playHardstyleScreech(this.bossStep, bossType);

      // 4. Hardstyle Percussion (Off-beat open hats and snappy claps on beats 2 & 4)
      this._playHardstylePercussion(step);

      this.bossStep++;
    }
  }

  _playHardstyleKick() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // 1. Pitch-bent 909 sub punch (750Hz dropping exponentially to 52Hz)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.035);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.16);

    gain.gain.setValueAtTime(0.48, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    // Hard distortion waveshaper for raw hardstyle crunch
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._makeDistortionCurve(22);
    shaper.oversample = '2x';

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, t);

    osc.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.3);

    // 2. Click transient punch
    const click = this.ctx.createOscillator();
    const clickG = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1200, t);
    click.frequency.exponentialRampToValueAtTime(120, t + 0.02);
    clickG.gain.setValueAtTime(0.35, t);
    clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    click.connect(clickG);
    clickG.connect(this.musicGain);
    click.start(t);
    click.stop(t + 0.03);
  }

  _playHardstyleOffbeatBass(step, bossType) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Bass root notes per boss archetype (D, C, B, E, A minor scales)
    const roots = {
      beast:  [73.42, 82.41, 73.42, 65.41], // D minor / E / C
      wyrm:   [65.41, 77.78, 65.41, 58.27], // C minor / Eb / Bb
      golem:  [61.74, 69.30, 61.74, 55.00], // B minor / D / A
      wraith: [82.41, 98.00, 82.41, 73.42], // E minor / G / D
      dragon: [55.00, 65.41, 55.00, 49.00]  // A minor / C / G
    };
    const seq = roots[bossType] || roots.beast;
    const freq = seq[Math.floor(this.bossStep / 16) % seq.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    // Resonant bandpass filter sweeping on off-beats for classic reverse-bass suck
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4.2, t);
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(750, t + 0.075);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._makeDistortionCurve(16);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.095);
  }

  _playHardstyleScreech(globalStep, bossType) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Fast 16th-note screaming Hardstyle synth melodies
    const scaleMap = {
      beast:  [293.66, 329.63, 349.23, 392.00, 440.00, 523.25, 587.33], // D minor
      wyrm:   [261.63, 293.66, 311.13, 349.23, 392.00, 466.16, 523.25], // C minor
      golem:  [246.94, 277.18, 293.66, 329.63, 369.99, 440.00, 493.88], // B minor
      wraith: [329.63, 369.99, 392.00, 440.00, 493.88, 587.33, 659.25], // E minor
      dragon: [220.00, 246.94, 261.63, 293.66, 329.63, 392.00, 440.00]  // A minor
    };
    const scale = scaleMap[bossType] || scaleMap.beast;
    // Energetic melodic pattern indexed by globalStep
    const notePattern = [0, 2, 4, 2, 0, 5, 4, 3, 0, 4, 6, 5, 4, 2, 1, 0];
    const noteIdx = notePattern[globalStep % notePattern.length];
    const freq = scale[noteIdx % scale.length];

    // Dual detuned screech oscillators
    [-14, 14].forEach(detune => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(detune, t);

      // Pitch glide transient
      osc.frequency.linearRampToValueAtTime(freq * 1.02, t + 0.04);
      osc.frequency.linearRampToValueAtTime(freq, t + 0.08);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(5.5, t);
      filter.frequency.setValueAtTime(freq * 1.8, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  _playHardstylePercussion(step) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Off-beat open hi-hat (steps 2, 6, 10, 14)
    if (step % 4 === 2) {
      this._playSurfaceNoise(0.065, 0.22, 6500, 1.2);
    }

    // Snappy Clap on beats 2 and 4 (steps 4 and 12)
    if (step === 4 || step === 12) {
      [0, 0.012, 0.024].forEach((offset, idx) => {
        const dur = (idx === 2) ? 0.09 : 0.02;
        const vol = (idx === 2) ? 0.28 : 0.14;
        setTimeout(() => {
          this._playSurfaceNoise(dur, vol, 1400, 1.6);
        }, offset * 1000);
      });
    }
  }

  playBossDefeatedFanfare() {
    this.stopBossMusic();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [220.0, 277.18, 329.63, 440.0, 554.37];
    notes.forEach((freq, i) => {
      const start = t + i * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 1.65);
    });
  }

  // Plays a warm, lush, soft sustained triad/seventh chord with gradual attack and release
  _playBiomeChord(biome) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Chord definitions per biome
    const chordProg = {
      meadows: [
        [146.83, 220.0, 293.66, 369.99], // D maj (D3, A3, D4, F#4) - pastoral warmth
        [196.0, 246.94, 293.66, 392.0],  // G maj (G3, B3, D4, G4)
        [220.0, 261.63, 329.63, 440.0],  // A sus/min (A3, C4, E4, A4)
        [164.81, 196.0, 246.94, 329.63]  // E min (E3, G3, B3, E4)
      ],
      blackForest: [
        [164.81, 246.94, 329.63, 392.0], // E min7 (mysterious ancient pines)
        [130.81, 196.0, 261.63, 329.63], // C maj7
        [146.83, 220.0, 293.66, 349.23], // D min
        [123.47, 185.0, 246.94, 329.63]  // B min
      ],
      swamp: [
        [116.54, 174.61, 233.08, 277.18], // Bb dim/m
        [110.0, 164.81, 220.0, 261.63],   // A min
        [98.0, 146.83, 196.0, 233.08],    // G min
        [123.47, 164.81, 220.0, 246.94]   // E min / B
      ],
      mountain: [
        [185.0, 277.18, 369.99, 554.37], // F# open 5ths (crystalline cold heights)
        [164.81, 246.94, 329.63, 493.88], // E min add9
        [220.0, 277.18, 440.0, 554.37],   // A maj
        [146.83, 220.0, 293.66, 440.0]    // D sus
      ],
      runePlains: [
        [220.0, 329.63, 440.0, 554.37], // A maj (golden sacred aura)
        [196.0, 293.66, 392.0, 493.88], // G maj9
        [164.81, 246.94, 329.63, 392.0], // E min7
        [174.61, 261.63, 349.23, 440.0]  // F maj7
      ],
      ashlands: [
        [130.81, 196.0, 261.63, 311.13], // C min (dark apocalyptic brass tone)
        [116.54, 174.61, 233.08, 277.18], // Bb min
        [103.83, 155.56, 207.65, 261.63], // Ab maj
        [98.0, 146.83, 196.0, 293.66]    // G power chord
      ]
    };

    const chords = chordProg[biome] || chordProg.meadows;
    const chordNotes = chords[this.chordStep % chords.length];

    const chordMasterGain = this.ctx.createGain();
    chordMasterGain.gain.setValueAtTime(0.0001, t);
    // Soft swell: 1.5s attack, 2.8s sustain, 2.0s fadeout
    chordMasterGain.gain.linearRampToValueAtTime(0.09, t + 1.6);
    chordMasterGain.gain.exponentialRampToValueAtTime(0.0001, t + 6.2);
    chordMasterGain.connect(this.musicGain);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(biome === 'ashlands' ? 450 : 850, t);
    filter.connect(chordMasterGain);

    chordNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = (idx === 0) ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      // Subtle pitch detuning for warm ensemble chorus effect
      osc.detune.setValueAtTime((idx % 2 === 0 ? 3.5 : -3.5), t);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 6.4);
    });
  }

  // Plays a beautiful, acoustic plucked harp / kantele or wooden flute phrase
  _playBiomeMelody(biome) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    const scales = {
      meadows: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25], // D pentatonic / major
      blackForest: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0], // E minor / Dorian
      swamp: [233.08, 261.63, 277.18, 311.13, 349.23, 415.30],           // Diminished / harmonic
      mountain: [369.99, 440.0, 493.88, 554.37, 659.25, 739.99],         // F# minor pentatonic
      runePlains: [277.18, 329.63, 440.0, 493.88, 554.37, 659.25],       // A major / Lydian
      ashlands: [196.0, 207.65, 246.94, 293.66, 311.13, 392.0]           // Phrygian dominant
    };

    const notes = scales[biome] || scales.meadows;
    const phraseLength = Math.floor(Math.random() * 3) + 3; // 3 to 5 notes
    const noteSpacing = 0.32;

    for (let i = 0; i < phraseLength; i++) {
      const noteTime = t + i * noteSpacing + Math.random() * 0.05;
      const freq = notes[Math.floor(Math.random() * notes.length)];
      this._playAcousticPluck(freq, noteTime, biome === 'swamp' ? 0.06 : 0.09);
    }
  }

  // Plucked string acoustic synthesis (Kantele / Harp)
  _playAcousticPluck(freq, startTime, vol = 0.08) {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime); // 1st harmonic chime

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, startTime);
    filter.frequency.exponentialRampToValueAtTime(400, startTime + 1.2);

    // Fast acoustic pluck attack (0.005s) with long natural exponential ring (1.4s)
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.4);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(startTime + 1.5);
    osc2.stop(startTime + 1.5);
  }

  // --- Sound Effects (SFX) ---

  // --- Footsteps (Kävely & Juokseminen) ---
  playFootstep(isSprinting = false, surface = 'grass') {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Organic left/right step pitch jitter
    this._stepCounter = (this._stepCounter || 0) + 1;
    const jitter = this._stepCounter % 2 === 0 ? 1.04 : 0.96;

    // 1. Low heel/foot contact transient
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = isSprinting ? 95 * jitter : 78 * jitter;
    const dur = isSprinting ? 0.055 : 0.042;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + dur);

    // Gentle, subtle footsteps ("hennot äänet")
    const heelVol = isSprinting ? 0.07 : 0.035;
    gain.gain.setValueAtTime(heelVol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);

    // 2. Surface material crunch / scuff (soft rustle)
    let filterFreq = 1100;
    let filterQ = 0.8;
    let noiseDur = isSprinting ? 0.055 : 0.040;
    let noiseVol = isSprinting ? 0.06 : 0.03;

    if (surface === 'stone') {
      filterFreq = 2600;
      filterQ = 2.2;
      noiseVol *= 1.2;
    } else if (surface === 'dirt' || surface === 'ash') {
      filterFreq = 850;
      filterQ = 0.9;
    } else if (surface === 'mud') {
      filterFreq = 480;
      filterQ = 1.6;
    } else if (surface === 'wood') {
      filterFreq = 580;
      filterQ = 2.0;
    }

    this._playSurfaceNoise(noiseDur, noiseVol, filterFreq, filterQ);
  }

  playLand(surface = 'grass') {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Heavy body ground landing impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);

    this._playSurfaceNoise(0.12, 0.35, surface === 'stone' ? 2400 : 1000, 1.2);
  }

  _playSurfaceNoise(duration, vol, freq, q = 1.0) {
    if (!this.ctx || !this.sfxGain) return;
    try {
      const bufSize = Math.floor(this.ctx.sampleRate * duration);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.4);
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(freq, this.ctx.currentTime);
      filt.Q.setValueAtTime(q, this.ctx.currentTime);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, this.ctx.currentTime);

      src.connect(filt);
      filt.connect(g);
      g.connect(this.sfxGain);
      src.start();
    } catch (e) {}
  }

  playChop() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Heavy wooden tree trunk thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    gain.gain.setValueAtTime(0.52, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // 2. Sharp axe blade bite click
    const click = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    click.type = 'sawtooth';
    click.frequency.setValueAtTime(2600, t);
    cGain.gain.setValueAtTime(0.25, t);
    cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    click.connect(cGain);
    cGain.connect(this.sfxGain);
    click.start(t);
    click.stop(t + 0.04);

    // 3. Wood fiber splinter crunch
    this._playSurfaceNoise(0.08, 0.32, 1100, 1.2);
  }

  playMine() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Solid stone impact thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);

    // 2. Harmonic ringing metallic pickaxe ping (920Hz & 1380Hz)
    [920, 1380].forEach((freq, idx) => {
      const ping = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(freq, t);
      pGain.gain.setValueAtTime(0.28 / (idx + 1), t);
      pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      ping.connect(pGain);
      pGain.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.20);
    });

    // 3. Stone fracture crackle
    this._playSurfaceNoise(0.09, 0.34, 2400, 2.0);
  }

  playHarvest(type = 'tree') {
    if (type === 'tree') this.playChop();
    else if (type === 'stone') this.playMine();
    else {
      // Bush rustle
      this._playSurfaceNoise(0.12, 0.25, 1200, 1.0);
    }
  }

  playTreeCrash() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Heavy ground impact boom
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'triangle';
    boom.frequency.setValueAtTime(85, t);
    boom.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    boomGain.gain.setValueAtTime(this.sfxVolume * 0.95, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    boom.connect(boomGain);
    boomGain.connect(this.sfxGain);
    boom.start(t);
    boom.stop(t + 0.56);

    // 2. Wood creak & fracture snaps
    [320, 640, 920].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.28);
      g.gain.setValueAtTime(this.sfxVolume * 0.35, t + idx * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t + idx * 0.04);
      osc.stop(t + 0.35);
    });

    // 3. Foliage & branch rustle crash
    this._playSurfaceNoise(0.45, 0.55, 950, 1.4);
  }

  playRockShatter() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. High energy stone crack transient
    const crack = this.ctx.createOscillator();
    const crackG = this.ctx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(2400, t);
    crack.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    crackG.gain.setValueAtTime(this.sfxVolume * 0.85, t);
    crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    crack.connect(crackG);
    crackG.connect(this.sfxGain);
    crack.start(t);
    crack.stop(t + 0.13);

    // 2. Heavy crumbling low rumble
    const rumble = this.ctx.createOscillator();
    const rumbleG = this.ctx.createGain();
    rumble.type = 'triangle';
    rumble.frequency.setValueAtTime(140, t);
    rumble.frequency.exponentialRampToValueAtTime(45, t + 0.38);
    rumbleG.gain.setValueAtTime(this.sfxVolume * 0.7, t);
    rumbleG.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    rumble.connect(rumbleG);
    rumbleG.connect(this.sfxGain);
    rumble.start(t);
    rumble.stop(t + 0.43);

    // 3. Shingle & pebble clatter debris
    this._playSurfaceNoise(0.35, 0.45, 2600, 1.2);
  }

  _playQuickNoise(duration = 0.1, vol = 0.2, filterFreq = 1000) {
    this._playSurfaceNoise(duration, vol, filterFreq, 1.0);
  }

  playAttack(weaponType = 'sword') {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const w = (weaponType || '').toLowerCase();
    let sweepStart = 1100, sweepPeak = 2600, sweepEnd = 650;
    let dur = 0.16, vol = 0.35;

    if (w.includes('axe') || w.includes('club') || w.includes('hammer')) {
      sweepStart = 380; sweepPeak = 950; sweepEnd = 220;
      dur = 0.22; vol = 0.42;

      // Heavy weapon sub-bass air displacement
      const sub = this.ctx.createOscillator();
      const subG = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110, t);
      sub.frequency.exponentialRampToValueAtTime(45, t + dur);
      subG.gain.setValueAtTime(0.3, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + dur);
      sub.connect(subG);
      subG.connect(this.sfxGain);
      sub.start(t);
      sub.stop(t + dur + 0.02);
    } else if (w.includes('spear')) {
      sweepStart = 1600; sweepPeak = 2200; sweepEnd = 700;
      dur = 0.13; vol = 0.32;
    } else if (w.includes('hand') || w.includes('fist')) {
      sweepStart = 600; sweepPeak = 1100; sweepEnd = 280;
      dur = 0.11; vol = 0.26;
    }

    try {
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        const env = Math.sin((i / bufSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.setValueAtTime(2.2, t);
      filt.frequency.setValueAtTime(sweepStart, t);
      filt.frequency.linearRampToValueAtTime(sweepPeak, t + dur * 0.45);
      filt.frequency.exponentialRampToValueAtTime(sweepEnd, t + dur);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.sfxGain);
      src.start(t);
    } catch (e) {}
  }

  playHit(targetType = 'flesh') {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Visceral low impact thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.13);
    gain.gain.setValueAtTime(0.48, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // 2. Flesh impact slap / crackle
    this._playSurfaceNoise(0.06, 0.38, 1350, 1.5);

    // 3. If armored/boss, add high metallic ping
    if (targetType === 'boss' || targetType === 'armor') {
      const ping = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(1050, t);
      pGain.gain.setValueAtTime(0.22, t);
      pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      ping.connect(pGain);
      pGain.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.16);
    }
  }

  playHurt() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.24);
    gain.gain.setValueAtTime(0.48, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playJump() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.14);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playEat() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    // Chewing sound
    this._playQuickNoise(0.08, 0.3, 800);
    setTimeout(() => this._playQuickNoise(0.09, 0.35, 750), 100);
    setTimeout(() => this._playQuickNoise(0.07, 0.28, 700), 220);
  }

  playDrink() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Water gulps
    [0, 0.18, 0.36].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + offset;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 + idx * 40, st);
      osc.frequency.exponentialRampToValueAtTime(180, st + 0.12);
      gain.gain.setValueAtTime(0.28, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + 0.14);
    });
  }

  playRest() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Calming celestial arpeggio
    [261.63, 329.63, 392.0, 523.25, 659.25].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + i * 0.14;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.22, st + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 1.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + 1.3);
    });
  }

  playLevelUp() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      // Glorious triumphant fanfare
      const chords = [
        { notes: [261.63, 329.63, 392.0], time: 0 },
        { notes: [293.66, 369.99, 440.0], time: 0.18 },
        { notes: [329.63, 392.0, 493.88], time: 0.36 },
        { notes: [523.25, 659.25, 783.99, 1046.5], time: 0.58 }
      ];
      chords.forEach(c => {
        c.notes.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const st = t + c.time;
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, st);
          const dur = (c.time > 0.5) ? 1.6 : 0.22;
          gain.gain.setValueAtTime(0.001, st);
          gain.gain.linearRampToValueAtTime(0.25, st + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, st + dur);
          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(st);
          osc.stop(st + dur + 0.1);
        });
      });
    } catch (e) {
      console.warn('Level up sound safely caught:', e);
    }
  }

  playBowShot() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Bow string twang / release
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
    this._playQuickNoise(0.07, 0.2, 2200);
  }

  playArrowHit() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Arrow thunk
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playSpell(type = 'bolt') {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    if (type === 'fireball') {
      // Fire whoosh and explosion
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.linearRampToValueAtTime(280, t + 0.15);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.45);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.48);
      this._playQuickNoise(0.35, 0.4, 550);
    } else if (type === 'frost') {
      // Shimmering freeze
      [587.33, 739.99, 880.0, 1174.66].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const st = t + i * 0.06;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, st);
        gain.gain.setValueAtTime(0.2, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(st);
        osc.stop(st + 0.55);
      });
    } else if (type === 'lightning') {
      // Sharp crackle
      this._playQuickNoise(0.25, 0.45, 2800);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.2);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.22);
    } else {
      // --- Realistic Wand & Magic Staff Arcane Blast Synthesis ---
      // 1. Deep plasma sub punch transient (380Hz -> 52Hz)
      const sub = this.ctx.createOscillator();
      const subG = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(380, t);
      sub.frequency.exponentialRampToValueAtTime(52, t + 0.22);
      subG.gain.setValueAtTime(0.42, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      sub.connect(subG);
      subG.connect(this.sfxGain);
      sub.start(t);
      sub.stop(t + 0.24);

      // 2. High-resonance plasma energy sweep (bandpass 2600Hz -> 380Hz, Q: 5.0)
      const blast = this.ctx.createOscillator();
      const blastG = this.ctx.createGain();
      blast.type = 'sawtooth';
      blast.frequency.setValueAtTime(440, t);
      blast.frequency.linearRampToValueAtTime(880, t + 0.04);
      blast.frequency.exponentialRampToValueAtTime(110, t + 0.28);

      const bpFilter = this.ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.Q.setValueAtTime(5.2, t);
      bpFilter.frequency.setValueAtTime(2600, t);
      bpFilter.frequency.exponentialRampToValueAtTime(380, t + 0.28);

      blastG.gain.setValueAtTime(0.32, t);
      blastG.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      blast.connect(bpFilter);
      bpFilter.connect(blastG);
      blastG.connect(this.sfxGain);
      blast.start(t);
      blast.stop(t + 0.3);

      // 3. Crackling arcane spark dispersion
      this._playSurfaceNoise(0.12, 0.28, 3400, 2.2);
    }
  }

  playSpecialMove(moveName) {
    if (moveName === 'whirlwind') {
      // Heavy whoosh
      this.playAttack();
      setTimeout(() => this.playAttack(), 140);
    } else if (moveName === 'groundSlam') {
      // Ground shaking boom
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.4);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.42);
      this._playQuickNoise(0.35, 0.4, 400);
    } else if (moveName === 'dash') {
      this._playQuickNoise(0.2, 0.35, 1200);
    } else {
      this.playAttack();
    }
  }

  playCraft() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // --- Heavy Anvil Hammer Strike & Quench Synthesis ---
    // 1. Heavy steel hammer impact thud
    const thud = this.ctx.createOscillator();
    const thudG = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(160, t);
    thud.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    thudG.gain.setValueAtTime(0.45, t);
    thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    thud.connect(thudG);
    thudG.connect(this.sfxGain);
    thud.start(t);
    thud.stop(t + 0.14);

    // 2. Harmonic metallic anvil rings (1180Hz & 2360Hz)
    [1180, 2360].forEach((freq, idx) => {
      const ping = this.ctx.createOscillator();
      const pingG = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(freq, t);
      pingG.gain.setValueAtTime(0.32 / (idx + 1), t);
      pingG.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      ping.connect(pingG);
      pingG.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.3);
    });

    // 3. Hot metal hiss / sizzle
    setTimeout(() => {
      this._playSurfaceNoise(0.18, 0.22, 2800, 1.2);
    }, 80);
  }

  // --- Shield Block, Parry & Guard Break SFX ---
  playShieldBlock() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Heavy dull impact thud
    const thud = this.ctx.createOscillator();
    const thudG = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    thudG.gain.setValueAtTime(0.5, t);
    thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    thud.connect(thudG);
    thudG.connect(this.sfxGain);
    thud.start(t);
    thud.stop(t + 0.15);

    // 2. Shield wood/metal deflection ring
    const ring = this.ctx.createOscillator();
    const ringG = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(480, t);
    ring.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    ringG.gain.setValueAtTime(0.3, t);
    ringG.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    ring.connect(ringG);
    ringG.connect(this.sfxGain);
    ring.start(t);
    ring.stop(t + 0.2);
  }

  playParry() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Piercing metallic clash ping (harmonic overtones: 1420Hz, 2840Hz, 4260Hz)
    [1420, 2840, 4260].forEach((freq, idx) => {
      const ping = this.ctx.createOscillator();
      const pingG = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(freq, t);
      pingG.gain.setValueAtTime(0.55 / (idx + 1), t);
      pingG.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      ping.connect(pingG);
      pingG.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.45);
    });

    // 2. High-speed deflection crack
    const crack = this.ctx.createOscillator();
    const crackG = this.ctx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(950, t);
    crack.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    crackG.gain.setValueAtTime(0.65, t);
    crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    crack.connect(crackG);
    crackG.connect(this.sfxGain);
    crack.start(t);
    crack.stop(t + 0.1);
  }

  playGuardBreak() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Heavy cracking shield collapse
    const crash = this.ctx.createOscillator();
    const crashG = this.ctx.createGain();
    crash.type = 'sawtooth';
    crash.frequency.setValueAtTime(90, t);
    crash.frequency.exponentialRampToValueAtTime(25, t + 0.35);
    crashG.gain.setValueAtTime(0.6, t);
    crashG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    crash.connect(crashG);
    crashG.connect(this.sfxGain);
    crash.start(t);
    crash.stop(t + 0.38);

    // Stumble groan
    this._playSurfaceNoise(0.22, 0.35, 800, 1.8);
  }

  playBuild() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [0, 0.09].forEach(offset => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t + offset);
      osc.frequency.exponentialRampToValueAtTime(70, t + offset + 0.08);
      gain.gain.setValueAtTime(0.3, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.09);
    });
  }

  playClick() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playCastRod() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Flexible whip whoosh
    this._playSurfaceNoise(0.20, 0.38, 1800, 1.4);

    // 2. Rapid spool line payout buzz (series of 4 micro-clicks)
    [0.04, 0.08, 0.12, 0.16].forEach(offset => {
      const click = this.ctx.createOscillator();
      const cG = this.ctx.createGain();
      click.type = 'sine';
      click.frequency.setValueAtTime(1600, t + offset);
      cG.gain.setValueAtTime(0.12, t + offset);
      cG.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.02);
      click.connect(cG);
      cG.connect(this.sfxGain);
      click.start(t + offset);
      click.stop(t + offset + 0.025);
    });
  }

  playSplash() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Bubbly FM water displacement resonance
    const mod = this.ctx.createOscillator();
    const modG = this.ctx.createGain();
    const carrier = this.ctx.createOscillator();
    const carG = this.ctx.createGain();

    mod.frequency.setValueAtTime(45, t);
    modG.gain.setValueAtTime(90, t);
    mod.connect(carrier.frequency);

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(280, t);
    carrier.frequency.exponentialRampToValueAtTime(95, t + 0.20);

    carG.gain.setValueAtTime(0.38, t);
    carG.gain.exponentialRampToValueAtTime(0.001, t + 0.20);

    carrier.connect(carG);
    carG.connect(this.sfxGain);

    mod.start(t);
    carrier.start(t);
    mod.stop(t + 0.22);
    carrier.stop(t + 0.22);

    // 2. Water droplet spray noise
    this._playSurfaceNoise(0.25, 0.32, 750, 1.2);
  }

  playFishBite() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Water tug splash + alert ping
    this.playSplash();

    const ping = this.ctx.createOscillator();
    const pGain = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(740, t);
    ping.frequency.exponentialRampToValueAtTime(980, t + 0.12);
    pGain.gain.setValueAtTime(0.35, t);
    pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    ping.connect(pGain);
    pGain.connect(this.sfxGain);
    ping.start(t);
    ping.stop(t + 0.16);
  }

  playReel() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Mechanical fishing reel ratchet clicks (3 rapid sharp teeth clicks)
    [0, 0.035, 0.07].forEach((offset, idx) => {
      const click = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      const st = t + offset;
      click.type = 'sawtooth';
      click.frequency.setValueAtTime(1850 + idx * 60, st);
      cGain.gain.setValueAtTime(0.24, st);
      cGain.gain.exponentialRampToValueAtTime(0.001, st + 0.025);
      click.connect(cGain);
      cGain.connect(this.sfxGain);
      click.start(st);
      click.stop(st + 0.03);
    });
  }

  playFishCatch() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Water emergence splash
    this.playSplash();

    // Triumphant sparkling catch chime (A5, C#6, E6 major arpeggio)
    const notes = [880, 1108.7, 1318.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + 0.08 + idx * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.32, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + 0.38);
    });
  }

  playChestOpen() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      // Gentle, sparkling melodic chime (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const st = t + idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, st);
        gain.gain.setValueAtTime(0.2, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.32);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(st);
        osc.stop(st + 0.33);
      });
    } catch (e) {}
  }

  playPickup() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(1250, t + 0.06);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playBossRoar(bossType = 'elk') {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.5);
    osc.frequency.exponentialRampToValueAtTime(35, t + 1.2);
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 1.3);
  }

  // --- Atmospheric Nightfall Warning Horn (Nordic Lur Warhorn) ---
  playNightWarning() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      // Resonant Nordic horn chords (D2, A2, D3)
      const freqs = [73.42, 110.0, 146.83];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 0.98, t);
        osc.frequency.linearRampToValueAtTime(freq, t + 0.6);
        osc.frequency.linearRampToValueAtTime(freq * 0.96, t + 2.8);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, t);
        filter.frequency.linearRampToValueAtTime(750 + idx * 150, t + 0.8);
        filter.frequency.linearRampToValueAtTime(200, t + 3.0);
        filter.Q.setValueAtTime(3.5, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.28 / freqs.length, t + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 3.3);
      });
    } catch (e) {
      console.warn('[AudioManager] playNightWarning error:', e);
    }
  }
}
