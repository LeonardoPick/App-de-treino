/**
 * storageService.js
 * Arquitetura Cloud-First (Supabase: tabelas `routines` e `workout_logs`)
 * com Fallback Local em IndexedDB + Fila de Sincronização Offline (Sync Queue).
 * Garante que o cronômetro e o treino em andamento nunca travem se o sinal da academia oscilar.
 */

import { generateId, DEFAULT_SET_REST_SECONDS } from '../models.js';
import { supabaseService } from './supabaseClient.js';

const IDB_NAME = 'WorkoutCloudCacheDB';
const IDB_VERSION = 2;
const STORE_CACHE = 'cache_store';
const STORE_QUEUE = 'sync_queue';

const CACHE_KEYS = {
  ROUTINES: 'routines',
  WORKOUT_LOGS: 'workout_logs',
  ACTIVE_WORKOUT: 'active_workout'
};

const DEFAULT_ROUTINES = [
  // ==========================================
  // TREINO A — LEGS (Segunda-feira)
  // ==========================================
  {
    id: 'routine_legs_a',
    name: 'Treino A — Legs',
    dayOfWeek: 1, // Segunda-feira
    exercises: [
      {
        id: 'ex_a1',
        name: 'Mesa Flexora',
        muscleGroup: 'Posterior de Coxa',
        restTimeSeconds: 90,
        sets: [
          { id: 's_a1_1', type: 'warmup', targetReps: 12, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a1_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a1_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a1_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false },
          { id: 's_a1_5', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 20, completed: false } // Back Off Set 20s
        ]
      },
      {
        id: 'ex_a2',
        name: 'Cadeira Abdutora',
        muscleGroup: 'Glúteo',
        restTimeSeconds: 90,
        sets: [
          { id: 's_a2_1', type: 'warmup', targetReps: 12, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a2_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a2_3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a2_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_a3',
        name: 'Elevação Pélvica',
        muscleGroup: 'Glúteo',
        restTimeSeconds: 90,
        sets: [
          { id: 's_a3_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a3_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a3_3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a3_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_a4',
        name: 'Stiff',
        muscleGroup: 'Posterior / Glúteo',
        restTimeSeconds: 90,
        sets: [
          { id: 's_a4_1', type: 'feeder', targetReps: 8, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a4_2', type: 'feeder', targetReps: 4, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a4_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a4_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_a5',
        name: 'Cadeira Extensora',
        muscleGroup: 'Quadríceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_a5_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a5_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_a5_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a5_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false } // + Rest Pause 30s
        ]
      },
      {
        id: 'ex_a6',
        name: 'Passada c/ Halteres',
        muscleGroup: 'Quadríceps / Glúteo',
        restTimeSeconds: 90,
        sets: [
          { id: 's_a6_1', type: 'work', targetReps: 20, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a6_2', type: 'work', targetReps: 20, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_a6_3', type: 'work', targetReps: 20, unit: 'kg', restTimeSeconds: 90, completed: false }
        ]
      }
    ]
  },

  // ==========================================
  // TREINO B — PUSH (Terça-feira)
  // ==========================================
  {
    id: 'routine_push_b',
    name: 'Treino B — Push',
    dayOfWeek: 2, // Terça-feira
    exercises: [
      {
        id: 'ex_b1',
        name: 'Panturrilha em Pé Máq.',
        muscleGroup: 'Panturrilha',
        restTimeSeconds: 90,
        sets: [
          { id: 's_b1_1', type: 'feeder', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_b1_2', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_b1_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_b1_4', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false }
        ]
      },
      {
        id: 'ex_b2',
        name: 'Voador',
        muscleGroup: 'Peitoral',
        restTimeSeconds: 90,
        sets: [
          { id: 's_b2_1', type: 'warmup', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_b2_2', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_b2_3', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_b2_4', type: 'top', targetReps: 6, unit: 'placas', restTimeSeconds: 120, completed: false },
          { id: 's_b2_5', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 20, completed: false } // Back Off Set 20s
        ]
      },
      {
        id: 'ex_b3',
        name: 'Supino Reto Máq. Articulada Horizontal',
        muscleGroup: 'Peitoral',
        restTimeSeconds: 90,
        sets: [
          { id: 's_b3_1', type: 'feeder', targetReps: 8, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_b3_2', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_b3_3', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_b4',
        name: 'Elevação Lateral c/ Halteres',
        muscleGroup: 'Ombro',
        restTimeSeconds: 90,
        sets: [
          { id: 's_b4_1', type: 'warmup', targetReps: 12, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_b4_2', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_b4_3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_b4_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false },
          { id: 's_b4_5', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 20, completed: false } // Back Off Set 20s
        ]
      },
      {
        id: 'ex_b5',
        name: 'Crucifixo Inclinado Polia Baixa ou Halteres',
        muscleGroup: 'Peitoral Superior',
        restTimeSeconds: 90,
        sets: [
          { id: 's_b5_1', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_b5_2', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_b5_3', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_b6',
        name: 'Tríceps Corda',
        muscleGroup: 'Tríceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_b6_1', type: 'feeder', targetReps: 8, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_b6_2', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_b6_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_b6_4', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      }
    ]
  },

  // ==========================================
  // TREINO C — PULL (Quarta-feira)
  // ==========================================
  {
    id: 'routine_pull_c',
    name: 'Treino C — Pull',
    dayOfWeek: 3, // Quarta-feira
    exercises: [
      {
        id: 'ex_c1',
        name: 'Puxada Alta Pronada',
        muscleGroup: 'Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 's_c1_1', type: 'warmup', targetReps: 12, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_c1_2', type: 'feeder', targetReps: 8, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_c1_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_c1_4', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_c2',
        name: 'Remada Articulada DY Row',
        muscleGroup: 'Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 's_c2_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_c2_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_c2_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_c2_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_c3',
        name: 'Pulldown Uni c/ Caneleira Banco 90°',
        muscleGroup: 'Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 's_c3_1', type: 'feeder', targetReps: 8, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_c3_2', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_c3_3', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_c4',
        name: 'Encolhimento Kelso Shrugs',
        muscleGroup: 'Trapézio / Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 's_c4_1', type: 'feeder', targetReps: 8, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_c4_2', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_c4_3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_c4_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_c5',
        name: 'Voador Invertido',
        muscleGroup: 'Deltóide Posterior',
        restTimeSeconds: 90,
        sets: [
          { id: 's_c5_1', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_c5_2', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_c5_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_c5_4', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false }
        ]
      }
    ]
  },

  // ==========================================
  // TREINO D — ARMS (Quinta-feira)
  // ==========================================
  {
    id: 'routine_arms_d',
    name: 'Treino D — Arms',
    dayOfWeek: 4, // Quinta-feira
    exercises: [
      {
        id: 'ex_d1',
        name: 'Rosca Direta Polia Baixa',
        muscleGroup: 'Bíceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_d1_1', type: 'warmup', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d1_2', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d1_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d1_4', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d1_5', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_d2',
        name: 'Tríceps Pulley',
        muscleGroup: 'Tríceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_d2_1', type: 'warmup', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d2_2', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d2_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d2_4', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d2_5', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_d3',
        name: 'Rosca Scott Máq Uni.',
        muscleGroup: 'Bíceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_d3_1', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_d3_2', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_d3_3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_d3_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_d4',
        name: 'Tríceps Francês c/ Corda',
        muscleGroup: 'Tríceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_d4_1', type: 'feeder', targetReps: 8, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d4_2', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d4_3', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d4_4', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_d5',
        name: 'Elevação Lateral Uni Polia p/ Trás',
        muscleGroup: 'Ombro Lateral',
        restTimeSeconds: 90,
        sets: [
          { id: 's_d5_1', type: 'warmup', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d5_2', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d5_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d5_4', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false }
        ]
      },
      {
        id: 'ex_d6',
        name: 'Rosca Martelo c/ Corda',
        muscleGroup: 'Bíceps / Braquial',
        restTimeSeconds: 90,
        sets: [
          { id: 's_d6_1', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_d6_2', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_d6_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false }
        ]
      }
    ]
  },

  // ==========================================
  // TREINO E — LEGS (Sexta-feira)
  // ==========================================
  {
    id: 'routine_legs_e',
    name: 'Treino E — Legs',
    dayOfWeek: 5, // Sexta-feira
    exercises: [
      {
        id: 'ex_e1',
        name: 'Cadeira Adutora',
        muscleGroup: 'Adutores',
        restTimeSeconds: 90,
        sets: [
          { id: 's_e1_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e1_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e1_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_e1_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_e2',
        name: 'Agachamento Livre Smith',
        muscleGroup: 'Quadríceps / Glúteo',
        restTimeSeconds: 90,
        sets: [
          { id: 's_e2_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e2_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e2_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_e2_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_e3',
        name: 'Cadeira Flexora',
        muscleGroup: 'Posterior de Coxa',
        restTimeSeconds: 90,
        sets: [
          { id: 's_e3_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e3_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e3_3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_e3_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_e4',
        name: 'Cadeira Extensora',
        muscleGroup: 'Quadríceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_e4_1', type: 'feeder', targetReps: 8, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e4_2', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_e4_3', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false },
          { id: 's_e4_4', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 30, completed: false } // Back Off Set 30s
        ]
      },
      {
        id: 'ex_e5',
        name: 'RDL (Romanian Deadlift)',
        muscleGroup: 'Posterior / Glúteo',
        restTimeSeconds: 90,
        sets: [
          { id: 's_e5_1', type: 'feeder', targetReps: 8, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_e5_2', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_e5_3', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      }
    ]
  },

  // ==========================================
  // TREINO F — UPPER (Sábado)
  // ==========================================
  {
    id: 'routine_upper_f',
    name: 'Treino F — Upper',
    dayOfWeek: 6, // Sábado
    exercises: [
      {
        id: 'ex_f1',
        name: 'Desenvolvimento c/ Halteres',
        muscleGroup: 'Ombro',
        restTimeSeconds: 90,
        sets: [
          { id: 's_f1_1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_f1_2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_f1_3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_f1_4', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_f2',
        name: 'Puxada Alta c/ Triângulo',
        muscleGroup: 'Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 's_f2_1', type: 'warmup', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_f2_2', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_f2_3', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_f2_4', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_f3',
        name: 'Supino Inclinado Máq. ou Barra',
        muscleGroup: 'Peitoral Superior',
        restTimeSeconds: 90,
        sets: [
          { id: 's_f3_1', type: 'feeder', targetReps: 8, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_f3_2', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_f3_3', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false },
          { id: 's_f3_4', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 30, completed: false } // Back Off Set 30s
        ]
      },
      {
        id: 'ex_f4',
        name: 'Remada T-Bar Row',
        muscleGroup: 'Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 's_f4_1', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's_f4_2', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's_f4_3', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_f5',
        name: 'Crossover Polia Baixa c/ Banco 90°',
        muscleGroup: 'Peitoral',
        restTimeSeconds: 90,
        sets: [
          { id: 's_f5_1', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_f5_2', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_f5_3', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_f6',
        name: 'Rosca Direta Máq. Horizontal',
        muscleGroup: 'Bíceps',
        restTimeSeconds: 90,
        sets: [
          { id: 's_f6_1', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's_f6_2', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's_f6_3', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false },
          { id: 's_f6_4', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 20, completed: false } // Back Off Set 20s
        ]
      }
    ]
  }
];

const DEFAULT_WORKOUT_LOGS = [
  {
    id: 'log_seed_1',
    routineId: 'routine_peito_triceps',
    routineName: 'Treino A — Peito, Tríceps & Ombro',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    durationSeconds: 3120,
    totalVolumeKg: 3550,
    completedExercises: [
      {
        exerciseId: 'ex_supino_reto',
        exerciseName: 'Supino Reto com Barra',
        muscleGroup: 'Peito',
        sets: [
          { type: 'warmup', reps: 12, weightOrPlates: 40, unit: 'kg', timestamp: '2026-11-04T10:10:00Z' },
          { type: 'feeder', reps: 6, weightOrPlates: 60, unit: 'kg', timestamp: '2026-11-04T10:14:00Z' },
          { type: 'work', reps: 8, weightOrPlates: 80, unit: 'kg', timestamp: '2026-11-04T10:18:00Z' },
          { type: 'work', reps: 7, weightOrPlates: 80, unit: 'kg', timestamp: '2026-11-04T10:22:00Z' },
          { type: 'top', reps: 5, weightOrPlates: 90, unit: 'kg', timestamp: '2026-11-04T10:26:00Z' }
        ]
      }
    ]
  },
  {
    id: 'log_seed_2',
    routineId: 'routine_peito_triceps',
    routineName: 'Treino A — Peito, Tríceps & Ombro',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    durationSeconds: 3240,
    totalVolumeKg: 3825,
    completedExercises: [
      {
        exerciseId: 'ex_supino_reto',
        exerciseName: 'Supino Reto com Barra',
        muscleGroup: 'Peito',
        sets: [
          { type: 'warmup', reps: 12, weightOrPlates: 40, unit: 'kg', timestamp: '2026-11-08T10:10:00Z' },
          { type: 'feeder', reps: 6, weightOrPlates: 65, unit: 'kg', timestamp: '2026-11-08T10:14:00Z' },
          { type: 'work', reps: 8, weightOrPlates: 82.5, unit: 'kg', timestamp: '2026-11-08T10:18:00Z' },
          { type: 'work', reps: 8, weightOrPlates: 82.5, unit: 'kg', timestamp: '2026-11-08T10:22:00Z' },
          { type: 'top', reps: 6, weightOrPlates: 92.5, unit: 'kg', timestamp: '2026-11-08T10:26:00Z' }
        ]
      }
    ]
  }
];

class StorageService {
  constructor() {
    this.db = null;

    // Carrega backup imediato do localStorage se existir
    let initialLogs = DEFAULT_WORKOUT_LOGS;
    try {
      const savedLogs = localStorage.getItem('workout_logs_cache_v1');
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialLogs = parsed;
        }
      }
    } catch (e) {}

    this.memoryCache = {
      routines: DEFAULT_ROUTINES.map(r => this.normalizeRoutineSets(r)),
      workoutLogs: initialLogs,
      activeWorkout: null
    };
    this.syncStatus = 'offline-cache'; // 'synced' | 'syncing' | 'offline-cache'
    this.init();
  }

  async init() {
    if (navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch (e) {}
    }

    await this.initIndexedDB();
    await this.hydrateFromIndexedDB();

    // Escuta autenticação no Supabase para sincronizar da nuvem imediatamente
    supabaseService.onAuthChange(async (user) => {
      if (user) {
        await this.flushSyncQueue();
        await this.syncFromSupabase();
      } else {
        this.setSyncStatus('offline-cache');
      }
    });

    // Quando a conexão do celular voltar na academia, descarrega a fila pendente para o Supabase
    window.addEventListener('online', async () => {
      await this.flushSyncQueue();
      await this.syncFromSupabase();
    });
  }

  setSyncStatus(status) {
    this.syncStatus = status;
    window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: { status } }));
  }

  normalizeRoutineSets(routine) {
    if (!routine || !Array.isArray(routine.exercises)) return routine;
    routine.exercises.forEach(ex => {
      if (!Array.isArray(ex.sets)) ex.sets = [];
      ex.sets.forEach(s => {
        if (!s.restTimeSeconds || isNaN(s.restTimeSeconds)) {
          s.restTimeSeconds = DEFAULT_SET_REST_SECONDS[s.type] || ex.restTimeSeconds || 90;
        }
      });
    });
    return routine;
  }

  // --- Camada de Cache Local IndexedDB (Resiliência Offline para o Cronômetro e Treino Ativo) ---
  initIndexedDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve();
        return;
      }
      try {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_CACHE)) {
            db.createObjectStore(STORE_CACHE);
          }
          if (!db.objectStoreNames.contains(STORE_QUEUE)) {
            db.createObjectStore(STORE_QUEUE, { keyPath: 'queueId', autoIncrement: true });
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve();
        };
        request.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  idbGet(storeName, key) {
    return new Promise((resolve) => {
      if (!this.db) return resolve(undefined);
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch (e) {
        resolve(undefined);
      }
    });
  }

  idbPut(storeName, key, value) {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        if (key !== null) {
          store.put(value, key);
        } else {
          store.put(value);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  async hydrateFromIndexedDB() {
    const cachedRoutines = await this.idbGet(STORE_CACHE, CACHE_KEYS.ROUTINES);
    const cachedLogs = await this.idbGet(STORE_CACHE, CACHE_KEYS.WORKOUT_LOGS);
    const cachedActive = await this.idbGet(STORE_CACHE, CACHE_KEYS.ACTIVE_WORKOUT);

    const routineVersion = localStorage.getItem('workout_routines_version_erick_v1');
    const isOldSeed = Array.isArray(cachedRoutines) && cachedRoutines.some(r => r.id === 'routine_peito_triceps');

    // Se o usuário ainda não migrou para as fichas de A ao F ou tem o seed antigo, atualiza automaticamente
    if (routineVersion !== 'erick_personal_v1' || isOldSeed || !Array.isArray(cachedRoutines) || cachedRoutines.length === 0) {
      this.memoryCache.routines = DEFAULT_ROUTINES.map(r => this.normalizeRoutineSets(r));
      await this.idbPut(STORE_CACHE, CACHE_KEYS.ROUTINES, this.memoryCache.routines);
      localStorage.setItem('workout_routines_version_erick_v1', 'erick_personal_v1');
    } else {
      this.memoryCache.routines = cachedRoutines.map(r => this.normalizeRoutineSets(r));
    }

    if (Array.isArray(cachedLogs) && cachedLogs.length > 0) {
      const mergedMap = new Map();
      cachedLogs.forEach(l => mergedMap.set(l.id, l));
      this.memoryCache.workoutLogs.forEach(l => mergedMap.set(l.id, l));
      this.memoryCache.workoutLogs = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } else {
      await this.idbPut(STORE_CACHE, CACHE_KEYS.WORKOUT_LOGS, this.memoryCache.workoutLogs);
    }

    if (cachedActive) {
      this.memoryCache.activeWorkout = cachedActive;
    }

    window.dispatchEvent(new CustomEvent('storage-synced'));
  }

  /**
   * Restaura o plano oficial do Personal Trainer (Treinos A ao F de Segunda a Sábado)
   */
  async restoreOfficialPlan() {
    this.memoryCache.routines = DEFAULT_ROUTINES.map(r => this.normalizeRoutineSets(r));
    await this.idbPut(STORE_CACHE, CACHE_KEYS.ROUTINES, this.memoryCache.routines);
    localStorage.setItem('workout_routines_version_erick_v1', 'erick_personal_v1');
    window.dispatchEvent(new CustomEvent('storage-synced'));
    window.dispatchEvent(new CustomEvent('workout-data-saved'));
    return this.memoryCache.routines;
  }

  // --- Fila de Sincronização Offline -> Supabase ---
  async enqueueCloudOperation(op) {
    await this.idbPut(STORE_QUEUE, null, { ...op, timestamp: Date.now() });
  }

  async flushSyncQueue() {
    if (!this.db || !supabaseService.client || !supabaseService.user || !navigator.onLine) return;

    try {
      const tx = this.db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = async () => {
        const items = req.result || [];
        if (items.length === 0) return;

        this.setSyncStatus('syncing');
        for (const item of items) {
          try {
            await this.executeRemoteOperation(item);
            const delTx = this.db.transaction(STORE_QUEUE, 'readwrite');
            delTx.objectStore(STORE_QUEUE).delete(item.queueId);
          } catch (e) {
            console.warn('Falha ao reenviar operação da fila:', e);
          }
        }
        this.setSyncStatus('synced');
      };
    } catch (e) {}
  }

  async executeRemoteOperation(op) {
    const client = supabaseService.client;
    const user = supabaseService.user;
    if (!client || !user) throw new Error('Usuário não autenticado no Supabase');

    if (op.table === 'routines') {
      if (op.action === 'upsert') {
        const r = op.payload;
        const { error } = await client.from('routines').upsert({
          id: r.id,
          user_id: user.id,
          name: r.name,
          day_of_week: r.dayOfWeek,
          exercises: r.exercises,
          updated_at: new Date().toISOString()
        });
        if (error) throw error;
      } else if (op.action === 'delete') {
        const { error } = await client.from('routines').delete().eq('id', op.id).eq('user_id', user.id);
        if (error) throw error;
      }
    } else if (op.table === 'workout_logs') {
      if (op.action === 'upsert') {
        const l = op.payload;
        const { error } = await client.from('workout_logs').upsert({
          id: l.id,
          user_id: user.id,
          routine_id: l.routineId,
          routine_name: l.routineName,
          date: l.date,
          duration_seconds: l.durationSeconds || 0,
          total_volume_kg: l.totalVolumeKg || 0,
          completed_exercises: l.completedExercises || []
        });
        if (error) throw error;
      } else if (op.action === 'delete') {
        const { error } = await client.from('workout_logs').delete().eq('id', op.id).eq('user_id', user.id);
        if (error) throw error;
      }
    }
  }

  /**
   * Busca dados diretamente das tabelas `routines` e `workout_logs` no Supabase
   */
  async syncFromSupabase() {
    const client = supabaseService.client;
    const user = supabaseService.user;
    if (!client || !user || !navigator.onLine) return;

    this.setSyncStatus('syncing');

    try {
      // 1. Busca tabela `routines`
      const { data: remoteRoutines, error: errRoutines } = await client
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true });

      if (!errRoutines && Array.isArray(remoteRoutines)) {
        if (remoteRoutines.length > 0) {
          this.memoryCache.routines = remoteRoutines.map(row => this.normalizeRoutineSets({
            id: row.id,
            name: row.name,
            dayOfWeek: row.day_of_week,
            exercises: row.exercises || []
          }));
          await this.idbPut(STORE_CACHE, CACHE_KEYS.ROUTINES, this.memoryCache.routines);
        } else {
          // Se a conta no Supabase for nova, faz o upload inicial das rotinas atuais do cache para a nuvem
          for (const routine of this.memoryCache.routines) {
            await this.executeRemoteOperation({ table: 'routines', action: 'upsert', payload: routine });
          }
        }
      }

      // 2. Busca tabela `workout_logs`
      const { data: remoteLogs, error: errLogs } = await client
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (!errLogs && Array.isArray(remoteLogs)) {
        if (remoteLogs.length > 0) {
          const mappedRemote = remoteLogs.map(row => ({
            id: row.id,
            routineId: row.routine_id,
            routineName: row.routine_name,
            date: row.date,
            durationSeconds: row.duration_seconds,
            totalVolumeKg: Number(row.total_volume_kg) || 0,
            completedExercises: row.completed_exercises || []
          }));

          const mergedMap = new Map();
          this.memoryCache.workoutLogs.forEach(l => mergedMap.set(l.id, l));
          mappedRemote.forEach(l => mergedMap.set(l.id, l));
          this.memoryCache.workoutLogs = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          try {
            localStorage.setItem('workout_logs_cache_v1', JSON.stringify(this.memoryCache.workoutLogs));
          } catch (e) {}

          await this.idbPut(STORE_CACHE, CACHE_KEYS.WORKOUT_LOGS, this.memoryCache.workoutLogs);
        }
      }

      this.setSyncStatus('synced');
      window.dispatchEvent(new CustomEvent('storage-synced'));
    } catch (err) {
      console.warn('Falha ao sincronizar com Supabase (usando cache IndexedDB):', err);
      this.setSyncStatus('offline-cache');
    }
  }

  // --- API de Rotinas (Cloud + Fallback IndexedDB) ---
  getRoutines() {
    return this.memoryCache.routines;
  }

  getRoutineById(id) {
    return this.memoryCache.routines.find(r => r.id === id) || null;
  }

  async saveRoutine(routine) {
    const normalized = this.normalizeRoutineSets(routine);
    const index = this.memoryCache.routines.findIndex(r => r.id === normalized.id);
    if (index >= 0) {
      this.memoryCache.routines[index] = normalized;
    } else {
      this.memoryCache.routines.push(normalized);
    }

    // Salva no fallback IndexedDB imediatamente
    await this.idbPut(STORE_CACHE, CACHE_KEYS.ROUTINES, this.memoryCache.routines);

    // Persiste remotamente na tabela `routines` do Supabase
    const op = { table: 'routines', action: 'upsert', payload: normalized };
    if (supabaseService.client && supabaseService.user && navigator.onLine) {
      try {
        this.setSyncStatus('syncing');
        await this.executeRemoteOperation(op);
        this.setSyncStatus('synced');
      } catch (e) {
        await this.enqueueCloudOperation(op);
        this.setSyncStatus('offline-cache');
      }
    } else {
      await this.enqueueCloudOperation(op);
    }

    return normalized;
  }

  async deleteRoutine(id) {
    this.memoryCache.routines = this.memoryCache.routines.filter(r => r.id !== id);
    await this.idbPut(STORE_CACHE, CACHE_KEYS.ROUTINES, this.memoryCache.routines);

    const op = { table: 'routines', action: 'delete', id };
    if (supabaseService.client && supabaseService.user && navigator.onLine) {
      try {
        await this.executeRemoteOperation(op);
      } catch (e) {
        await this.enqueueCloudOperation(op);
      }
    } else {
      await this.enqueueCloudOperation(op);
    }
  }

  // --- API de Histórico de Treinos (Tabela `workout_logs` + Fallback IndexedDB) ---
  getWorkoutLogs() {
    return [...this.memoryCache.workoutLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async saveWorkoutLog(log) {
    const existingIndex = this.memoryCache.workoutLogs.findIndex(l => l.id === log.id);
    if (existingIndex >= 0) {
      this.memoryCache.workoutLogs[existingIndex] = log;
    } else {
      this.memoryCache.workoutLogs.unshift(log);
    }

    // Backup imediato síncrono em localStorage
    try {
      localStorage.setItem('workout_logs_cache_v1', JSON.stringify(this.memoryCache.workoutLogs));
    } catch (e) {}

    await this.idbPut(STORE_CACHE, CACHE_KEYS.WORKOUT_LOGS, this.memoryCache.workoutLogs);

    const op = { table: 'workout_logs', action: 'upsert', payload: log };
    if (supabaseService.client && supabaseService.user && navigator.onLine) {
      try {
        this.setSyncStatus('syncing');
        await this.executeRemoteOperation(op);
        this.setSyncStatus('synced');
      } catch (e) {
        console.warn('Erro ao subir treino no Supabase (salvo localmente e enfileirado):', e);
        await this.enqueueCloudOperation(op);
        this.setSyncStatus('offline-cache');
      }
    } else {
      await this.enqueueCloudOperation(op);
    }

    window.dispatchEvent(new CustomEvent('workout-data-saved'));
    return log;
  }

  async deleteWorkoutLog(id) {
    this.memoryCache.workoutLogs = this.memoryCache.workoutLogs.filter(l => l.id !== id);
    await this.idbPut(STORE_CACHE, CACHE_KEYS.WORKOUT_LOGS, this.memoryCache.workoutLogs);

    const op = { table: 'workout_logs', action: 'delete', id };
    if (supabaseService.client && supabaseService.user && navigator.onLine) {
      try {
        await this.executeRemoteOperation(op);
      } catch (e) {
        await this.enqueueCloudOperation(op);
      }
    } else {
      await this.enqueueCloudOperation(op);
    }
    window.dispatchEvent(new CustomEvent('workout-data-saved'));
  }

  // --- Fallback Local em IndexedDB para o Treino Ativo (Não trava se a internet oscilar) ---
  getActiveWorkout() {
    return this.memoryCache.activeWorkout;
  }

  saveActiveWorkout(activeWorkout) {
    if (!activeWorkout) {
      this.memoryCache.activeWorkout = null;
      this.idbPut(STORE_CACHE, CACHE_KEYS.ACTIVE_WORKOUT, null);
    } else {
      activeWorkout.lastSavedAt = new Date().toISOString();
      this.memoryCache.activeWorkout = activeWorkout;
      this.idbPut(STORE_CACHE, CACHE_KEYS.ACTIVE_WORKOUT, activeWorkout);
    }
  }

  clearActiveWorkout() {
    this.memoryCache.activeWorkout = null;
    this.idbPut(STORE_CACHE, CACHE_KEYS.ACTIVE_WORKOUT, null);
  }

  exportAllData() {
    return JSON.stringify({
      version: '4.0-supabase',
      exportedAt: new Date().toISOString(),
      routines: this.getRoutines(),
      workoutLogs: this.getWorkoutLogs()
    }, null, 2);
  }

  async importAllData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.routines)) {
        for (const r of parsed.routines) {
          await this.saveRoutine(r);
        }
      }
      if (Array.isArray(parsed.workoutLogs)) {
        for (const l of parsed.workoutLogs) {
          await this.saveWorkoutLog(l);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const storageService = new StorageService();
