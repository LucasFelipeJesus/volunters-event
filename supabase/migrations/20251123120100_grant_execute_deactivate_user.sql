-- Migration: grant_execute_deactivate_user
-- Data: 2025-11-23

-- Concede permissões de EXECUTE na RPC de desativação para o role que a API usa.
-- Ajuste os roles conforme sua configuração (ex.: 'authenticated', 'anon').

GRANT EXECUTE ON FUNCTION public.deactivate_user_and_cancel_registrations(uuid) TO authenticated;

-- Caso a sua API chame via anon (não recomendado em produção), habilite também:
-- GRANT EXECUTE ON FUNCTION public.deactivate_user_and_cancel_registrations(uuid) TO anon;

-- Recomendações:
-- - Execute esta migration em staging e depois em produção.
-- - Conceda apenas ao role necessário (geralmente 'authenticated').