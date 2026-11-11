/**
 * timerService.js
 * Cronômetro de descanso regressivo de alta precisão com suporte a áudio Web Audio API e vibração.
 */

import { audioService } from './audioService.js';

class TimerService {
  constructor() {
    this.remainingSeconds = 0;
    this.initialSeconds = 0;
    this.intervalId = null;
    this.isRunning = false;
    this.listeners = new Set();
    this.hasTickedLastSeconds = { 3: false, 2: false, 1: false };
  }

  /**
   * Adiciona um ouvinte para atualizações do timer
   * @param {(state: { remaining: number, initial: number, isRunning: boolean, progress: number }) => void} callback 
   */
  subscribe(callback) {
    this.listeners.add(callback);
    this.notify();
    return () => this.listeners.delete(callback);
  }

  notify() {
    const progress = this.initialSeconds > 0 
      ? Math.max(0, Math.min(1, (this.initialSeconds - this.remainingSeconds) / this.initialSeconds))
      : 0;

    const state = {
      remaining: this.remainingSeconds,
      initial: this.initialSeconds,
      isRunning: this.isRunning,
      progress
    };

    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.error('Erro no listener do timer:', e);
      }
    });
  }

  start(seconds) {
    this.stop();
    this.initialSeconds = Math.max(1, Math.round(seconds));
    this.remainingSeconds = this.initialSeconds;
    this.isRunning = true;
    this.hasTickedLastSeconds = { 3: false, 2: false, 1: false };

    // Ativa contexto de áudio em resposta ao clique do usuário
    audioService.init();

    this.notify();

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  tick() {
    if (this.remainingSeconds <= 1) {
      this.remainingSeconds = 0;
      this.stop();
      this.notify();
      audioService.playTimerComplete();
      return;
    }

    this.remainingSeconds--;

    // Bipes curtos nos últimos 3 segundos para alertar o atleta
    if (this.remainingSeconds <= 3 && this.remainingSeconds >= 1) {
      if (!this.hasTickedLastSeconds[this.remainingSeconds]) {
        this.hasTickedLastSeconds[this.remainingSeconds] = true;
        audioService.playTick();
      }
    }

    this.notify();
  }

  addSeconds(secondsToAdd) {
    if (!this.isRunning && this.remainingSeconds <= 0) return;
    this.remainingSeconds = Math.max(0, this.remainingSeconds + secondsToAdd);
    this.initialSeconds = Math.max(this.initialSeconds, this.remainingSeconds);
    this.notify();
  }

  subtractSeconds(secondsToSub) {
    if (!this.isRunning) return;
    this.remainingSeconds = Math.max(1, this.remainingSeconds - secondsToSub);
    this.notify();
  }

  skip() {
    this.stop();
    this.remainingSeconds = 0;
    this.notify();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const timerService = new TimerService();
