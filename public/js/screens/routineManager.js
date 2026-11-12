/**
 * routineManager.js
 * Construtor Minimalista de Rotinas (Estilo Apple iOS Settings).
 * Permite adicionar/retirar facilmente Aquecimentos, Feeders, Work Sets e Top Sets
 * e definir o tempo específico de descanso para cada tipo de série e para cada série individual.
 */

import { storageService } from '../services/storageService.js';
import { icons } from '../components/icons.js';
import {
  generateId,
  SET_TYPES_ORDER,
  SET_TYPE_LABELS,
  DEFAULT_SET_REST_SECONDS,
  DEFAULT_SET_TARGET_REPS,
  sortSetsByCategory
} from '../models.js';

const DAYS_OPTIONS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
];

const DRAFT_STORAGE_KEY = 'workout_routine_edit_draft';

export class RoutineManagerScreen {
  constructor(app) {
    this.app = app;
    this.editingRoutine = null;
    this.expandedExerciseIndex = 0;
    this.activeContainer = null;
    this.initDraftListeners();
  }

  initDraftListeners() {
    // Salva rascunho imediatamente ao trocar de aba ou minimizar navegador
    document.addEventListener('visibilitychange', () => {
      if (this.editingRoutine && this.activeContainer) {
        this.syncInputsToModel(this.activeContainer);
        this.saveDraft();
      }
    });

    window.addEventListener('beforeunload', () => {
      if (this.editingRoutine && this.activeContainer) {
        this.syncInputsToModel(this.activeContainer);
        this.saveDraft();
      }
    });
  }

