-- =============================================================================
-- WORKOUT APP — Schema SQL para Supabase (PostgreSQL + RLS)
-- Cole e execute este script no SQL Editor do seu projeto no Supabase.
-- =============================================================================

-- 1. Tabela de Rotinas Programadas e Configurações de Séries
CREATE TABLE IF NOT EXISTS public.routines (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL DEFAULT 1,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON public.routines(user_id);

-- Habilita Row Level Security (RLS)
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança para `routines` (cada usuário só acessa suas próprias rotinas)
DROP POLICY IF EXISTS "Users can view own routines" ON public.routines;
CREATE POLICY "Users can view own routines"
  ON public.routines FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own routines" ON public.routines;
CREATE POLICY "Users can insert own routines"
  ON public.routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routines" ON public.routines;
CREATE POLICY "Users can update own routines"
  ON public.routines FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routines" ON public.routines;
CREATE POLICY "Users can delete own routines"
  ON public.routines FOR DELETE
  USING (auth.uid() = user_id);


-- 2. Tabela de Histórico de Treinos Concluídos (Workout Logs & PRs)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id TEXT NOT NULL,
  routine_name TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  total_volume_kg NUMERIC NOT NULL DEFAULT 0,
  completed_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para histórico cronológico por usuário
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON public.workout_logs(user_id, date DESC);

-- Habilita Row Level Security (RLS)
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança para `workout_logs`
DROP POLICY IF EXISTS "Users can view own workout_logs" ON public.workout_logs;
CREATE POLICY "Users can view own workout_logs"
  ON public.workout_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workout_logs" ON public.workout_logs;
CREATE POLICY "Users can insert own workout_logs"
  ON public.workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workout_logs" ON public.workout_logs;
CREATE POLICY "Users can update own workout_logs"
  ON public.workout_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workout_logs" ON public.workout_logs;
CREATE POLICY "Users can delete own workout_logs"
  ON public.workout_logs FOR DELETE
  USING (auth.uid() = user_id);
