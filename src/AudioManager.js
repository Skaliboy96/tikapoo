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

    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
      this._setupGainRouting();
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
    this.ambientGain.gain.setValueAtTime(this.ambientVolume * 0.25, t);
    this.ambientGain.connect(this.masterGain);

    this._startGentleAmbient();
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('valheim_vol_master', this.masterVolume.toFixed(2));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('valheim_vol_music', this.musicVolume.toFixed(2));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.45, this.ctx.currentTime, 0.05);
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
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume * 0.25, this.ctx.currentTime, 0.05);
    }
  }

  // Soft continuous natural wind layer with gentle low-pass pink noise
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
        output[i] = (b0 + b1 + b2) * 0.11;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);
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

    if (this.musicGain && this.ctx) {
      // Elevate music presence and intensity during dramatic boss battle
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.85, this.ctx.currentTime, 0.3);
    }
  }

  stopBossMusic() {
    if (!this.isBossMusicActive) return;
    this.isBossMusicActive = false;
    this.activeBossDef = null;
    this.musicTimer = 3.5; // Resume ambient music peacefully
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.45, this.ctx.currentTime, 1.2);
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

  // --- Dynamic Boss Battle Music: Pounding War Drums & Heavy Orchestral Brass ---
  _updateBossMusic(delta) {
    if (!this.ctx || !this.musicGain) return;

    // 1. Driving Battle Percussion (142 BPM march = 0.422s per beat)
    this.bossBeatTimer += delta;
    if (this.bossBeatTimer >= 0.42) {
      this.bossBeatTimer = 0;
      const isDownbeat = (this.bossStep % 4 === 0);
      this._playWarDrum(isDownbeat);
      this.bossStep++;
    }

    // 2. Menacing Low Brass Power Chords (every 4 beats = ~1.68s)
    this.bossMusicTimer += delta;
    if (this.bossMusicTimer >= 1.68) {
      this.bossMusicTimer = 0;
      this._playBossBrassStab(this.bossStep);
    }
  }

  _playWarDrum(isDownbeat = false) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Heavy bass drum punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isDownbeat ? 140 : 105;
    const endFreq = isDownbeat ? 36 : 42;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.18);

    gain.gain.setValueAtTime(isDownbeat ? 0.32 : 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.3);

    // Snare / rim transient accent on backbeats
    if (!isDownbeat && this.bossStep % 2 === 1) {
      const noise = this._createNoiseBuffer(0.08);
      if (noise) {
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = noise;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(800, t);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.08, t);
        nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

        nSrc.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.musicGain);
        nSrc.start(t);
      }
    }
  }

  _playBossBrassStab(step) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Dark Nordic combat chord roots (E -> C -> D -> B)
    const chords = [
      [82.41, 123.47, 164.81], // E power chord
      [65.41, 98.0, 130.81],   // C power chord
      [73.42, 110.0, 146.83],  // D power chord
      [61.74, 92.5, 123.47]    // B power chord
    ];
    const notes = chords[Math.floor(step / 4) % chords.length];

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, t);
    masterGain.gain.linearRampToValueAtTime(0.18, t + 0.08);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    masterGain.connect(this.musicGain);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, t);
    filter.frequency.linearRampToValueAtTime(1400, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(250, t + 1.4);
    filter.Q.setValueAtTime(3.5, t);
    filter.connect(masterGain);

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(idx * 4 - 4, t);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 1.45);
    });
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

  playSpell(type = 'fireball') {
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
      // Magic bell
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.85);
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
    [440, 554.37, 659.25].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + idx * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
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
}
