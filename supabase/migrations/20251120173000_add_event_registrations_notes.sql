-- Migration: adiciona coluna `notes` à tabela event_registrations
-- Gerado automaticamente para permitir persistência de respostas especiais (ex.: __vehicle_info)

BEGIN;

ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;
