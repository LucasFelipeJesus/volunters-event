-- Migration: adicionar related_user_id à tabela notifications
-- Data: 2025-11-21

BEGIN;

-- 1) Adiciona coluna related_user_id (UUID) que pode ser nula
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_user_id uuid;

-- 2) Adiciona constraint de chave estrangeira para users(id)
-- Criar constraint de FK apenas se ainda não existir (uso de DO block para compatibilidade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_related_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_related_user_id_fkey FOREIGN KEY (related_user_id) REFERENCES public.users(id) ON DELETE SET NULL';
  END IF;
END$$;

-- 3) Cria índice para consultas por related_user_id
CREATE INDEX IF NOT EXISTS idx_notifications_related_user_id ON public.notifications(related_user_id);

COMMIT;
