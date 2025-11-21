-- Migration: criar função RPC create_notification_rpc para inserir notificações com SECURITY DEFINER
-- Data: 2025-11-21

BEGIN;

-- Função RPC para criar notificações com privilégios do owner (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_notification_rpc(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_related_user_id uuid DEFAULT NULL,
  p_related_team_id uuid DEFAULT NULL
)
RETURNS SETOF public.notifications
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.notifications (
    user_id, title, message, related_user_id, related_team_id
  ) VALUES (
    p_user_id, p_title, p_message, p_related_user_id, p_related_team_id
  )
  RETURNING *;
$$;

-- Conceder execução da função para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_notification_rpc(
  uuid, text, text, uuid, uuid
) TO authenticated;

COMMIT;
