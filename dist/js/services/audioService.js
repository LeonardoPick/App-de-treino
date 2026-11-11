/**
 * audioService.js
 * Síntese de áudio nativa via Web Audio API.
 * Não requer arquivos externos de áudio (MP3/WAV) e funciona 100% offline.
 */

class AudioService {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.vibrateEnabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(forceState) {
    this.enabled = forceState !== undefined ? forceState : !this.enabled;
    return this.enabled;
  }

  /**
   * Bipe curto de contagem regressiva (últimos 3 segundos de descanso)
   */
  playTick() {
    if (!this.enabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio tick failed:', e);
    }
  }

  /**
   * Som de término do descanso (campainha energética de 2 tons)
   */
  playTimerComplete() {
    if (this.vibrateEnabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
    if (!this.enabled) return;

    try {
      this.init();
      const now = this.ctx.currentTime;
      
      // Nota 1 (C6 - 1046.5Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Nota 2 mais alta (E6 - 1318.5Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.18);
      gain2.gain.setValueAtTime(0.35, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio timer complete failed:', e);
    }
  }

  /**
   * Confirmação ao salvar/concluir uma série
   */
  playSetComplete() {
    if (this.vibrateEnabled && navigator.vibrate) {
      navigator.vibrate(60);
    }
    if (!this.enabled) return;

    try {
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio set complete failed:', e);
    }
  }

  /**
   * Fanfarra de Novo Recorde Pessoal (PR batido!)
   */
  playPRCelebration() {
    if (this.vibrateEnabled && navigator.vibrate) {
      navigator.vibrate([100, 50, 150, 50, 300]);
    }
    if (!this.enabled) return;

    try {
      this.init();
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.1;
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch (e) {
      console.warn('Audio PR fanfare failed:', e);
    }
  }
}

export const audioService = new AudioService();
