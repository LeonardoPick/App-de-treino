/**
 * dashboard.js
 * Tela Inicial no estilo Apple Clean & Minimalist (iOS / Apple Fitness).
 * Simples, direta, com foco na rotina do dia, nas séries configuradas e nos últimos treinos salvos.
 */

import { storageService } from '../services/storageService.js';
import { icons } from '../components/icons.js';

const DAYS_OF_WEEK = [
  { dayIndex: 1, label: 'S', fullLabel: 'Seg', name: 'Segunda-feira' },
  { dayIndex: 2, label: 'T', fullLabel: 'Ter', name: 'Terça-feira' },
  { dayIndex: 3, label: 'Q', fullLabel: 'Qua', name: 'Quarta-feira' },
  { dayIndex: 4, label: 'Q', fullLabel: 'Qui', name: 'Quinta-feira' },
  { dayIndex: 5, label: 'S', fullLabel: 'Sex', name: 'Sexta-feira' },
  { dayIndex: 6, label: 'S', fullLabel: 'Sáb', name: 'Sábado' },
  { dayIndex: 0, label: 'D', fullLabel: 'Dom', name: 'Domingo' }
];

export class DashboardScreen {
  constructor(app) {
    this.app = app;
    this.selectedDayIndex = new Date().getDay();
  }

  render(container) {
    const routines = storageService.getRoutines();
    const logs = storageService.getWorkoutLogs();
    const todayIndex = new Date().getDay();

    const scheduledRoutine = routines.find(r => r.dayOfWeek === this.selectedDayIndex);
    const recentLogs = logs.slice(0, 4);

    container.innerHTML = `
      <div class="screen-dashboard space-y-6 animate-fade-in">
        
        <!-- Título Estilo iOS Large Title -->
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <h1 class="text-2xl font-bold text-white tracking-tight mt-0.5">Resumo</h1>
          </div>
        </div>

        <!-- Seletor Semanal Minimalista (Seg a Dom) -->
        <section class="apple-card p-3">
          <div class="grid grid-cols-7 gap-1.5">
            ${DAYS_OF_WEEK.map(d => {
              const isToday = d.dayIndex === todayIndex;
              const isSelected = d.dayIndex === this.selectedDayIndex;
              const routineForDay = routines.find(r => r.dayOfWeek === d.dayIndex);

              return `
                <button 
                  type="button"
                  data-day-index="${d.dayIndex}"
                  class="day-pill-btn ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''}"
                  title="${d.name}"
                >
                  <span class="day-label">${d.fullLabel}</span>
                  <span class="day-dot ${routineForDay ? 'has-routine' : ''}"></span>
                </button>
              `;
            }).join('')}
          </div>
        </section>

        <!-- Treino do Dia -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-sm font-semibold text-zinc-300">Treino Programado</h2>
            <button type="button" id="btn-edit-today-routine" class="apple-link-btn">
              Configurar séries
            </button>
          </div>
          ${scheduledRoutine ? this.renderRoutineHero(scheduledRoutine, scheduledRoutine.dayOfWeek === todayIndex) : this.renderRestDayCard()}
        </section>

        <!-- Outras Rotinas Disponíveis -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-sm font-semibold text-zinc-300">Todas as Rotinas</h2>
            <button type="button" id="btn-manage-routines" class="apple-link-btn">
              Gerenciar
            </button>
          </div>

          <div class="rs-cards-grid">
            ${routines.map(routine => this.renderCleanRoutineCard(routine, todayIndex)).join('')}
          </div>
        </section>

        <!-- Últimos Treinos Salvos -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-sm font-semibold text-zinc-300">Últimos Treinos Salvos</h2>
            <button type="button" id="btn-view-history" class="apple-link-btn">
              Ver histórico (${logs.length})
            </button>
          </div>

          ${recentLogs.length > 0 ? `
            <div class="space-y-2">
              ${recentLogs.map(log => this.renderCleanLogRow(log)).join('')}
            </div>
          ` : `
            <div class="apple-card p-6 text-center text-xs text-zinc-400">
              Seus treinos finalizados aparecerão salvos aqui.
            </div>
          `}
        </section>

      </div>
    `;

    this.bindEvents(container, scheduledRoutine);
  }

