-- Migration: revert_deactivate_user_and_cancel_registrations
-- Data: 2025-11-23

-- Esta migration restaura a versão original da função `deactivate_user_and_cancel_registrations`.
-- Use em emergência se precisar voltar ao comportamento anterior.

CREATE OR REPLACE FUNCTION public.deactivate_user_and_cancel_registrations(user_id_param uuid)
RETURNS boolean AS $$
DECLARE
  v_full_name text;
BEGIN
  -- Capturar nome para notificações
  SELECT full_name INTO v_full_name FROM users WHERE id = user_id_param;

  -- Cancelar inscrições ativas (pending/confirmed)
  UPDATE event_registrations
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = user_id_param
    AND status IN ('pending', 'confirmed');

  -- Remover usuário de equipes ativas (marcar removed)
  UPDATE team_members
  SET status = 'removed', left_at = now()
  WHERE user_id = user_id_param
    AND status = 'active';

  -- Marcar usuário como inativo
  UPDATE users
  SET is_active = false, updated_at = now()
  WHERE id = user_id_param;

  -- Notificar administradores sobre a desativação (se tabela notifications existir)
  BEGIN
    INSERT INTO notifications (user_id, title, message, type, related_user_id, created_at)
    SELECT id,
           'Usuário desativado',
           'O usuário "' || COALESCE(v_full_name, '') || '" foi desativado.',
           'info',
           user_id_param,
           now()
    FROM users
    WHERE role = 'admin' AND is_active = true;
  EXCEPTION WHEN OTHERS THEN
    -- Se não houver tabela de notificações ou houver restrição, não falhar a função
    RAISE NOTICE 'notifications insert skipped: %', SQLERRM;
  END;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'deactivate_user_and_cancel_registrations failed for %: %', user_id_param, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.deactivate_user_and_cancel_registrations(uuid) OWNER TO postgres;

-- IMPORTANTE:
-- Após aplicar esta migration, teste a RPC e verifique se o comportamento desejado foi restaurado.