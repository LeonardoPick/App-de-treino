/**
 * benchmarkService.js
 * Análise de histórico, detecção de PR (Personal Record) e benchmarks para sobrecarga progressiva.
 */

import { storageService } from './storageService.js';

class BenchmarkService {
  /**
   * Obtém os benchmarks (último resultado e melhor resultado) de um exercício para um tipo de série específico
   * @param {string} exerciseName Nome do exercício
   * @param {string} setType Tipo da série ('warmup' | 'feeder' | 'work' | 'top')
   * @param {string} [unit='kg'] Unidade ('kg' | 'placas')
   * @returns {{ last: { weight: number, reps: number, unit: string, date: string } | null, best: { weight: number, reps: number, unit: string, date: string } | null }}
   */
  getBenchmarkForSet(exerciseName, setType, unit = 'kg') {
    const logs = storageService.getWorkoutLogs();
    const cleanName = exerciseName.trim().toLowerCase();

    let lastResult = null;
    let bestResult = null;

    // Percorre os logs do mais recente para o mais antigo
    for (const log of logs) {
      if (!log.completedExercises) continue;

      for (const ex of log.completedExercises) {
        if (ex.exerciseName.trim().toLowerCase() === cleanName) {
          // Procura séries com o mesmo tipo
          const matchingSets = ex.sets.filter(s => s.type === setType);
          
          for (const s of matchingSets) {
            const entry = {
              weight: s.weightOrPlates,
              reps: s.reps,
              unit: s.unit,
              date: log.date
            };

            // O primeiro encontrado nos logs ordenados por data é o mais recente ("Anterior")
            if (!lastResult) {
              lastResult = entry;
            }

            // Critério de "Melhor" (PR): maior peso; se empatar, maior número de reps
            if (!bestResult) {
              bestResult = entry;
            } else {
              const isHeavier = entry.weight > bestResult.weight;
              const isSameWeightMoreReps = entry.weight === bestResult.weight && entry.reps > bestResult.reps;
              if (isHeavier || isSameWeightMoreReps) {
                bestResult = entry;
              }
            }
          }
        }
      }
    }

    return { last: lastResult, best: bestResult };
  }

  /**
   * Verifica se o resultado atual supera o melhor histórico
   */
  isNewPersonalRecord(exerciseName, setType, weight, reps, unit) {
    const { best } = this.getBenchmarkForSet(exerciseName, setType, unit);
    if (!best) return weight > 0 && reps > 0; // Primeiro registro já conta como marco
    if (weight > best.weight) return true;
    if (weight === best.weight && reps > best.reps) return true;
    return false;
  }

  /**
   * Lista todos os exercícios distintos registrados em rotinas ou histórico
   * @returns {string[]} Lista de nomes de exercícios
   */
  getAllExerciseNames() {
    const names = new Set();
    
    // De rotinas
    const routines = storageService.getRoutines();
    routines.forEach(r => {
      r.exercises.forEach(e => names.add(e.name));
    });

    // De logs
    const logs = storageService.getWorkoutLogs();
    logs.forEach(l => {
      l.completedExercises?.forEach(e => names.add(e.exerciseName));
    });

    return Array.from(names).sort();
  }

  /**
   * Obtém a progressão cronológica completa de um exercício específico
   * @param {string} exerciseName 
   * @returns {Array<{ date: string, routineName: string, sets: Array<{ type: string, weight: number, reps: number, unit: string }> }>}
   */
  getExerciseProgressionHistory(exerciseName) {
    const logs = storageService.getWorkoutLogs();
    const cleanName = exerciseName.trim().toLowerCase();
    const progression = [];

    // logs já estão ordenados descrescente, vamos ordenar crescente para o gráfico
    const sortedLogs = [...logs].reverse();

    sortedLogs.forEach(log => {
      const match = log.completedExercises?.find(e => e.exerciseName.trim().toLowerCase() === cleanName);
      if (match && match.sets && match.sets.length > 0) {
        // Encontra a melhor carga daquela sessão (geralmente Top Set ou melhor Work Set)
        let maxWeight = 0;
        let repsAtMax = 0;
        let unit = 'kg';

        match.sets.forEach(s => {
          if (s.weightOrPlates > maxWeight) {
            maxWeight = s.weightOrPlates;
            repsAtMax = s.reps;
            unit = s.unit;
          }
        });

        progression.push({
          date: log.date,
          routineName: log.routineName,
          maxWeight,
          repsAtMax,
          unit,
          sets: match.sets
        });
      }
    });

    return progression;
  }
}

export const benchmarkService = new BenchmarkService();
