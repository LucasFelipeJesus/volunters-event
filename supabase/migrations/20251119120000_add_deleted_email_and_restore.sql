-- Migration: adicionar coluna deleted_email e funções de soft-delete/restore
-- Data: 2025-11-19

BEGIN;

-- 1) coluna para guardar email original ao fazer soft-delete
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS deleted_email text;

-- 2) Atualizar a função delete_user_account para preservar o email original
CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  -- Remove o usuário de todas as equipes ativas
  UPDATE public.team_members
  SET status = 'removed', left_at = now()
  WHERE user_id = user_id_param AND status = 'active';

  -- Guarda o email original (se ainda não guardado) e define um placeholder único
  UPDATE public.users
  SET deleted_email = COALESCE(deleted_email, email),
      email = 'deleted+' || user_id_param::text || '@deleted.local',
      is_active = false
  WHERE id = user_id_param;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Log amigável para debugging; não propagar erro para o cliente
  RAISE NOTICE 'delete_user_account failed for %: %', user_id_param, SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.delete_user_account(uuid) OWNER TO postgres;

-- 3) Função para restaurar email e reativar usuário de forma segura
CREATE OR REPLACE FUNCTION public.restore_user_account(user_id_param uuid)
RETURNS boolean AS $$
DECLARE
  original_email text;
  conflict_count int;
BEGIN
  -- Garantir search_path explícito (reduz confusões em ambientes diferentes)
  PERFORM set_config('search_path', 'public', true);

  SELECT deleted_email INTO original_email FROM public.users WHERE id = user_id_param;

  IF original_email IS NULL THEN
    -- Não há email salvo: apenas reativa
    UPDATE public.users
    SET is_active = true
    WHERE id = user_id_param;

    RETURN FOUND;
  END IF;

  -- Tentar restaurar o email original; tratar conflito de unicidade
  BEGIN
    UPDATE public.users
    SET email = original_email,
        deleted_email = NULL,
        is_active = true
    WHERE id = user_id_param;

    RETURN FOUND;
  EXCEPTION WHEN unique_violation THEN
    -- Outro usuário já ocupa o email original; reativar mantendo placeholder
    UPDATE public.users
    SET is_active = true
    WHERE id = user_id_param;

    RAISE NOTICE 'restore_user_account: email % já em uso, usuário % reativado mantendo placeholder', original_email, user_id_param;
    RETURN TRUE;
  END;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'restore_user_account failed for %: %', user_id_param, SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.restore_user_account(uuid) OWNER TO postgres;

COMMIT;
