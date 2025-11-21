-- Migration: Corrige policies que faziam SELECT em `users` (causavam recursão RLS)
-- Substitui verificações de admin que consultavam `users` por leitura do claim JWT 'user_role'
-- Execute este arquivo no Supabase SQL Editor

-- 1) volunteer_evaluations: substituir checagem de admin
DROP POLICY IF EXISTS "Stakeholders can read captain evaluations" ON public.volunteer_evaluations;
CREATE POLICY "Stakeholders can read captain evaluations"
  ON public.volunteer_evaluations
  FOR SELECT
  TO authenticated
  USING (
    volunteer_id = auth.uid()
    OR captain_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

-- 2) teams: Team members can read their teams
DROP POLICY IF EXISTS "Team members can read their teams" ON public.teams;
CREATE POLICY "Team members can read their teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid()
    )
    OR captain_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

-- 3) teams: Team members can read team_details_on_teams
DROP POLICY IF EXISTS "Team members can read team_details_on_teams" ON public.teams;
CREATE POLICY "Team members can read team_details_on_teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid() AND tm.status = 'active'
    )
    OR captain_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

-- 4) team_members: Team members can read team memberships
DROP POLICY IF EXISTS "Team members can read team memberships" ON public.team_members;
CREATE POLICY "Team members can read team memberships"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm2 WHERE tm2.team_id = team_members.team_id AND tm2.user_id = auth.uid() AND tm2.status = 'active'
    )
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

-- 5) volunteer_evaluations: Volunteers can create captain evaluations (mantém permissões originais)
-- Se existir uma policy para criação, mantemos/não alteramos. Se precisar criar:
DROP POLICY IF EXISTS "Volunteers can create captain evaluations" ON public.volunteer_evaluations;
CREATE POLICY "Volunteers can create captain evaluations"
  ON public.volunteer_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (volunteer_id = auth.uid());

-- Observação: Esta migração evita qualquer SELECT direto em `users` dentro de policies,
-- utilizando claims JWT para detecção de admin. Garanta que os JWTs contenham o claim
-- 'user_role' (ex.: 'admin') — as migrations `FIX_RLS_TIMEOUT.sql` / `FIX_RLS_NO_AUTH_SCHEMA.sql`
-- do repositório já oferecem opções para popular esse claim via trigger/função.

-- Fim da migração
