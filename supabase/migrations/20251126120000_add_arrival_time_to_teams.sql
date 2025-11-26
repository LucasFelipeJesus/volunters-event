-- Migration: adicionar coluna arrival_time na tabela teams
-- Adiciona um campo do tipo TIME para registrar o horário de chegada da equipe
BEGIN;

ALTER TABLE IF EXISTS public.teams
    ADD COLUMN IF NOT EXISTS arrival_time TIME;

COMMIT;

-- FIM
