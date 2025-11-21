-- Migration: Recria a view admin_evaluation_details e garante permissões de SELECT
-- Execute no Supabase SQL Editor se preferir aplicar manualmente

CREATE OR REPLACE VIEW public.admin_evaluation_details AS
SELECT 
  ae.id as evaluation_id,
  ae.leadership_rating,
  ae.team_management_rating,
  ae.communication_rating,
  ae.overall_rating,
  ae.comments,
  ae.strengths,
  ae.areas_for_improvement,
  ae.promotion_ready,
  ae.created_at as evaluation_date,
  captain.id as captain_id,
  captain.full_name as captain_name,
  captain.email as captain_email,
  admin_user.id as admin_id,
  admin_user.full_name as admin_name,
  e.id as event_id,
  e.title as event_title,
  e.event_date,
  t.id as team_id,
  t.name as team_name
FROM admin_evaluations ae
JOIN users captain ON ae.captain_id = captain.id
JOIN users admin_user ON ae.admin_id = admin_user.id
JOIN events e ON ae.event_id = e.id
JOIN teams t ON ae.team_id = t.id;

-- Garantir SELECT para roles API (ajuste conforme necessidade)
GRANT SELECT ON public.admin_evaluation_details TO anon, authenticated;

-- Observação: se o endpoint REST ainda retornar 404 após criar a view,
-- verifique em Supabase Dashboard -> Settings -> API se o schema `public` está exposto ao REST.
