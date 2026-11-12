/**
 * @typedef {'warmup' | 'feeder' | 'work' | 'top' | 'backoff' | 'rest_pause' | 'cluster'} SetType
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

export const BASE_SET_TYPES_ORDER = ['warmup', 'feeder', 'work', 'top'];
export const TECHNIQUE_SET_TYPES_ORDER = ['backoff', 'rest_pause', 'cluster'];
export const SET_TYPES_ORDER = [...BASE_SET_TYPES_ORDER, ...TECHNIQUE_SET_TYPES_ORDER];

export const SET_TYPE_LABELS = {
  warmup: 'Aquecimento',
  feeder: 'Feeder Set',
  work: 'Work Set',
  top: 'Top Set',
  backoff: 'Back Off Set',
  rest_pause: 'Rest Pause',
  cluster: 'Cluster Set'
};

export const SET_TYPE_SHORT_LABELS = {
  warmup: 'Aquec',
  feeder: 'Feeder',
  work: 'Work',
  top: 'Top',
  backoff: 'Back Off',
  rest_pause: 'Rest Pause',
  cluster: 'Cluster'
};

export const DEFAULT_SET_REST_SECONDS = {
  warmup: 60,
  feeder: 60,
  work: 90,
  top: 120,
  backoff: 30,
  rest_pause: 20,
  cluster: 15
};

export const DEFAULT_SET_TARGET_REPS = {
  warmup: 10,
  feeder: 6,
  work: 10,
  top: 8,
  backoff: 10,
  rest_pause: 6,
  cluster: 4
};

export const SET_TYPE_DESCRIPTIONS = {
  warmup: 'Ativação articular e muscular leve',
  feeder: 'Reconhecimento de carga sem fadiga',
  work: 'Série principal de hipertrofia',
  top: 'Esforço máximo e quebra de recorde',
  backoff: 'Redução de carga após a última série',
  rest_pause: 'Pausa curta após a série principal até a falha',
  cluster: 'Mini-séries com pausas curtas intra-série'
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
  },
  backoff: {
    badge: 'badge-backoff'
  },
  rest_pause: {
    badge: 'badge-rest_pause'
  },
  cluster: {
    badge: 'badge-cluster'
  }
};

/**
 * Verifica se o tipo é um complemento à última série (técnica avançada)
 */
export function isTechniqueSetType(type) {
  return TECHNIQUE_SET_TYPES_ORDER.includes(type);
}

/**
 * Ordena as séries sempre na sequência fisiológica:
 * Aquecimento -> Feeder -> Work -> Top -> Back Off -> Rest Pause -> Cluster
 */
export function sortSetsByCategory(sets) {
  const rank = {
    warmup: 1,
    feeder: 2,
    work: 3,
    top: 4,
    backoff: 5,
    rest_pause: 6,
    cluster: 7
  };
  return [...sets].sort((a, b) => (rank[a.type] || 9) - (rank[b.type] || 9));
}

/**
 * Cria um ID único
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
