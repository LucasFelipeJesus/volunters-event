-- Migration: criar RPC finalize_expired_events
-- Data: 2025-11-24
-- Objetivo: Atualizar eventos cuja data já passou para status 'completed' e cancelar inscrições 'pending'

BEGIN;

-- Função para finalizar eventos expirados ou um evento específico
CREATE OR REPLACE FUNCTION public.finalize_expired_events(p_event_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_registrations integer := 0;
BEGIN
    -- Atualiza eventos: se p_event_id for NULL, finaliza todos eventos com data passada; caso contrário, finaliza o evento especificado
    WITH updated_events AS (
        UPDATE public.events e
        SET status = 'completed', updated_at = now()
        WHERE (
            (p_event_id IS NULL AND e.event_date < now()::date)
            OR (p_event_id IS NOT NULL AND e.id = p_event_id)
        )
        AND e.status IN ('published', 'in_progress')
        RETURNING id
    )
    -- Cancelar inscrições pendentes para eventos finalizados
    UPDATE public.event_registrations er
    SET status = 'cancelled', updated_at = now()
    FROM updated_events u
    WHERE er.event_id = u.id AND er.status = 'pending';

    GET DIAGNOSTICS affected_registrations = ROW_COUNT; -- número de inscrições atualizadas

    RAISE NOTICE 'finalize_expired_events: inscrições atualizadas = %', affected_registrations;
    RETURN affected_registrations;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'finalize_expired_events erro: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Permitir execução por usuários autenticados (se desejar permitir que admins chamem via client)
GRANT EXECUTE ON FUNCTION public.finalize_expired_events(uuid) TO authenticated;

COMMIT;

-- Observações:
-- - Esta função é idempotente: eventos já com status diferente não serão reprocessados.
-- - Recomenda-se agendar a execução diária desta RPC (ex: Supabase Scheduled Function ou cron externo).
-- - Para finalizar um evento específico (ex.: quando um admin acessa a página), invoque: SELECT public.finalize_expired_events('<event_uuid>');
