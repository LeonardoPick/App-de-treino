/**
 * @typedef {'warmup' | 'feeder' | 'work' | 'top'} SetType
 * @typedef {'kg' | 'placas'} WeightUnit
 * 
 * @typedef {Object} ExerciseSet
 * @property {string} id
 * @property {SetType} type
 * @property {number} [targetReps]
 * @property {number} [actualReps]
 * @property {number} [weightOrPlates]
 * @property {WeightUnit} unit
 * @property {number} restTimeSeconds // Tempo de descanso específico desta série (em segundos)
 * @property {boolean} completed
 * @property {boolean} [skipped]
 * 
 * @typedef {Object} ExerciseConfig
 * @property {string} id
 * @property {string} name
 * @property {string} muscleGroup
 * @property {number} [restTimeSeconds] // Fallback padrão
 * @property {ExerciseSet[]} sets
 * 
 * @typedef {Object} Routine
 * @property {string} id
 * @property {string} name
 * @property {number} dayOfWeek // 0 (Domingo) a 6 (Sábado)
 * @property {ExerciseConfig[]} exercises
 */

export const SET_TYPES_ORDER = ['warmup', 'feeder', 'work', 'top'];

export const SET_TYPE_LABELS = {
  warmup: 'Aquecimento',
  feeder: 'Feeder Set',
  work: 'Work Set',
  top: 'Top Set'
};

export const SET_TYPE_SHORT_LABELS = {
  warmup: 'Aquec.',
  feeder: 'Feeder',
  work: 'Work',
  top: 'Top Set'
};

export const DEFAULT_SET_REST_SECONDS = {
  warmup: 60,
  feeder: 60,
  work: 90,
  top: 120
};

export const DEFAULT_SET_TARGET_REPS = {
  warmup: 10,
  feeder: 6,
  work: 10,
  top: 8
};

export const SET_TYPE_DESCRIPTIONS = {
  warmup: 'Ativação articular e muscular leve',
  feeder: 'Reconhecimento de carga sem fadiga',
  work: 'Série principal de hipertrofia',
  top: 'Esforço máximo e quebra de recorde'
};

export const SET_TYPE_COLORS = {
  warmup: {
    badge: 'badge-warmup'
  },
  feeder: {
    badge: 'badge-feeder'
  },
  work: {
    badge: 'badge-work'
  },
  top: {
    badge: 'badge-top'
  }
};

/**
 * Ordena as séries sempre na sequência fisiológica: Aquecimento -> Feeder -> Work -> Top
 */
export function sortSetsByCategory(sets) {
  const rank = { warmup: 1, feeder: 2, work: 3, top: 4 };
  return [...sets].sort((a, b) => (rank[a.type] || 9) - (rank[b.type] || 9));
}

/**
 * Cria um ID único
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