  renderRoutineHero(routine, isToday) {
    const muscleGroups = [...new Set(routine.exercises.map(e => e.muscleGroup))].join(' • ');
    const totalSets = routine.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

    return `
      <div class="apple-card p-5 space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <span class="apple-badge-green">${isToday ? 'Hoje' : 'Selecionado'}</span>
            <h3 class="text-xl font-bold text-white tracking-tight mt-2">${routine.name}</h3>
            <p class="text-xs text-zinc-400 mt-0.5">${muscleGroups} • ${totalSets} séries</p>
          </div>
        </div>

        <!-- Lista Limpa de Exercícios e Quantidade de Cada Série -->
        <div class="space-y-1.5 pt-2 border-t border-zinc-800">
          ${routine.exercises.map((ex, idx) => {
            const wCount = ex.sets.filter(s => s.type === 'warmup').length;
            const fCount = ex.sets.filter(s => s.type === 'feeder').length;
            const wkCount = ex.sets.filter(s => s.type === 'work').length;
            const tCount = ex.sets.filter(s => s.type === 'top').length;

            return `
              <div class="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-zinc-950/70">
                <span class="text-zinc-200 font-medium truncate pr-2">${idx + 1}. ${ex.name}</span>
                <div class="flex items-center gap-1 flex-shrink-0">
                  ${wCount ? `<span class="badge-warmup text-[10px] px-2 py-0.5 rounded-full">${wCount} Aquec</span>` : ''}
                  ${fCount ? `<span class="badge-feeder text-[10px] px-2 py-0.5 rounded-full">${fCount} Feeder</span>` : ''}
                  ${wkCount ? `<span class="badge-work text-[10px] px-2 py-0.5 rounded-full">${wkCount} Work</span>` : ''}
                  ${tCount ? `<span class="badge-top text-[10px] px-2 py-0.5 rounded-full">${tCount} Top</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button 
          type="button" 
          data-launch-routine="${routine.id}"
          class="btn-primary w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          ${icons.play}
          <span>Iniciar Treino</span>
        </button>
      </div>
    `;
  }

  renderCleanRoutineCard(routine, todayIndex) {
    const isToday = routine.dayOfWeek === todayIndex;
    const dayObj = DAYS_OF_WEEK.find(d => d.dayIndex === routine.dayOfWeek);
    const totalSets = routine.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const mainMuscles = [...new Set(routine.exercises.map(e => e.muscleGroup))].slice(0, 2).join(', ');

    return `
      <div 
        class="apple-card apple-card-interactive p-4 flex flex-col justify-between cursor-pointer space-y-3"
        data-launch-routine="${routine.id}"
      >
        <div class="flex items-start justify-between">
          <div>
            <span class="text-[11px] font-medium ${isToday ? 'text-emerald-400' : 'text-zinc-400'}">
              ${isToday ? '● Hoje' : (dayObj ? dayObj.name : 'Livre')}
            </span>
            <h3 class="text-base font-semibold text-white mt-0.5">${routine.name}</h3>
            <p class="text-xs text-zinc-400 mt-0.5">${mainMuscles}</p>
          </div>
          <span class="text-purple-400 p-1">${icons.chevronRight}</span>
        </div>

        <div class="pt-2.5 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span>${routine.exercises.length} exercícios</span>
          <span>${totalSets} séries</span>
        </div>
      </div>
    `;
  }

  renderCleanLogRow(log) {
    const dateObj = new Date(log.date);
    const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const durationMin = Math.max(1, Math.round((log.durationSeconds || 0) / 60));
    const totalSets = (log.completedExercises || []).reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);

    return `
      <div 
        class="apple-card apple-card-interactive p-4 flex items-center justify-between cursor-pointer"
        data-open-history-log="${log.id}"
      >
        <div>
          <h4 class="text-sm font-semibold text-white">${log.routineName}</h4>
          <p class="text-xs text-zinc-400 mt-0.5">
            ${dateStr} • ${durationMin} min • ${totalSets} séries ${log.totalVolumeKg ? `• ${log.totalVolumeKg} kg` : ''}
          </p>
        </div>
        <span class="apple-badge-green">Salvo</span>
      </div>
    `;
  }

  renderRestDayCard() {
    return `
      <div class="apple-card p-6 text-center space-y-3">
        <h3 class="text-base font-semibold text-white">Dia de Descanso</h3>
        <p class="text-xs text-zinc-400 max-w-xs mx-auto">
          Nenhuma rotina vinculada a este dia. Você pode descansar ou selecionar qualquer rotina abaixo.
        </p>
        <button 
          type="button" 
          id="btn-go-to-routines"
          class="btn-secondary text-xs px-4 py-2 rounded-full inline-flex items-center gap-1.5"
        >
          ${icons.plus} Configurar Rotina
        </button>
      </div>
    `;
  }

  bindEvents(container, scheduledRoutine) {
    container.querySelectorAll('.day-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDayIndex = parseInt(btn.getAttribute('data-day-index'), 10);
        this.render(container);
      });
    });

    container.querySelectorAll('[data-launch-routine]').forEach(el => {
      el.addEventListener('click', () => {
        const routineId = el.getAttribute('data-launch-routine');
        this.app.startWorkout(routineId);
      });
    });

    container.querySelectorAll('[data-open-history-log]').forEach(el => {
      el.addEventListener('click', () => {
        const logId = el.getAttribute('data-open-history-log');
        this.app.openHistoryLogDetail(logId);
      });
    });

    container.querySelector('#btn-edit-today-routine')?.addEventListener('click', () => {
      if (scheduledRoutine) {
        this.app.screens.routines.editingRoutine = JSON.parse(JSON.stringify(scheduledRoutine));
      }
      this.app.navigate('routines');
    });

    container.querySelector('#btn-go-to-routines')?.addEventListener('click', () => {
      this.app.navigate('routines');
    });
    container.querySelector('#btn-manage-routines')?.addEventListener('click', () => {
      this.app.navigate('routines');
    });
    container.querySelector('#btn-view-history')?.addEventListener('click', () => {
      this.app.navigate('history');
    });
  }
}
