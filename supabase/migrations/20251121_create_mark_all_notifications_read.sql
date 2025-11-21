-- Migration: criar RPC mark_all_notifications_read para marcar todas notificações como lidas para um usuário
-- Data: 2025-11-21

BEGIN;

-- Cria função que marca todas as notificações como lidas para um usuário e retorna a quantidade atualizada
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = p_user_id AND read = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder execução para role authenticated (ajuste conforme suas políticas)
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO authenticated;

COMMIT;
