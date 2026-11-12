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
  {
    id: 'routine_peito_triceps',
    name: 'Treino A — Peito, Tríceps & Ombro',
    dayOfWeek: 1,
    exercises: [
      {
        id: 'ex_supino_reto',
        name: 'Supino Reto com Barra',
        muscleGroup: 'Peito',
        restTimeSeconds: 90,
        sets: [
          { id: 's1', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's2', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's3', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's4', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's5', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_supino_inc',
        name: 'Supino Inclinado com Halteres',
        muscleGroup: 'Peito Superior',
        restTimeSeconds: 90,
        sets: [
          { id: 's6', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's7', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 's8', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 's9', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false }
        ]
      },
      {
        id: 'ex_crossover',
        name: 'Crossover na Polia Média',
        muscleGroup: 'Peito',
        restTimeSeconds: 60,
        sets: [
          { id: 's10', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's11', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's12', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false }
        ]
      },
      {
        id: 'ex_triceps_corda',
        name: 'Tríceps na Polia com Corda',
        muscleGroup: 'Tríceps',
        restTimeSeconds: 60,
        sets: [
          { id: 's13', type: 'warmup', targetReps: 10, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 's14', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's15', type: 'work', targetReps: 10, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 's16', type: 'top', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false }
        ]
      }
    ]
  },
  {
    id: 'routine_costas_biceps',
    name: 'Treino B — Costas, Bíceps & Posterior',
    dayOfWeek: 3,
    exercises: [
      {
        id: 'ex_puxada_alta',
        name: 'Puxada Alta Frontal (Pulldown)',
        muscleGroup: 'Costas',
        restTimeSeconds: 90,
        sets: [
          { id: 'sb1', type: 'warmup', targetReps: 12, unit: 'placas', restTimeSeconds: 60, completed: false },
          { id: 'sb2', type: 'feeder', targetReps: 6, unit: 'placas', restTimeSeconds: 90, completed: false },
          { id: 'sb3', type: 'work', targetReps: 8, unit: 'placas', restTimeSeconds: 120, completed: false },
          { id: 'sb4', type: 'top', targetReps: 6, unit: 'placas', restTimeSeconds: 150, completed: false }
        ]
      },
      {
        id: 'ex_remada_curvada',
        name: 'Remada Curvada com Barra',
        muscleGroup: 'Costas',
        restTimeSeconds: 120,
        sets: [
          { id: 'sb5', type: 'warmup', targetReps: 10, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 'sb6', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 'sb7', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 120, completed: false },
          { id: 'sb8', type: 'top', targetReps: 6, unit: 'kg', restTimeSeconds: 180, completed: false }
        ]
      },
      {
        id: 'ex_rosca_direta',
        name: 'Rosca Direta Barra W',
        muscleGroup: 'Bíceps',
        restTimeSeconds: 60,
        sets: [
          { id: 'sb9', type: 'warmup', targetReps: 12, unit: 'kg', restTimeSeconds: 45, completed: false },
          { id: 'sb10', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 75, completed: false },
          { id: 'sb11', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 90, completed: false }
        ]
      }
    ]
  },
  {
    id: 'routine_pernas',
    name: 'Treino C — Pernas Completo',
    dayOfWeek: 5,
    exercises: [
      {
        id: 'ex_agachamento',
        name: 'Agachamento Livre com Barra',
        muscleGroup: 'Quadríceps & Glúteos',
        restTimeSeconds: 150,
        sets: [
          { id: 'sc1', type: 'warmup', targetReps: 12, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 'sc2', type: 'feeder', targetReps: 5, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 'sc3', type: 'work', targetReps: 8, unit: 'kg', restTimeSeconds: 150, completed: false },
          { id: 'sc4', type: 'top', targetReps: 5, unit: 'kg', restTimeSeconds: 180, completed: false }
        ]
      },
      {
        id: 'ex_leg_press',
        name: 'Leg Press 45°',
        muscleGroup: 'Pernas',
        restTimeSeconds: 120,
        sets: [
          { id: 'sc5', type: 'warmup', targetReps: 12, unit: 'kg', restTimeSeconds: 60, completed: false },
          { id: 'sc6', type: 'feeder', targetReps: 6, unit: 'kg', restTimeSeconds: 90, completed: false },
          { id: 'sc7', type: 'work', targetReps: 10, unit: 'kg', restTimeSeconds: 120, completed: false },
          { id: 'sc8', type: 'top', targetReps: 8, unit: 'kg', restTimeSeconds: 180, completed: false }
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

    if (Array.isArray(cachedRoutines) && cachedRoutines.length > 0) {
      this.memoryCache.routines = cachedRoutines.map(r => this.normalizeRoutineSets(r));
    } else {
      await this.idbPut(STORE_CACHE, CACHE_KEYS.ROUTINES, this.memoryCache.routines);
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
