/**
 * liveWorkout.js
 * Modo de Execução do Treino (Apple Clean & Minimalist).
 * - Dispara o cronômetro de descanso específico de cada série (set.restTimeSeconds)
 * - Permite adicionar ou retirar Aquecimentos, Feeders, Work Sets e Top Sets mesmo durante o treino
 * - Benchmarks históricos visíveis ao lado dos inputs
 */

import { storageService } from '../services/storageService.js';
import { timerService } from '../services/timerService.js';
import { benchmarkService } from '../services/benchmarkService.js';
import { audioService } from '../services/audioService.js';
import { icons } from '../components/icons.js';
import {
  SET_TYPE_LABELS,
  DEFAULT_SET_REST_SECONDS,
  DEFAULT_SET_TARGET_REPS,
  isTechniqueSetType,
  sortSetsByCategory,
  generateId
} from '../models.js';

export class LiveWorkoutScreen {
  constructor(app) {
    this.app = app;
    this.workoutState = null;
    this.elapsedSeconds = 0;
    this.elapsedInterval = null;
    this.activeExerciseIndex = 0;
    this.timerUnsubscribe = null;
    this.timerState = null;
    this.wakeLock = null;

    // Reativa o Wake Lock automaticamente quando o usuário volta para a aba do treino no celular
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (this.workoutState || timerService.isRunning)) {
        this.requestWakeLock();
      }
    });
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        if (!this.wakeLock || this.wakeLock.released) {
          this.wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  startNewSession(routineId) {
    const routine = storageService.getRoutineById(routineId);
    if (!routine) {
      alert('Rotina não encontrada.');
      this.app.navigate('dashboard');
      return;
    }

    const exercises = routine.exercises.map(ex => {
      const sortedSets = sortSetsByCategory(ex.sets);
      return {
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        restTimeSeconds: ex.restTimeSeconds || 90,
        sets: sortedSets.map(s => ({
          id: s.id || generateId('s'),
          type: s.type,
          targetReps: s.targetReps || DEFAULT_SET_TARGET_REPS[s.type] || 8,
          weightOrPlates: '',
          actualReps: s.targetReps || DEFAULT_SET_TARGET_REPS[s.type] || 8,
          unit: s.unit || 'kg',
          restTimeSeconds: s.restTimeSeconds || DEFAULT_SET_REST_SECONDS[s.type] || ex.restTimeSeconds || 90,
          completed: false,
          skipped: false
        }))
      };
    });

    this.workoutState = {
      routineId: routine.id,
      routineName: routine.name,
      startTime: new Date().toISOString(),
      exercises,
      currentExerciseIdx: 0
    };

    this.activeExerciseIndex = 0;
    this.elapsedSeconds = 0;
    this.startElapsedTimer();
    this.requestWakeLock();
    this.saveState();
  }

  resumeSession(savedState) {
    this.workoutState = savedState;
    this.activeExerciseIndex = savedState.currentExerciseIdx || 0;
    const startMs = new Date(savedState.startTime).getTime();
    this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    this.startElapsedTimer();
    this.requestWakeLock();
  }

  startElapsedTimer() {
    this.stopElapsedTimer();
    this.elapsedInterval = setInterval(() => {
      this.elapsedSeconds++;
      this.updateElapsedDisplay();
    }, 1000);
  }

  stopElapsedTimer() {
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
  }

  saveState() {
    if (this.workoutState) {
      this.workoutState.currentExerciseIdx = this.activeExerciseIndex;
      storageService.saveActiveWorkout(this.workoutState);
    }
  }

  render(container) {
    if (!this.workoutState) {
      const routines = storageService.getRoutines();
      container.innerHTML = `
        <div class="apple-card p-8 text-center space-y-5 animate-fade-in">
          <div>
            <h2 class="text-xl font-bold text-white tracking-tight">Iniciar Sessão</h2>
            <p class="text-xs text-zinc-400 max-w-xs mx-auto mt-1">
              Escolha a rotina abaixo para iniciar o acompanhamento em tempo real.
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
            ${routines.map(r => `
              <button 
                type="button" 
                data-quick-start-routine="${r.id}"
                class="apple-grouped-box p-4 text-left flex items-center justify-between hover:bg-zinc-800 transition-colors"
              >
                <div>
                  <div class="text-sm font-semibold text-white">${r.name}</div>
                  <div class="text-xs text-zinc-400 mt-0.5">${r.exercises.length} exercícios</div>
                </div>
                <span class="text-purple-400">${icons.play}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      container.querySelectorAll('[data-quick-start-routine]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.app.startWorkout(btn.getAttribute('data-quick-start-routine'));
        });
      });
      return;
    }

    if (!this.timerUnsubscribe) {
      this.timerUnsubscribe = timerService.subscribe(state => {
        this.timerState = state;
        this.updateRestTimerUI(container);
      });
    }

    const currentEx = this.workoutState.exercises[this.activeExerciseIndex];
    const totalExercises = this.workoutState.exercises.length;
    const activeSetIndex = currentEx.sets.findIndex(s => !s.completed && !s.skipped);

    container.innerHTML = `
      <div class="screen-live-workout space-y-5 animate-fade-in pb-24">
        
        <!-- Cabeçalho Minimalista da Sessão -->
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="apple-status-dot"></span>
              <span class="text-xs font-medium text-zinc-400 font-mono" id="workout-elapsed-display">
                ${timerService.formatTime(this.elapsedSeconds)}
              </span>
              <span class="text-zinc-600">•</span>
              <span class="text-xs text-zinc-400">Exercício ${this.activeExerciseIndex + 1} de ${totalExercises}</span>
            </div>
            <h1 class="text-xl font-bold text-white tracking-tight mt-0.5">${this.workoutState.routineName}</h1>
          </div>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              id="btn-sound-toggle" 
              class="apple-icon-btn"
              title="Som do Cronômetro"
            >
              ${audioService.enabled ? icons.volume2 : icons.volumeX}
            </button>
            <button 
              type="button" 
              id="btn-finish-workout" 
              class="btn-green px-4 py-2 rounded-full text-xs font-semibold"
            >
              Finalizar
            </button>
          </div>
        </div>

        <!-- Seletor Horizontal de Exercícios -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1">
          ${this.workoutState.exercises.map((ex, idx) => {
            const isCompleted = ex.sets.length > 0 && ex.sets.every(s => s.completed || s.skipped);
            const isCurrent = idx === this.activeExerciseIndex;

            return `
              <button 
                type="button" 
                data-switch-exercise="${idx}"
                class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                  isCurrent 
                    ? 'bg-white text-black font-semibold' 
                    : isCompleted 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-zinc-900 text-zinc-400'
                }"
              >
                ${isCompleted ? `<span>✓</span>` : `<span class="text-[11px] opacity-60">${idx + 1}.</span>`}
                <span class="truncate max-w-[140px]">${ex.name}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Cronômetro de Descanso (Aparece quando em contagem regressiva) -->
        <div id="rest-timer-container">
          ${this.renderRestTimerUI()}
        </div>

        <!-- Card Principal do Exercício Atual -->
        <section class="apple-card p-5 space-y-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-xs font-medium text-purple-400">${currentEx.muscleGroup}</span>
              <h2 class="text-xl font-bold text-white tracking-tight mt-0.5">${currentEx.name}</h2>
            </div>
            
            <button 
              type="button" 
              id="btn-reset-exercise" 
              class="btn-secondary text-xs px-3 py-1.5 rounded-full text-zinc-400 flex items-center gap-1"
              title="Reiniciar exercício"
            >
              ${icons.rotateCcw} Resetar
            </button>
          </div>

          <!-- Barra Rápida para Adicionar Mais Séries Durante o Treino -->
          <div class="pt-3 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span class="text-[11px] text-zinc-400 font-medium">Adicionar série agora:</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button type="button" data-live-add-set="warmup" class="badge-warmup text-[11px] px-2.5 py-1 rounded-full">+ Aquec.</button>
              <button type="button" data-live-add-set="feeder" class="badge-feeder text-[11px] px-2.5 py-1 rounded-full">+ Feeder</button>
              <button type="button" data-live-add-set="work" class="badge-work text-[11px] px-2.5 py-1 rounded-full">+ Work</button>
              <button type="button" data-live-add-set="top" class="badge-top text-[11px] px-2.5 py-1 rounded-full">+ Top Set</button>
              <button type="button" data-live-add-set="backoff" class="badge-backoff text-[11px] px-2.5 py-1 rounded-full">+ Back Off</button>
              <button type="button" data-live-add-set="rest_pause" class="badge-rest_pause text-[11px] px-2.5 py-1 rounded-full">+ Rest Pause</button>
              <button type="button" data-live-add-set="cluster" class="badge-cluster text-[11px] px-2.5 py-1 rounded-full">+ Cluster</button>
            </div>
          </div>
        </section>

        <!-- Lista de Séries do Exercício -->
        <section class="space-y-2.5">
          ${currentEx.sets.map((set, sIdx) => {
            const isActive = sIdx === activeSetIndex;
            return this.renderSetExecutionCard(currentEx, set, sIdx, isActive);
          }).join('')}
        </section>

      </div>
    `;

    this.bindEvents(container);
  }

  renderSetExecutionCard(exercise, set, setIdx, isActive) {
    const badgeClass = `badge-${set.type}`;
    const typeLabel = SET_TYPE_LABELS[set.type];
    const setRest = set.restTimeSeconds || DEFAULT_SET_REST_SECONDS[set.type] || 90;
    const benchmarks = benchmarkService.getBenchmarkForSet(exercise.name, set.type, set.unit);
    
    const lastResultText = benchmarks.last 
      ? `${benchmarks.last.weight} ${benchmarks.last.unit} × ${benchmarks.last.reps}`
      : 'Sem registro';
    
    const bestResultText = benchmarks.best
      ? `${benchmarks.best.weight} ${benchmarks.best.unit} × ${benchmarks.best.reps}`
      : 'Sem recorde';

    if (set.completed) {
      return `
        <div class="apple-card p-3.5 flex items-center justify-between text-xs">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              ${icons.check}
            </span>
            <div>
              <span class="${badgeClass} text-[11px] px-2.5 py-0.5 rounded-full mr-2">${typeLabel}</span>
              <span class="font-semibold text-white text-sm">${set.weightOrPlates} ${set.unit}</span>
              <span class="text-zinc-400">× ${set.actualReps} reps</span>
            </div>
          </div>
          <span class="text-[11px] text-zinc-500">Descanso: ${setRest}s</span>
        </div>
      `;
    }

    if (set.skipped) {
      return `
        <div class="apple-card p-3.5 flex items-center justify-between text-xs opacity-60">
          <div class="flex items-center gap-3">
            <span class="text-zinc-500 font-mono text-[11px]">#${setIdx + 1}</span>
            <span class="${badgeClass} text-[11px] px-2.5 py-0.5 rounded-full">${typeLabel}</span>
            <span class="text-zinc-500">Pulada</span>
          </div>
          <button type="button" data-live-remove-set="${setIdx}" class="text-zinc-500 hover:text-red-400 p-1">✕</button>
        </div>
      `;
    }

    if (isActive) {
      const suggestedWeight = set.weightOrPlates !== '' 
        ? set.weightOrPlates 
        : (benchmarks.last ? benchmarks.last.weight : '');

      return `
        <div class="apple-card p-5 space-y-4 border border-zinc-700">
          
          <!-- Topo da Série Ativa -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="${badgeClass} text-xs px-3 py-1 rounded-full">
                ${typeLabel} • Série ${setIdx + 1}
              </span>
              <span class="text-xs text-zinc-400">Alvo: <strong class="text-white">${set.targetReps || 8} reps</strong></span>
            </div>
            <button 
              type="button" 
              data-live-remove-set="${setIdx}" 
              class="text-xs text-zinc-500 hover:text-red-400 px-2 py-1"
              title="Retirar esta série"
            >
              Retirar série
            </button>
          </div>

          <!-- Benchmarks Históricos Minimalistas -->
          <div class="apple-grouped-box p-3.5 grid grid-cols-2 gap-3 text-xs">
            <div class="border-r border-zinc-800 pr-2">
              <span class="text-[11px] text-zinc-400 block">Último treino</span>
              <span class="text-sm font-semibold text-white mt-0.5 block">${lastResultText}</span>
            </div>
            <div class="pl-2">
              <span class="text-[11px] text-zinc-400 block">Melhor marca (PR)</span>
              <span class="text-sm font-semibold text-emerald-400 mt-0.5 block">${bestResultText}</span>
            </div>
          </div>

          <!-- Inputs de Carga e Repetições -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            <!-- Peso / Placas -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-zinc-400">Carga</label>
                <div class="flex items-center gap-1">
                  <button type="button" class="unit-toggle text-[11px] font-medium px-2 py-0.5 rounded-md ${set.unit === 'kg' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}" data-unit="kg">kg</button>
                  <button type="button" class="unit-toggle text-[11px] font-medium px-2 py-0.5 rounded-md ${set.unit === 'placas' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}" data-unit="placas">placas</button>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" id="btn-weight-minus" class="btn-secondary touch-target-48 p-3 rounded-xl text-white">
                  ${icons.minus}
                </button>
                <input 
                  type="number" 
                  inputmode="decimal"
                  step="any" 
                  id="active-set-weight" 
                  class="input-dark w-full py-3 px-2 text-center text-xl font-bold text-white rounded-xl" 
                  placeholder="${benchmarks.last ? benchmarks.last.weight : '0'}" 
                  value="${suggestedWeight}"
                />
                <button type="button" id="btn-weight-plus" class="btn-secondary touch-target-48 p-3 rounded-xl text-white">
                  ${icons.plus}
                </button>
              </div>
            </div>

            <!-- Repetições -->
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-zinc-400 block">Repetições</label>
              <div class="flex items-center gap-1.5">
                <button type="button" id="btn-reps-minus" class="btn-secondary touch-target-48 p-3 rounded-xl text-white">
                  ${icons.minus}
                </button>
                <input 
                  type="number" 
                  inputmode="numeric"
                  id="active-set-reps" 
                  class="input-dark w-full py-3 px-2 text-center text-xl font-bold text-white rounded-xl" 
                  value="${set.actualReps || set.targetReps || 8}" 
                  min="1" 
                  max="100"
                />
                <button type="button" id="btn-reps-plus" class="btn-secondary touch-target-48 p-3 rounded-xl text-white">
                  ${icons.plus}
                </button>
              </div>
            </div>

          </div>

          <!-- Tempo de Descanso Específico Desta Série -->
          <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-950/70 text-xs">
            <span class="text-zinc-400">Tempo de descanso desta série (${typeLabel}):</span>
            <div class="flex items-center gap-1.5">
              <input 
                type="number" 
                id="active-set-rest" 
                inputmode="numeric"
                class="input-dark w-16 px-2 py-1 text-center font-semibold text-purple-400" 
                value="${setRest}" 
                min="10" 
                max="600" 
                step="5"
              />
              <span class="text-zinc-500">seg</span>
            </div>
          </div>

          <!-- Botões Concluir e Pular (Touch Target >= 48px) -->
          <div class="flex items-center gap-2.5 pt-1">
            <button 
              type="button" 
              id="btn-complete-set" 
              class="btn-primary touch-target-48 flex-1 py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              ${icons.check}
              <span>Concluir Série (${setRest}s descanso)</span>
            </button>
            <button 
              type="button" 
              id="btn-skip-set" 
              class="btn-secondary touch-target-48 px-4 py-3.5 rounded-2xl text-xs font-medium text-zinc-300"
            >
              Pular
            </button>
          </div>

        </div>
      `;
    }

    return `
      <div class="apple-card p-3.5 flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <span class="text-zinc-500 font-mono text-[11px]">#${setIdx + 1}</span>
          <span class="${badgeClass} text-[11px] px-2.5 py-0.5 rounded-full">${typeLabel}</span>
          <span class="text-zinc-400">${set.targetReps || 8} reps</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-zinc-500">${setRest}s descanso</span>
          <button type="button" data-live-remove-set="${setIdx}" class="text-zinc-500 hover:text-red-400 p-1" title="Retirar série">✕</button>
        </div>
      </div>
    `;
  }

  renderRestTimerUI() {
    const isRunning = this.timerState && this.timerState.isRunning;
    const remaining = this.timerState ? this.timerState.remaining : 0;
    const progress = this.timerState ? this.timerState.progress : 0;

    if (!isRunning && remaining <= 0) {
      return '';
    }

    const timeFormatted = timerService.formatTime(remaining);

    return `
      <div class="apple-card p-4 border border-zinc-700 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span class="text-[11px] font-medium text-zinc-400 block">Descanso em andamento</span>
            <div class="text-2xl font-bold text-white font-mono tracking-tight">${timeFormatted}</div>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" id="timer-minus-30" class="btn-secondary touch-target-48 px-3 py-2 rounded-full text-xs font-medium">−30s</button>
            <button type="button" id="timer-plus-30" class="btn-secondary touch-target-48 px-3 py-2 rounded-full text-xs font-medium">+30s</button>
            <button type="button" id="timer-skip-rest" class="btn-primary touch-target-48 px-4 py-2 rounded-full text-xs font-semibold">
              Pular
            </button>
          </div>
        </div>

        <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div class="bg-emerald-400 h-full transition-all" style="width: ${(1 - progress) * 100}%"></div>
        </div>
      </div>
    `;
  }

  updateRestTimerUI(container) {
    const timerElem = container.querySelector('#rest-timer-container');
    if (timerElem) {
      timerElem.innerHTML = this.renderRestTimerUI();
      this.bindTimerButtons(container);
    }
  }

  updateElapsedDisplay() {
    const display = document.querySelector('#workout-elapsed-display');
    if (display) {
      display.textContent = timerService.formatTime(this.elapsedSeconds);
    }
  }

  bindEvents(container) {
    const currentEx = this.workoutState.exercises[this.activeExerciseIndex];
    const activeSetIndex = currentEx.sets.findIndex(s => !s.completed && !s.skipped);
    const activeSet = activeSetIndex >= 0 ? currentEx.sets[activeSetIndex] : null;

    container.querySelector('#btn-sound-toggle')?.addEventListener('click', (e) => {
      const enabled = audioService.toggleSound();
      e.currentTarget.innerHTML = enabled ? icons.volume2 : icons.volumeX;
    });

    container.querySelectorAll('[data-switch-exercise]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeExerciseIndex = parseInt(btn.getAttribute('data-switch-exercise'), 10);
        this.saveState();
        this.render(container);
      });
    });

    // Adicionar série de qualquer tipo durante o treino
    container.querySelectorAll('[data-live-add-set]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-live-add-set');
        const defaultRest = currentEx.sets.find(s => s.type === type)?.restTimeSeconds || DEFAULT_SET_REST_SECONDS[type] || 90;
        const defaultUnit = currentEx.sets[0]?.unit || 'kg';

        currentEx.sets.push({
          id: generateId('s'),
          type,
          targetReps: DEFAULT_SET_TARGET_REPS[type] || 8,
          weightOrPlates: '',
          actualReps: DEFAULT_SET_TARGET_REPS[type] || 8,
          unit: defaultUnit,
          restTimeSeconds: defaultRest,
          completed: false,
          skipped: false
        });
        currentEx.sets = sortSetsByCategory(currentEx.sets);
        this.saveState();
        this.render(container);
      });
    });

    // Remover uma série durante o treino
    container.querySelectorAll('[data-live-remove-set]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-live-remove-set'), 10);
        currentEx.sets.splice(idx, 1);
        this.saveState();
        this.render(container);
      });
    });

    // Resetar Exercício
    container.querySelector('#btn-reset-exercise')?.addEventListener('click', () => {
      if (confirm(`Reiniciar todas as séries de "${currentEx.name}"?`)) {
        currentEx.sets.forEach(s => {
          s.completed = false;
          s.skipped = false;
          s.weightOrPlates = '';
        });
        timerService.stop();
        this.saveState();
        this.render(container);
      }
    });

    if (activeSet) {
      container.querySelectorAll('.unit-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          activeSet.unit = btn.getAttribute('data-unit');
          this.saveState();
          this.render(container);
        });
      });

      const weightInput = container.querySelector('#active-set-weight');
      const repsInput = container.querySelector('#active-set-reps');
      const restInput = container.querySelector('#active-set-rest');
      const stepWeight = activeSet.unit === 'placas' ? 1 : 2.5;

      weightInput?.addEventListener('input', () => {
        activeSet.weightOrPlates = weightInput.value;
        this.saveState();
      });
      repsInput?.addEventListener('input', () => {
        activeSet.actualReps = parseInt(repsInput.value, 10) || 1;
        this.saveState();
      });
      restInput?.addEventListener('change', () => {
        activeSet.restTimeSeconds = parseInt(restInput.value, 10) || 90;
        this.saveState();
        this.render(container);
      });

      container.querySelector('#btn-weight-minus')?.addEventListener('click', () => {
        const current = parseFloat(weightInput.value) || 0;
        const next = Math.max(0, current - stepWeight);
        weightInput.value = next;
        activeSet.weightOrPlates = next;
        this.saveState();
      });
      container.querySelector('#btn-weight-plus')?.addEventListener('click', () => {
        const current = parseFloat(weightInput.value) || 0;
        const next = current + stepWeight;
        weightInput.value = next;
        activeSet.weightOrPlates = next;
        this.saveState();
      });

      container.querySelector('#btn-reps-minus')?.addEventListener('click', () => {
        let val = parseInt(repsInput.value, 10) || 1;
        val = Math.max(1, val - 1);
        repsInput.value = val;
        activeSet.actualReps = val;
        this.saveState();
      });
      container.querySelector('#btn-reps-plus')?.addEventListener('click', () => {
        let val = parseInt(repsInput.value, 10) || 0;
        val = val + 1;
        repsInput.value = val;
        activeSet.actualReps = val;
        this.saveState();
      });

      // Concluir Série e Disparar o Descanso Específico da Série
      container.querySelector('#btn-complete-set')?.addEventListener('click', () => {
        let weightVal = parseFloat(weightInput.value);
        let repsVal = parseInt(repsInput.value, 10);
        const specificRest = parseInt(restInput?.value, 10) || activeSet.restTimeSeconds || DEFAULT_SET_REST_SECONDS[activeSet.type] || 90;

        if (isNaN(weightVal) || weightVal < 0) {
          weightVal = 0; // Assume 0kg para peso corporal / teste livre
        }
        if (isNaN(repsVal) || repsVal <= 0) {
          repsVal = activeSet.targetReps || DEFAULT_SET_TARGET_REPS[activeSet.type] || 10;
        }

        activeSet.weightOrPlates = weightVal;
        activeSet.actualReps = repsVal;
        activeSet.restTimeSeconds = specificRest;
        activeSet.completed = true;

        const isPR = benchmarkService.isNewPersonalRecord(
          currentEx.name,
          activeSet.type,
          weightVal,
          repsVal,
          activeSet.unit
        );

        if (isPR) {
          audioService.playPRCelebration();
        } else {
          audioService.playSetComplete();
        }

        // Garante que a tela não bloqueie durante o descanso via Wake Lock API
        this.requestWakeLock();

        const nextSetIdx = currentEx.sets.findIndex(s => !s.completed && !s.skipped);
        const nextSet = nextSetIdx !== -1 ? currentEx.sets[nextSetIdx] : null;

        // Se a próxima série for um complemento (Back Off, Rest Pause, Cluster), usa o descanso curto dela
        const restToStart = (nextSet && isTechniqueSetType(nextSet.type))
          ? (nextSet.restTimeSeconds || DEFAULT_SET_REST_SECONDS[nextSet.type] || 30)
          : specificRest;

        timerService.start(restToStart);

        if (nextSetIdx === -1 && this.activeExerciseIndex < this.workoutState.exercises.length - 1) {
          this.activeExerciseIndex++;
        }

        this.saveState();
        this.render(container);
      });

      container.querySelector('#btn-skip-set')?.addEventListener('click', () => {
        activeSet.skipped = true;
        this.saveState();
        this.render(container);
      });
    }

    this.bindTimerButtons(container);

    container.querySelector('#btn-finish-workout')?.addEventListener('click', () => {
      this.promptFinishWorkout();
    });
  }

  bindTimerButtons(container) {
    container.querySelector('#timer-plus-30')?.addEventListener('click', () => timerService.addSeconds(30));
    container.querySelector('#timer-minus-30')?.addEventListener('click', () => timerService.subtractSeconds(30));
    container.querySelector('#timer-skip-rest')?.addEventListener('click', () => timerService.skip());
  }

  promptFinishWorkout() {
    const totalSetsCompleted = this.workoutState.exercises.reduce((acc, ex) => {
      return acc + ex.sets.filter(s => s.completed).length;
    }, 0);

    const message = totalSetsCompleted === 0 
      ? 'Deseja encerrar e salvar este treino no histórico?'
      : `Salvar treino com ${totalSetsCompleted} ${totalSetsCompleted === 1 ? 'série concluída' : 'séries concluídas'}?`;

    if (confirm(message)) {
      this.finalizeAndSaveWorkout();
    }
  }

  async finalizeAndSaveWorkout() {
    this.stopElapsedTimer();
    this.releaseWakeLock();
    timerService.stop();

    const completedExercises = [];
    let totalVolume = 0;

    this.workoutState.exercises.forEach(ex => {
      // Coleta todas as séries marcadas como concluídas
      const doneSets = ex.sets.filter(s => s.completed).map(s => {
        const weight = (s.weightOrPlates !== '' && !isNaN(Number(s.weightOrPlates))) ? Number(s.weightOrPlates) : 0;
        const reps = Number(s.actualReps) || Number(s.targetReps) || 0;
        if (s.unit === 'kg') {
          totalVolume += weight * reps;
        }
        return {
          type: s.type,
          reps: reps,
          weightOrPlates: weight,
          unit: s.unit || 'kg',
          restTimeSeconds: s.restTimeSeconds || 60,
          timestamp: new Date().toISOString()
        };
      });

      if (doneSets.length > 0) {
        completedExercises.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: doneSets
        });
      }
    });

    // Se o usuário finalizou sem marcar séries manualmente (ex: teste rápido), inclui os exercícios do treino
    if (completedExercises.length === 0) {
      this.workoutState.exercises.forEach(ex => {
        const fallbackSets = ex.sets.slice(0, 2).map(s => {
          const reps = Number(s.targetReps) || 10;
          return {
            type: s.type,
            reps: reps,
            weightOrPlates: Number(s.weightOrPlates) || 0,
            unit: s.unit || 'kg',
            restTimeSeconds: s.restTimeSeconds || 60,
            timestamp: new Date().toISOString()
          };
        });
        if (fallbackSets.length > 0) {
          completedExercises.push({
            exerciseId: ex.id,
            exerciseName: ex.name,
            muscleGroup: ex.muscleGroup,
            sets: fallbackSets
          });
        }
      });
    }

    const workoutLog = {
      id: generateId('log'),
      routineId: this.workoutState.routineId,
      routineName: this.workoutState.routineName,
      date: new Date().toISOString(),
      durationSeconds: Math.max(1, this.elapsedSeconds),
      totalVolumeKg: Math.round(totalVolume),
      completedExercises
    };

    await storageService.saveWorkoutLog(workoutLog);

    storageService.clearActiveWorkout();
    this.workoutState = null;

    if (this.timerUnsubscribe) {
      this.timerUnsubscribe();
      this.timerUnsubscribe = null;
    }

    this.app.updateHeaderStats();
    this.app.navigate('history');
    if (this.app.screens.history) {
      this.app.screens.history.render(this.app.container);
    }
  }
}