  saveDraft() {
    if (this.editingRoutine) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          routine: this.editingRoutine,
          expandedIdx: this.expandedExerciseIndex
        }));
      } catch (e) {}
    }
  }

  clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
  }

  loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && data.routine && Array.isArray(data.routine.exercises)) {
        this.editingRoutine = data.routine;
        this.expandedExerciseIndex = typeof data.expandedIdx === 'number' ? data.expandedIdx : 0;
        return true;
      }
    } catch (e) {}
    return false;
  }

  render(container) {
    this.activeContainer = container;

    // Se não há rotina na memória, tenta restaurar rascunho em andamento
    if (!this.editingRoutine) {
      this.loadDraft();
    }

    if (this.editingRoutine) {
      this.renderEditor(container);
    } else {
      this.renderList(container);
    }
  }

  renderList(container) {
    const routines = storageService.getRoutines();

    container.innerHTML = `
      <div class="screen-routines space-y-6 animate-fade-in">
        
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white tracking-tight">Rotinas</h1>
            <p class="text-xs text-zinc-400 mt-0.5">Personalize séries e tempos de descanso por categoria</p>
          </div>
          <button 
            type="button" 
            id="btn-new-routine" 
            class="btn-primary text-xs px-4 py-2.5 rounded-full font-semibold flex items-center gap-1.5"
          >
            ${icons.plus} Nova Rotina
          </button>
        </div>

        <div class="space-y-3">
          ${routines.map(routine => {
            const dayName = DAYS_OPTIONS.find(d => d.value === routine.dayOfWeek)?.label || 'Livre';
            const totalSets = routine.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

            return `
              <div class="apple-card p-5 space-y-4">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="apple-badge-blue">${dayName}</span>
                    <h3 class="text-lg font-semibold text-white mt-2">${routine.name}</h3>
                    <p class="text-xs text-zinc-400 mt-0.5">
                      ${routine.exercises.length} exercícios • ${totalSets} séries no total
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button 
                      type="button" 
                      data-edit-routine="${routine.id}" 
                      class="btn-secondary text-xs px-3.5 py-2 rounded-full font-medium"
                    >
                      Editar
                    </button>
                    <button 
                      type="button" 
                      data-delete-routine="${routine.id}" 
                      class="btn-secondary p-2 rounded-full text-red-400"
                      title="Excluir"
                    >
                      ${icons.trash}
                    </button>
                  </div>
                </div>

                <div class="space-y-1.5 pt-3 border-t border-zinc-800">
                  ${routine.exercises.map(ex => {
                    const counts = {
                      warmup: ex.sets.filter(s => s.type === 'warmup').length,
                      feeder: ex.sets.filter(s => s.type === 'feeder').length,
                      work: ex.sets.filter(s => s.type === 'work').length,
                      top: ex.sets.filter(s => s.type === 'top').length
                    };
                    return `
                      <div class="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-zinc-950/70">
                        <div>
                          <span class="font-medium text-white">${ex.name}</span>
                          <span class="text-zinc-500 ml-1">(${ex.muscleGroup})</span>
                        </div>
                        <div class="flex items-center gap-1">
                          ${counts.warmup ? `<span class="badge-warmup text-[10px] px-2 py-0.5 rounded-full">${counts.warmup} Aquec</span>` : ''}
                          ${counts.feeder ? `<span class="badge-feeder text-[10px] px-2 py-0.5 rounded-full">${counts.feeder} Feeder</span>` : ''}
                          ${counts.work ? `<span class="badge-work text-[10px] px-2 py-0.5 rounded-full">${counts.work} Work</span>` : ''}
                          ${counts.top ? `<span class="badge-top text-[10px] px-2 py-0.5 rounded-full">${counts.top} Top</span>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;

    this.bindListEvents(container);
  }

  bindListEvents(container) {
    container.querySelector('#btn-new-routine')?.addEventListener('click', () => {
      this.clearDraft();
      this.expandedExerciseIndex = 0;
      this.editingRoutine = {
        id: generateId('routine'),
        name: 'Nova Rotina',
        dayOfWeek: 1,
        exercises: [
          {
            id: generateId('ex'),
            name: 'Novo Exercício',
            muscleGroup: 'Peito',
            restTimeSeconds: 90,
            sets: [
              { id: generateId('s'), type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
              { id: generateId('s'), type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
              { id: generateId('s'), type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
              { id: generateId('s'), type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
              { id: generateId('s'), type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
            ]
          }
        ]
      };
      this.saveDraft();
      this.render(container);
    });

    container.querySelectorAll('[data-edit-routine]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-routine');
        const routine = storageService.getRoutineById(id);
        if (routine) {
          this.clearDraft();
          this.expandedExerciseIndex = 0;
          this.editingRoutine = JSON.parse(JSON.stringify(routine));
          this.saveDraft();
          this.render(container);
        }
      });
    });

    container.querySelectorAll('[data-delete-routine]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-routine');
        if (confirm('Deseja excluir esta rotina?')) {
          storageService.deleteRoutine(id);
          this.render(container);
        }
      });
    });
  }

  renderEditor(container) {
    const routine = this.editingRoutine;
    if (this.expandedExerciseIndex === null || this.expandedExerciseIndex >= routine.exercises.length) {
      this.expandedExerciseIndex = routine.exercises.length > 0 ? 0 : null;
    }

    container.innerHTML = `
      <div class="screen-routine-editor space-y-6 animate-fade-in pb-16">
        
        <!-- Barra de Ação Fixa Estilo iOS -->
        <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
          <button 
            type="button" 
            id="btn-cancel-edit" 
            class="btn-secondary text-xs px-3.5 py-2 rounded-full flex items-center gap-1"
          >
            ${icons.arrowLeft} Voltar
          </button>
          <h2 class="text-base font-semibold text-white">Configurar Rotina</h2>
          <button 
            type="button" 
            id="btn-save-routine" 
            class="btn-primary text-xs px-4 py-2 rounded-full font-semibold"
          >
            Salvar
          </button>
        </div>

        <!-- Nome e Dia da Semana -->
        <div class="apple-card p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2 space-y-1">
              <label class="text-xs text-zinc-400 font-medium">Nome da Rotina</label>
              <input 
                type="text" 
                id="routine-name-input" 
                value="${routine.name}" 
                class="input-dark w-full px-3.5 py-2.5 text-sm"
                placeholder="Ex: Treino A — Peito e Tríceps"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs text-zinc-400 font-medium">Dia da Semana</label>
              <select id="routine-day-select" class="input-dark w-full px-3.5 py-2.5 text-sm">
                ${DAYS_OPTIONS.map(d => `
                  <option value="${d.value}" ${d.value === routine.dayOfWeek ? 'selected' : ''}>${d.label}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Lista de Exercícios com Acordeão / Expansão sob Demanda -->
        <div class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <div>
              <h3 class="text-sm font-semibold text-zinc-200">Exercícios (${routine.exercises.length})</h3>
              <p class="text-[11px] text-zinc-500">Toque em um exercício para abrir e editar os detalhes</p>
            </div>
            <button 
              type="button" 
              id="btn-add-exercise" 
              class="btn-secondary text-xs px-3.5 py-2 rounded-full flex items-center gap-1"
            >
              ${icons.plus} Adicionar Exercício
            </button>
          </div>

          <div class="space-y-3">
            ${routine.exercises.map((ex, exIndex) => {
              const isExpanded = this.expandedExerciseIndex === exIndex;
              return isExpanded
                ? this.renderExpandedExerciseCard(ex, exIndex, routine.exercises.length)
                : this.renderCollapsedExerciseCard(ex, exIndex, routine.exercises.length);
            }).join('')}
          </div>
        </div>

      </div>
    `;

    this.bindEditorEvents(container);
  }

  renderCollapsedExerciseCard(exercise, exIndex, totalExercises) {
    exercise.sets = sortSetsByCategory(exercise.sets);
    const counts = {
      warmup: exercise.sets.filter(s => s.type === 'warmup').length,
      feeder: exercise.sets.filter(s => s.type === 'feeder').length,
      work: exercise.sets.filter(s => s.type === 'work').length,
      top: exercise.sets.filter(s => s.type === 'top').length
    };
    const totalSets = exercise.sets.length;

    return `
      <div 
        class="apple-card p-3.5 sm:p-4 exercise-accordion-summary" 
        data-expand-exercise="${exIndex}"
        title="Toque para abrir e editar os detalhes"
      >
        <div class="flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Botões de Reordenar (Subir / Descer) -->
            <div class="flex flex-col gap-1 flex-shrink-0" onclick="event.stopPropagation()">
              <button 
                type="button" 
                class="order-btn ${exIndex === 0 ? 'disabled' : ''}" 
                data-move-exercise="${exIndex}" 
                data-direction="up" 
                title="Mover exercício para cima"
                ${exIndex === 0 ? 'disabled' : ''}
              >
                ${icons.arrowUp}
              </button>
              <button 
                type="button" 
                class="order-btn ${exIndex === totalExercises - 1 ? 'disabled' : ''}" 
                data-move-exercise="${exIndex}" 
                data-direction="down" 
                title="Mover exercício para baixo"
                ${exIndex === totalExercises - 1 ? 'disabled' : ''}
              >
                ${icons.arrowDown}
              </button>
            </div>

            <span class="text-xs font-mono font-semibold px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 flex-shrink-0">
              #${exIndex + 1}
            </span>
            <div class="min-w-0">
              <h4 class="text-sm font-semibold text-white truncate">${exercise.name || 'Novo Exercício'}</h4>
              <p class="text-[11px] text-zinc-400 mt-0.5 truncate">
                ${exercise.muscleGroup || 'Geral'} • ${totalSets} ${totalSets === 1 ? 'série' : 'séries'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Badges resumidas no desktop -->
            <div class="hidden sm:flex items-center gap-1">
              ${counts.warmup ? `<span class="badge-warmup text-[10px] px-2 py-0.5 rounded-full font-medium">${counts.warmup} Aquec</span>` : ''}
              ${counts.feeder ? `<span class="badge-feeder text-[10px] px-2 py-0.5 rounded-full font-medium">${counts.feeder} Feeder</span>` : ''}
              ${counts.work ? `<span class="badge-work text-[10px] px-2 py-0.5 rounded-full font-medium">${counts.work} Work</span>` : ''}
              ${counts.top ? `<span class="badge-top text-[10px] px-2 py-0.5 rounded-full font-medium">${counts.top} Top</span>` : ''}
            </div>

            <!-- Indicador Editar -->
            <div class="apple-link-btn text-xs">
              <span>Editar</span>
              ${icons.chevronDown}
            </div>
          </div>
        </div>

        <!-- Badges para mobile -->
        <div class="flex sm:hidden items-center gap-1 mt-2.5 pt-2 border-t border-zinc-800/60 flex-wrap">
          ${counts.warmup ? `<span class="badge-warmup text-[9px] px-2 py-0.5 rounded-full font-medium">${counts.warmup} Aquec</span>` : ''}
          ${counts.feeder ? `<span class="badge-feeder text-[9px] px-2 py-0.5 rounded-full font-medium">${counts.feeder} Feeder</span>` : ''}
          ${counts.work ? `<span class="badge-work text-[9px] px-2 py-0.5 rounded-full font-medium">${counts.work} Work</span>` : ''}
          ${counts.top ? `<span class="badge-top text-[9px] px-2 py-0.5 rounded-full font-medium">${counts.top} Top</span>` : ''}
        </div>
      </div>
    `;
  }

  renderExpandedExerciseCard(exercise, exIndex, totalExercises) {
    // Mantém as séries sempre ordenadas: Aquecimento -> Feeder -> Work -> Top
    exercise.sets = sortSetsByCategory(exercise.sets);

    return `
      <div 
        class="apple-card p-5 space-y-5 border border-purple-500/40" 
        data-exercise-index="${exIndex}"
      >
        <!-- Barra Superior do Exercício Aberto -->
        <div class="flex items-center justify-between pb-3 border-b border-zinc-800 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <!-- Botões de Reordenar (Subir / Descer) -->
            <div class="flex items-center gap-1">
              <button 
                type="button" 
                class="order-btn ${exIndex === 0 ? 'disabled' : ''}" 
                data-move-exercise="${exIndex}" 
                data-direction="up" 
                title="Mover exercício para cima"
                ${exIndex === 0 ? 'disabled' : ''}
              >
                ${icons.arrowUp}
              </button>
              <button 
                type="button" 
                class="order-btn ${exIndex === totalExercises - 1 ? 'disabled' : ''}" 
                data-move-exercise="${exIndex}" 
                data-direction="down" 
                title="Mover exercício para baixo"
                ${exIndex === totalExercises - 1 ? 'disabled' : ''}
              >
                ${icons.arrowDown}
              </button>
            </div>
            <span class="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400">
              #${exIndex + 1}
            </span>
            <span class="text-xs font-semibold text-white">Editando Exercício</span>
          </div>

          <div class="flex items-center gap-1">
            <button 
              type="button" 
              class="apple-link-btn text-xs text-zinc-400"
              data-toggle-collapse="${exIndex}"
              title="Recolher detalhes"
            >
              <span>Recolher</span>
              ${icons.chevronUp}
            </button>
            <button 
              type="button" 
              data-remove-exercise="${exIndex}" 
              class="apple-icon-btn text-red-400 ml-1"
              title="Excluir Exercício"
            >
              ${icons.trash}
            </button>
          </div>
        </div>

        <!-- Nome e Grupo Muscular -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2 space-y-1">
            <label class="text-[11px] text-zinc-400 font-medium">Nome do Exercício</label>
            <input 
              type="text" 
              class="input-dark w-full px-3 py-2 text-sm font-semibold ex-name-input" 
              value="${exercise.name}" 
              placeholder="Ex: Supino Reto com Barra"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-zinc-400 font-medium">Músculo Alvo</label>
            <input 
              type="text" 
              class="input-dark w-full px-3 py-2 text-sm ex-muscle-input" 
              value="${exercise.muscleGroup}" 
              placeholder="Ex: Peito"
            />
          </div>
        </div>

        <!-- Controle Rápido por Tipo de Série (Quantidade + Descanso da Categoria) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-zinc-300">Quantidade e Descanso por Tipo de Série</span>
            <span class="text-[11px] text-zinc-500">Adicione ou retire séries com + e −</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${SET_TYPES_ORDER.map(type => {
              const setsOfType = exercise.sets.filter(s => s.type === type);
              const count = setsOfType.length;
              const currentTypeRest = setsOfType[0]?.restTimeSeconds || DEFAULT_SET_REST_SECONDS[type];
              const badgeClass = `badge-${type}`;

              return `
                <div class="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800/80">
                  <div>
                    <span class="${badgeClass} text-xs px-2.5 py-0.5 rounded-full inline-block font-semibold">${SET_TYPE_LABELS[type]}</span>
                    <div class="flex items-center gap-1.5 mt-2">
                      <span class="text-[11px] text-zinc-400">Descanso:</span>
                      <input 
                        type="number" 
                        class="input-dark w-16 px-2 py-1 text-center text-xs font-semibold category-rest-input"
                        data-ex-idx="${exIndex}"
                        data-set-type="${type}"
                        value="${currentTypeRest}"
                        min="10"
                        max="600"
                        step="5"
                      />
                      <span class="text-[11px] text-zinc-500">seg</span>
                    </div>
                  </div>

                  <!-- Stepper iOS (- / Qtd / +) -->
                  <div class="apple-stepper">
                    <button 
                      type="button" 
                      class="apple-stepper-btn" 
                      data-step-type="${type}" 
                      data-step-action="remove" 
                      data-ex-idx="${exIndex}"
                      title="Retirar 1 ${SET_TYPE_LABELS[type]}"
                    >−</button>
                    <span class="apple-stepper-val">${count}</span>
                    <button 
                      type="button" 
                      class="apple-stepper-btn" 
                      data-step-type="${type}" 
                      data-step-action="add" 
                      data-ex-idx="${exIndex}"
                      title="Adicionar 1 ${SET_TYPE_LABELS[type]}"
                    >+</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Detalhamento Individual de Cada Série (Reps Alvo, Unidade e Descanso Individual) -->
        <div class="space-y-2 pt-2 border-t border-zinc-800">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-zinc-400">Ajuste Fino por Série (${exercise.sets.length} séries)</span>
            <span class="text-[11px] text-zinc-500">Você pode personalizar o descanso de cada série</span>
          </div>

          ${exercise.sets.length === 0 ? `
            <p class="text-xs text-zinc-500 py-3 text-center">Nenhuma série adicionada. Use os botões + acima.</p>
          ` : `
            <div class="space-y-1.5">
              ${exercise.sets.map((set, sIndex) => this.renderSetRow(set, exIndex, sIndex)).join('')}
            </div>
          `}
        </div>

        <!-- Botão de Conclusão / Recolher do Exercício -->
        <div class="pt-2 flex justify-end">
          <button 
            type="button" 
            class="btn-secondary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
            data-toggle-collapse="${exIndex}"
          >
            ${icons.check} Concluir este exercício
          </button>
        </div>

      </div>
    `;
  }

  renderSetRow(set, exIndex, sIndex) {
    const badgeClass = `badge-${set.type}`;
    const label = SET_TYPE_LABELS[set.type];
    const restVal = set.restTimeSeconds || DEFAULT_SET_REST_SECONDS[set.type] || 90;

    return `
      <div class="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-zinc-500 font-mono text-[11px] w-4">${sIndex + 1}.</span>
          <span class="${badgeClass} text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
            ${label}
          </span>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Repetições Alvo -->
          <div class="flex items-center gap-1">
            <span class="text-zinc-400 text-[11px]">Reps:</span>
            <input 
              type="number" 
              class="input-dark w-14 px-1.5 py-1 text-center font-semibold set-reps-input" 
              value="${set.targetReps || 8}" 
              min="1" 
              max="100" 
              data-ex-idx="${exIndex}" 
              data-set-idx="${sIndex}"
            />
          </div>

          <!-- Tempo de Descanso Específico desta Série -->
          <div class="flex items-center gap-1">
            <span class="text-zinc-400 text-[11px]">Descanso:</span>
            <input 
              type="number" 
              class="input-dark w-16 px-1.5 py-1 text-center font-semibold text-purple-400 set-rest-input" 
              value="${restVal}" 
              min="10" 
              max="600" 
              step="5"
              data-ex-idx="${exIndex}" 
              data-set-idx="${sIndex}"
            />
            <span class="text-zinc-500 text-[10px]">s</span>
          </div>

          <!-- Unidade (kg / placas) -->
          <select 
            class="input-dark px-2 py-1 text-[11px] set-unit-select" 
            data-ex-idx="${exIndex}" 
            data-set-idx="${sIndex}"
          >
            <option value="kg" ${set.unit === 'kg' ? 'selected' : ''}>kg</option>
            <option value="placas" ${set.unit === 'placas' ? 'selected' : ''}>placas</option>
          </select>

          <!-- Botão Excluir Série com visual limpo -->
          <button 
            type="button" 
            data-remove-set="${sIndex}" 
            data-ex-idx="${exIndex}" 
            class="set-remove-btn" 
            title="Remover série"
          >
            ${icons.x}
          </button>
        </div>
      </div>
    `;
  }

  bindEditorEvents(container) {
    const routine = this.editingRoutine;

    // Monitora qualquer alteração em inputs e selects para sincronizar e salvar rascunho em tempo real
    container.querySelectorAll('input, select').forEach(elem => {
      elem.addEventListener('input', () => {
        this.syncInputsToModel(container);
        this.saveDraft();
      });
      elem.addEventListener('change', () => {
        this.syncInputsToModel(container);
        this.saveDraft();
      });
    });

    container.querySelector('#routine-name-input')?.addEventListener('input', (e) => {
      routine.name = e.target.value;
      this.saveDraft();
    });

    container.querySelector('#routine-day-select')?.addEventListener('change', (e) => {
      routine.dayOfWeek = parseInt(e.target.value, 10);
      this.saveDraft();
    });

    container.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
      this.clearDraft();
      this.editingRoutine = null;
      this.render(container);
    });

    container.querySelector('#btn-save-routine')?.addEventListener('click', () => {
      this.syncInputsToModel(container);
      if (!routine.name.trim()) {
        alert('Informe o nome da rotina.');
        return;
      }
      if (routine.exercises.length === 0) {
        alert('Adicione pelo menos um exercício.');
        return;
      }
      storageService.saveRoutine(routine);
      this.clearDraft();
      this.editingRoutine = null;
      this.render(container);
    });

    // Reordenar Exercícios (Subir / Descer)
    container.querySelectorAll('[data-move-exercise]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.syncInputsToModel(container);
        const exIdx = parseInt(btn.getAttribute('data-move-exercise'), 10);
        const dir = btn.getAttribute('data-direction');

        if (dir === 'up' && exIdx > 0) {
          const temp = routine.exercises[exIdx];
          routine.exercises[exIdx] = routine.exercises[exIdx - 1];
          routine.exercises[exIdx - 1] = temp;
          if (this.expandedExerciseIndex === exIdx) {
            this.expandedExerciseIndex = exIdx - 1;
          } else if (this.expandedExerciseIndex === exIdx - 1) {
            this.expandedExerciseIndex = exIdx;
          }
        } else if (dir === 'down' && exIdx < routine.exercises.length - 1) {
          const temp = routine.exercises[exIdx];
          routine.exercises[exIdx] = routine.exercises[exIdx + 1];
          routine.exercises[exIdx + 1] = temp;
          if (this.expandedExerciseIndex === exIdx) {
            this.expandedExerciseIndex = exIdx + 1;
          } else if (this.expandedExerciseIndex === exIdx + 1) {
            this.expandedExerciseIndex = exIdx;
          }
        }
        this.saveDraft();
        this.render(container);
      });
    });

    // Expandir exercício ao clicar no resumo
    container.querySelectorAll('[data-expand-exercise]').forEach(card => {
      card.addEventListener('click', () => {
        this.syncInputsToModel(container);
        const exIdx = parseInt(card.getAttribute('data-expand-exercise'), 10);
        this.expandedExerciseIndex = exIdx;
        this.saveDraft();
        this.render(container);
      });
    });

    // Recolher detalhes do exercício aberto
    container.querySelectorAll('[data-toggle-collapse]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.syncInputsToModel(container);
        this.expandedExerciseIndex = null;
        this.saveDraft();
        this.render(container);
      });
    });

    container.querySelector('#btn-add-exercise')?.addEventListener('click', () => {
      this.syncInputsToModel(container);
      routine.exercises.push({
        id: generateId('ex'),
        name: 'Novo Exercício',
        muscleGroup: 'Geral',
        restTimeSeconds: 90,
        sets: [
          { id: generateId('s'), type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: generateId('s'), type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: generateId('s'), type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: generateId('s'), type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      });
      // Abre automaticamente o novo exercício adicionado
      this.expandedExerciseIndex = routine.exercises.length - 1;
      this.saveDraft();
      this.render(container);
    });

    container.querySelectorAll('[data-remove-exercise]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.syncInputsToModel(container);
        const exIdx = parseInt(btn.getAttribute('data-remove-exercise'), 10);
        routine.exercises.splice(exIdx, 1);
        if (this.expandedExerciseIndex === exIdx) {
          this.expandedExerciseIndex = routine.exercises.length > 0 ? Math.min(exIdx, routine.exercises.length - 1) : null;
        } else if (this.expandedExerciseIndex > exIdx) {
          this.expandedExerciseIndex--;
        }
        this.saveDraft();
        this.render(container);
      });
    });

    // Steppers (+ e -) de cada Categoria (Aquecimento, Feeder, Work, Top)
    container.querySelectorAll('[data-step-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.syncInputsToModel(container);
        const exIdx = parseInt(btn.getAttribute('data-ex-idx'), 10);
        const type = btn.getAttribute('data-step-type');
        const action = btn.getAttribute('data-step-action');
        const ex = routine.exercises[exIdx];
        if (!ex) return;

        // Lê o tempo de descanso configurado no input da categoria
        const catRestInput = container.querySelector(`.category-rest-input[data-ex-idx="${exIdx}"][data-set-type="${type}"]`);
        const categoryRest = catRestInput ? (parseInt(catRestInput.value, 10) || DEFAULT_SET_REST_SECONDS[type]) : DEFAULT_SET_REST_SECONDS[type];
        const existingUnit = ex.sets[0]?.unit || 'kg';

        if (action === 'add') {
          ex.sets.push({
            id: generateId('s'),
            type,
            targetReps: DEFAULT_SET_TARGET_REPS[type] || 10,
            unit: existingUnit,
            restTimeSeconds: categoryRest,
            completed: false
          });
          ex.sets = sortSetsByCategory(ex.sets);
        } else if (action === 'remove') {
          for (let i = ex.sets.length - 1; i >= 0; i--) {
            if (ex.sets[i].type === type) {
              ex.sets.splice(i, 1);
              break;
            }
          }
        }
        this.saveDraft();
        this.render(container);
      });
    });

    // Alteração no descanso de uma categoria aplica a todas as séries daquela categoria naquele exercício
    container.querySelectorAll('.category-rest-input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.syncInputsToModel(container);
        const exIdx = parseInt(input.getAttribute('data-ex-idx'), 10);
        const type = input.getAttribute('data-set-type');
        const newRest = parseInt(e.target.value, 10) || DEFAULT_SET_REST_SECONDS[type];
        const ex = routine.exercises[exIdx];
        if (ex) {
          ex.sets.forEach(s => {
            if (s.type === type) {
              s.restTimeSeconds = newRest;
            }
          });
          this.saveDraft();
          this.render(container);
        }
      });
    });

    // Remover uma série individual
    container.querySelectorAll('[data-remove-set]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.syncInputsToModel(container);
        const exIdx = parseInt(btn.getAttribute('data-ex-idx'), 10);
        const sIdx = parseInt(btn.getAttribute('data-remove-set'), 10);
        routine.exercises[exIdx].sets.splice(sIdx, 1);
        this.saveDraft();
        this.render(container);
      });
    });
  }

  syncInputsToModel(container) {
    const routine = this.editingRoutine;
    if (!routine) return;

    const exCards = container.querySelectorAll('[data-exercise-index]');
    exCards.forEach(card => {
      const exIdx = parseInt(card.getAttribute('data-exercise-index'), 10);
      const ex = routine.exercises[exIdx];
      if (!ex) return;

      const nameInput = card.querySelector('.ex-name-input');
      if (nameInput) ex.name = nameInput.value;

      const muscleInput = card.querySelector('.ex-muscle-input');
      if (muscleInput) ex.muscleGroup = muscleInput.value;

      card.querySelectorAll('.set-reps-input').forEach(rInput => {
        const sIdx = parseInt(rInput.getAttribute('data-set-idx'), 10);
        if (ex.sets[sIdx]) {
          ex.sets[sIdx].targetReps = parseInt(rInput.value, 10) || 8;
        }
      });

      card.querySelectorAll('.set-rest-input').forEach(restInput => {
        const sIdx = parseInt(restInput.getAttribute('data-set-idx'), 10);
        if (ex.sets[sIdx]) {
          ex.sets[sIdx].restTimeSeconds = parseInt(restInput.value, 10) || 90;
        }
      });

      card.querySelectorAll('.set-unit-select').forEach(uSelect => {
        const sIdx = parseInt(uSelect.getAttribute('data-set-idx'), 10);
        if (ex.sets[sIdx]) {
          ex.sets[sIdx].unit = uSelect.value;
        }
      });
    });
  }
}
