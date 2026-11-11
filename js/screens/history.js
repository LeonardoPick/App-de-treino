/**
 * history.js
 * Tela de Histórico e Progressão no estilo Apple Clean & Minimalist (Apple Health / Fitness).
 */

import { storageService } from '../services/storageService.js';
import { benchmarkService } from '../services/benchmarkService.js';
import { icons } from '../components/icons.js';
import { SET_TYPE_SHORT_LABELS } from '../models.js';

export class HistoryScreen {
  constructor(app) {
    this.app = app;
    this.activeTab = 'sessions';
    this.selectedExercise = null;
    this.selectedLogDetail = null;
  }

  render(container) {
    const logs = storageService.getWorkoutLogs();
    const exerciseNames = benchmarkService.getAllExerciseNames();

    if (!this.selectedExercise && exerciseNames.length > 0) {
      this.selectedExercise = exerciseNames[0];
    }

    container.innerHTML = `
      <div class="screen-history space-y-6 animate-fade-in pb-16">
        
        <!-- Cabeçalho Limpo -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white tracking-tight">Histórico</h1>
            <p class="text-xs text-zinc-400 mt-0.5">Sessões salvas e evolução de cargas</p>
          </div>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              id="btn-export-data" 
              class="btn-secondary text-xs px-3.5 py-2 rounded-full"
            >
              Exportar
            </button>
            <label class="btn-secondary text-xs px-3.5 py-2 rounded-full cursor-pointer">
              Importar
              <input type="file" id="input-import-data" accept=".json" class="hidden" />
            </label>
          </div>
        </div>

        <!-- Segmented Control Estilo iOS -->
        <div class="p-1 rounded-xl bg-zinc-900 flex">
          <button 
            type="button" 
            id="tab-btn-sessions" 
            class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              this.activeTab === 'sessions' 
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400'
            }"
          >
            Sessões (${logs.length})
          </button>
          <button 
            type="button" 
            id="tab-btn-progression" 
            class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              this.activeTab === 'progression' 
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400'
            }"
          >
            Evolução por Exercício
          </button>
        </div>

        <div id="history-tab-content">
          ${this.activeTab === 'sessions' 
            ? this.renderSessionsTab(logs) 
            : this.renderProgressionTab(exerciseNames)}
        </div>

        <div id="session-modal-container">
          ${this.selectedLogDetail ? this.renderSessionModal(this.selectedLogDetail) : ''}
        </div>

      </div>
    `;

    this.bindEvents(container);
  }

  renderSessionsTab(logs) {
    if (logs.length === 0) {
      return `
        <div class="apple-card p-8 text-center space-y-3">
          <h3 class="text-base font-semibold text-white">Nenhum treino salvo</h3>
          <p class="text-xs text-zinc-400">Finalize seu primeiro treino para consultar os registros aqui.</p>
          <button class="btn-primary text-xs px-4 py-2 rounded-full" id="btn-start-first-workout">Ir para Hoje</button>
        </div>
      `;
    }

    return `
      <div class="space-y-2.5">
        ${logs.map(log => {
          const dateObj = new Date(log.date);
          const formattedDate = dateObj.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          });
          const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const durationMin = Math.max(1, Math.round((log.durationSeconds || 0) / 60));
          const totalSets = (log.completedExercises || []).reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);

          return `
            <div 
              class="apple-card apple-card-interactive p-4 cursor-pointer space-y-3"
              data-view-log="${log.id}"
            >
              <div class="flex items-start justify-between">
                <div>
                  <span class="text-xs text-zinc-400">${formattedDate} às ${formattedTime} • ${durationMin} min</span>
                  <h3 class="text-base font-semibold text-white mt-0.5">${log.routineName}</h3>
                  <p class="text-xs text-zinc-400 mt-0.5">
                    ${log.completedExercises?.length || 0} exercícios • ${totalSets} séries
                    ${log.totalVolumeKg ? `• ${log.totalVolumeKg} kg` : ''}
                  </p>
                </div>
                <span class="text-purple-400 text-xs font-medium">Detalhes</span>
              </div>

              <div class="pt-2.5 border-t border-zinc-800 flex flex-wrap gap-1.5">
                ${(log.completedExercises || []).map(ex => `
                  <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-950/80 text-zinc-300">
                    ${ex.exerciseName} (${ex.sets.length})
                  </span>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderSessionModal(log) {
    const dateObj = new Date(log.date);
    const formattedDate = dateObj.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long'
    });
    const durationMin = Math.max(1, Math.round((log.durationSeconds || 0) / 60));

    return `
      <div class="apple-modal-backdrop">
        <div class="apple-sheet max-h-[88vh] overflow-y-auto space-y-4">
          
          <div class="flex items-start justify-between border-b border-zinc-800 pb-3">
            <div>
              <span class="text-xs text-zinc-400 block">${formattedDate} • ${durationMin} min</span>
              <h2 class="text-lg font-bold text-white mt-0.5">${log.routineName}</h2>
            </div>
            <button type="button" id="btn-close-modal" class="apple-close-btn">✕</button>
          </div>

          <div class="space-y-3">
            ${(log.completedExercises || []).map(ex => `
              <div class="apple-grouped-box p-3.5 space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-semibold text-white">${ex.exerciseName}</h4>
                  <span class="text-[11px] text-zinc-400">${ex.muscleGroup}</span>
                </div>

                <div class="space-y-1">
                  ${ex.sets.map((s, idx) => {
                    const badgeClass = `badge-${s.type}`;
                    const label = SET_TYPE_SHORT_LABELS[s.type] || s.type;

                    return `
                      <div class="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-zinc-950/70">
                        <div class="flex items-center gap-2">
                          <span class="text-zinc-500 text-[11px] font-mono">${idx + 1}.</span>
                          <span class="${badgeClass} text-[10px] px-2 py-0.5 rounded-full">${label}</span>
                        </div>
                        <div class="font-medium text-white">
                          ${s.weightOrPlates} ${s.unit} × <span class="text-emerald-400">${s.reps} reps</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <button 
              type="button" 
              data-delete-log="${log.id}"
              class="text-xs text-red-400 font-medium"
            >
              Excluir Registro
            </button>
            <button 
              type="button" 
              id="btn-close-modal-bottom"
              class="btn-secondary text-xs px-4 py-2 rounded-full"
            >
              Fechar
            </button>
          </div>

        </div>
      </div>
    `;
  }

  renderProgressionTab(exerciseNames) {
    if (exerciseNames.length === 0) {
      return `
        <div class="apple-card p-6 text-center text-zinc-400 text-xs">
          Nenhum exercício disponível.
        </div>
      `;
    }

    const currentEx = this.selectedExercise || exerciseNames[0];
    const progression = benchmarkService.getExerciseProgressionHistory(currentEx);

    let prWeight = 0;
    let prReps = 0;
    let prUnit = 'kg';

    progression.forEach(item => {
      if (item.maxWeight > prWeight) {
        prWeight = item.maxWeight;
        prReps = item.repsAtMax;
        prUnit = item.unit;
      }
    });

    return `
      <div class="space-y-4">
        
        <div class="apple-card p-4 space-y-1.5">
          <label class="text-xs font-medium text-zinc-400">Selecionar Exercício</label>
          <select id="exercise-filter-select" class="input-dark w-full px-3.5 py-2.5 text-sm font-medium">
            ${exerciseNames.map(name => `
              <option value="${name}" ${name === currentEx ? 'selected' : ''}>${name}</option>
            `).join('')}
          </select>
        </div>

        <div class="apple-card p-5 flex items-center justify-between">
          <div>
            <span class="text-xs text-zinc-400">Melhor Marca Pessoal (PR)</span>
            <h3 class="text-2xl font-bold text-white mt-0.5">
              ${prWeight > 0 ? `${prWeight} ${prUnit} × ${prReps} reps` : 'Sem registros'}
            </h3>
          </div>
          <span class="apple-badge-green">Recorde</span>
        </div>

        <div class="apple-card p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-zinc-300">Curva de Carga</h4>
            <span class="text-[11px] text-zinc-500">Carga máxima (${prUnit})</span>
          </div>
          <div class="overflow-x-auto">
            ${this.renderProgressionChart(progression)}
          </div>
        </div>

        <div class="apple-card p-4 space-y-2.5">
          <h4 class="text-xs font-semibold text-zinc-300">Histórico de ${currentEx}</h4>
          <div class="space-y-2">
            ${progression.length === 0 ? `
              <p class="text-xs text-zinc-500 text-center py-4">Nenhum registro encontrado.</p>
            ` : progression.map((item, idx) => {
              const prevItem = idx > 0 ? progression[idx - 1] : null;
              const weightDiff = prevItem ? (item.maxWeight - prevItem.maxWeight) : 0;
              const diffText = weightDiff > 0 ? `+${weightDiff} ${item.unit}` : (weightDiff < 0 ? `${weightDiff} ${item.unit}` : '—');
              const diffColor = weightDiff > 0 ? 'text-emerald-400' : 'text-zinc-500';
              const dateStr = new Date(item.date).toLocaleDateString('pt-BR');

              return `
                <div class="p-3 rounded-xl bg-zinc-950/70 text-xs flex items-center justify-between">
                  <div>
                    <span class="font-medium text-white">${dateStr}</span>
                    <div class="text-[11px] text-zinc-400 mt-1 flex flex-wrap gap-1">
                      ${item.sets.map(s => `
                        <span class="badge-${s.type} text-[10px] px-2 py-0.5 rounded-full">
                          ${s.weightOrPlates}${s.unit}×${s.reps}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-sm font-semibold text-white">${item.maxWeight} ${item.unit}</span>
                    <span class="text-[11px] block ${diffColor}">${diffText}</span>
                  </div>
                </div>
              `;
            }).reverse().join('')}
          </div>
        </div>

      </div>
    `;
  }

  renderProgressionChart(progression) {
    if (progression.length < 2) {
      return `
        <div class="py-6 text-center text-xs text-zinc-500">
          Registre pelo menos 2 sessões deste exercício para visualizar o gráfico.
        </div>
      `;
    }

    const width = 500;
    const height = 150;
    const padding = 32;

    const weights = progression.map(p => p.maxWeight);
    const minWeight = Math.max(0, Math.min(...weights) - 5);
    const maxWeight = Math.max(...weights) + 5;
    const range = (maxWeight - minWeight) || 1;

    const points = progression.map((item, idx) => {
      const x = padding + (idx / (progression.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((item.maxWeight - minWeight) / range) * (height - 2 * padding);
      return { x, y, weight: item.maxWeight, date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
    });

    const pathData = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <path d="${pathData}" fill="none" stroke="#0A84FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${points.map(pt => `
          <circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#0A84FF" stroke="#000000" stroke-width="2" />
          <text x="${pt.x}" y="${pt.y - 10}" fill="#FFFFFF" font-size="10" font-weight="600" text-anchor="middle">${pt.weight}</text>
          <text x="${pt.x}" y="${height - 10}" fill="#8E8E93" font-size="9" text-anchor="middle">${pt.date}</text>
        `).join('')}
      </svg>
    `;
  }

  bindEvents(container) {
    container.querySelector('#tab-btn-sessions')?.addEventListener('click', () => {
      this.activeTab = 'sessions';
      this.render(container);
    });

    container.querySelector('#tab-btn-progression')?.addEventListener('click', () => {
      this.activeTab = 'progression';
      this.render(container);
    });

    container.querySelector('#exercise-filter-select')?.addEventListener('change', (e) => {
      this.selectedExercise = e.target.value;
      this.render(container);
    });

    container.querySelectorAll('[data-view-log]').forEach(card => {
      card.addEventListener('click', () => {
        const logId = card.getAttribute('data-view-log');
        const logs = storageService.getWorkoutLogs();
        const found = logs.find(l => l.id === logId);
        if (found) {
          this.selectedLogDetail = found;
          this.render(container);
        }
      });
    });

    container.querySelector('#btn-close-modal')?.addEventListener('click', () => {
      this.selectedLogDetail = null;
      this.render(container);
    });
    container.querySelector('#btn-close-modal-bottom')?.addEventListener('click', () => {
      this.selectedLogDetail = null;
      this.render(container);
    });

    container.querySelector('[data-delete-log]')?.addEventListener('click', (e) => {
      const logId = e.currentTarget.getAttribute('data-delete-log');
      if (confirm('Excluir este registro de treino?')) {
        storageService.deleteWorkoutLog(logId);
        this.selectedLogDetail = null;
        this.render(container);
      }
    });

    container.querySelector('#btn-start-first-workout')?.addEventListener('click', () => {
      this.app.navigate('dashboard');
    });

    container.querySelector('#btn-export-data')?.addEventListener('click', () => {
      const jsonStr = storageService.exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const inputImport = container.querySelector('#input-import-data');
    if (inputImport) {
      inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = storageService.importAllData(event.target.result);
          if (res.success) {
            alert('Dados importados com sucesso!');
            this.render(container);
          } else {
            alert('Erro ao importar: ' + res.error);
          }
        };
        reader.readAsText(file);
      });
    }
  }
}
