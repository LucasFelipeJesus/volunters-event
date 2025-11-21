-- Sistema de Avaliação Bidirecional
-- Voluntários avaliam Capitães e Capitães avaliam Voluntários

-- Criar tabela para voluntários avaliarem capitães
CREATE TABLE IF NOT EXISTS volunteer_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captain_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  volunteer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  
  -- Critérios específicos para avaliar capitães
  leadership_rating integer NOT NULL CHECK (leadership_rating >= 1 AND leadership_rating <= 5),
  communication_rating integer NOT NULL CHECK (communication_rating >= 1 AND communication_rating <= 5),
  support_rating integer NOT NULL CHECK (support_rating >= 1 AND support_rating <= 5),
  organization_rating integer NOT NULL CHECK (organization_rating >= 1 AND organization_rating <= 5),
  motivation_rating integer NOT NULL CHECK (motivation_rating >= 1 AND motivation_rating <= 5),
  problem_solving_rating integer NOT NULL CHECK (problem_solving_rating >= 1 AND problem_solving_rating <= 5),
  overall_rating integer NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  
  -- Campos de texto
  positive_aspects text,
  improvement_suggestions text,
  comments text,
  
  -- Perguntas específicas
  felt_supported boolean DEFAULT true,
  clear_instructions boolean DEFAULT true,
  would_work_again boolean DEFAULT true,
  recommend_captain boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Garantir uma avaliação por voluntário por capitão por evento
  UNIQUE(captain_id, volunteer_id, event_id, team_id)
);

-- Melhorar a tabela evaluations existente (capitães avaliando voluntários)
ALTER TABLE evaluations 
ADD COLUMN IF NOT EXISTS punctuality_rating integer CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
ADD COLUMN IF NOT EXISTS teamwork_rating integer CHECK (teamwork_rating >= 1 AND teamwork_rating <= 5),
ADD COLUMN IF NOT EXISTS communication_rating integer CHECK (communication_rating >= 1 AND communication_rating <= 5),
ADD COLUMN IF NOT EXISTS initiative_rating integer CHECK (initiative_rating >= 1 AND initiative_rating <= 5),
ADD COLUMN IF NOT EXISTS quality_of_work_rating integer CHECK (quality_of_work_rating >= 1 AND quality_of_work_rating <= 5),
ADD COLUMN IF NOT EXISTS reliability_rating integer CHECK (reliability_rating >= 1 AND reliability_rating <= 5),
ADD COLUMN IF NOT EXISTS positive_aspects text,
ADD COLUMN IF NOT EXISTS improvement_suggestions text,
ADD COLUMN IF NOT EXISTS specific_skills text[],
ADD COLUMN IF NOT EXISTS recommend_for_future boolean DEFAULT true;

-- View para detalhes das avaliações de capitães (feitas por voluntários)
CREATE OR REPLACE VIEW captain_evaluation_details AS
SELECT 
  ve.id as evaluation_id,
  ve.leadership_rating,
  ve.communication_rating,
  ve.support_rating,
  ve.organization_rating,
  ve.motivation_rating,
  ve.problem_solving_rating,
  ve.overall_rating,
  ve.positive_aspects,
  ve.improvement_suggestions,
  ve.comments,
  ve.felt_supported,
  ve.clear_instructions,
  ve.would_work_again,
  ve.recommend_captain,
  ve.created_at as evaluation_date,
  captain.id as captain_id,
  captain.full_name as captain_name,
  captain.email as captain_email,
  volunteer.id as volunteer_id,
  volunteer.full_name as volunteer_name,
  volunteer.email as volunteer_email,
  e.id as event_id,
  e.title as event_title,
  e.event_date,
  t.id as team_id,
  t.name as team_name
FROM volunteer_evaluations ve
JOIN users captain ON ve.captain_id = captain.id
JOIN users volunteer ON ve.volunteer_id = volunteer.id
JOIN events e ON ve.event_id = e.id
JOIN teams t ON ve.team_id = t.id;

-- Atualizar view de detalhes das avaliações de voluntários
DROP VIEW IF EXISTS evaluation_details;
CREATE OR REPLACE VIEW evaluation_details AS
SELECT 
  ev.id as evaluation_id,
  ev.rating as overall_rating,
  ev.punctuality_rating,
  ev.teamwork_rating,
  ev.communication_rating,
  ev.initiative_rating,
  ev.quality_of_work_rating,
  ev.reliability_rating,
  ev.comments,
  ev.positive_aspects,
  ev.improvement_suggestions,
  ev.skills_demonstrated,
  ev.specific_skills,
  ev.areas_for_improvement,
  ev.would_work_again,
  ev.recommend_for_future,
  ev.created_at as evaluation_date,
  volunteer.id as volunteer_id,
  volunteer.full_name as volunteer_name,
  volunteer.email as volunteer_email,
  captain.id as captain_id,
  captain.full_name as captain_name,
  e.id as event_id,
  e.title as event_title,
  e.event_date,
  t.id as team_id,
  t.name as team_name
FROM evaluations ev
JOIN users volunteer ON ev.volunteer_id = volunteer.id
JOIN users captain ON ev.captain_id = captain.id
JOIN events e ON ev.event_id = e.id
JOIN teams t ON ev.team_id = t.id;

-- View para estatísticas de capitães
CREATE OR REPLACE VIEW captain_evaluation_stats AS
SELECT 
    u.id as captain_id,
    u.full_name as captain_name,
    u.email as captain_email,
    COUNT(ve.id) as total_evaluations,
    ROUND(AVG(ve.overall_rating), 2) as avg_overall_rating,
    ROUND(AVG(ve.leadership_rating), 2) as avg_leadership,
    ROUND(AVG(ve.communication_rating), 2) as avg_communication,
    ROUND(AVG(ve.support_rating), 2) as avg_support,
    ROUND(AVG(ve.organization_rating), 2) as avg_organization,
    ROUND(AVG(ve.motivation_rating), 2) as avg_motivation,
    ROUND(AVG(ve.problem_solving_rating), 2) as avg_problem_solving,
    COUNT(CASE WHEN ve.felt_supported = true THEN 1 END) as volunteers_felt_supported,
    COUNT(CASE WHEN ve.clear_instructions = true THEN 1 END) as gave_clear_instructions,
    COUNT(CASE WHEN ve.would_work_again = true THEN 1 END) as would_work_again_count,
    COUNT(CASE WHEN ve.recommend_captain = true THEN 1 END) as recommendations,
    MAX(ve.created_at) as last_evaluation_date,
    MIN(ve.created_at) as first_evaluation_date
FROM users u
LEFT JOIN volunteer_evaluations ve ON u.id = ve.captain_id
WHERE u.role = 'captain'
GROUP BY u.id, u.full_name, u.email;

-- View para estatísticas de voluntários (atualizada)
CREATE OR REPLACE VIEW volunteer_evaluation_stats AS
SELECT 
    u.id as volunteer_id,
    u.full_name as volunteer_name,
    u.email as volunteer_email,
    COUNT(ev.id) as total_evaluations,
    ROUND(AVG(ev.rating), 2) as avg_overall_rating,
    ROUND(AVG(ev.punctuality_rating), 2) as avg_punctuality,
    ROUND(AVG(ev.teamwork_rating), 2) as avg_teamwork,
    ROUND(AVG(ev.communication_rating), 2) as avg_communication,
    ROUND(AVG(ev.initiative_rating), 2) as avg_initiative,
    ROUND(AVG(ev.quality_of_work_rating), 2) as avg_quality,
    ROUND(AVG(ev.reliability_rating), 2) as avg_reliability,
    COUNT(CASE WHEN ev.would_work_again = true THEN 1 END) as positive_recommendations,
    COUNT(CASE WHEN ev.recommend_for_future = true THEN 1 END) as future_recommendations,
    MAX(ev.created_at) as last_evaluation_date,
    MIN(ev.created_at) as first_evaluation_date
FROM users u
LEFT JOIN evaluations ev ON u.id = ev.volunteer_id
WHERE u.role = 'volunteer'
GROUP BY u.id, u.full_name, u.email;

-- Políticas de segurança para volunteer_evaluations
-- Voluntários podem criar avaliações de seus capitães
CREATE POLICY "Volunteers can create captain evaluations"
  ON volunteer_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    volunteer_id = auth.uid()
    AND 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'volunteer'
    )
  );

-- Voluntários podem ler suas próprias avaliações criadas
-- Capitães podem ler avaliações feitas sobre eles
-- Admins podem ler todas
CREATE POLICY "Stakeholders can read captain evaluations"
  ON volunteer_evaluations
  FOR SELECT
  TO authenticated
  USING (
    volunteer_id = auth.uid()
    OR captain_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Voluntários podem atualizar suas próprias avaliações (dentro de um prazo)
CREATE POLICY "Volunteers can update their captain evaluations"
  ON volunteer_evaluations
  FOR UPDATE
  TO authenticated
  USING (
    volunteer_id = auth.uid()
    AND created_at > (now() - interval '7 days') -- Permite edição por 7 dias
  );

-- Função para verificar se um voluntário pode avaliar um capitão
CREATE OR REPLACE FUNCTION can_volunteer_evaluate_captain(
    volunteer_id_param uuid,
    captain_id_param uuid,
    event_id_param uuid,
    team_id_param uuid
) RETURNS boolean AS $$
DECLARE
    can_evaluate boolean := false;
BEGIN
    -- Verificar se o voluntário foi membro da equipe do capitão no evento
      SELECT EXISTS(
        SELECT 1
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = volunteer_id_param
        AND t.captain_id = captain_id_param
        AND t.event_id = event_id_param
        AND t.id = team_id_param
        AND tm.role_in_team = 'volunteer'
    ) INTO can_evaluate;
    
    RETURN can_evaluate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter equipes onde o voluntário pode avaliar o capitão
CREATE OR REPLACE FUNCTION get_evaluable_captains_for_volunteer(volunteer_id_param uuid)
RETURNS TABLE(
    event_id uuid,
    event_title text,
    event_date date,
    team_id uuid,
    team_name text,
    captain_id uuid,
    captain_name text,
    captain_email text,
    already_evaluated boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as event_id,
        e.title as event_title,
        e.event_date::date,
        t.id as team_id,
        t.name as team_name,
        c.id as captain_id,
        c.full_name as captain_name,
        c.email as captain_email,
        EXISTS(
            SELECT 1 FROM volunteer_evaluations ve 
            WHERE ve.volunteer_id = volunteer_id_param 
            AND ve.captain_id = c.id 
            AND ve.event_id = e.id 
            AND ve.team_id = t.id
        ) as already_evaluated
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN events e ON t.event_id = e.id
    JOIN users c ON t.captain_id = c.id
    WHERE tm.user_id = volunteer_id_param
    AND tm.role_in_team = 'volunteer'
    AND e.status = 'completed' -- Só permite avaliar eventos finalizados
    ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar SECURITY DEFINER e ajustar owner para funções que leem a tabela users
ALTER FUNCTION can_volunteer_evaluate_captain(uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION get_evaluable_captains_for_volunteer(uuid) OWNER TO postgres;
 
-- Função RPC para capitães obterem membros (voluntários) das suas equipes em eventos finalizados
CREATE OR REPLACE FUNCTION get_team_members_for_captain(captain_id_param uuid)
RETURNS TABLE(
  event_id uuid,
  event_title text,
  event_date date,
  team_id uuid,
  team_name text,
  member_id uuid,
  member_full_name text,
  member_email text,
  member_role text,
  member_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.event_date::date,
    t.id,
    t.name,
    u.id,
    u.full_name,
    u.email,
    tm.role_in_team,
    tm.status
  FROM teams t
  JOIN events e ON t.event_id = e.id
  JOIN team_members tm ON tm.team_id = t.id
  JOIN users u ON u.id = tm.user_id
  WHERE t.captain_id = captain_id_param
    AND (e.status = 'completed' OR e.status = 'finished')
    AND tm.role_in_team = 'volunteer'
  ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION get_team_members_for_captain(uuid) OWNER TO postgres;
-- Comentários nas tabelas para documentação
COMMENT ON TABLE volunteer_evaluations IS 'Avaliações de capitães feitas por voluntários após eventos';
COMMENT ON COLUMN volunteer_evaluations.leadership_rating IS 'Avaliação de liderança de 1 a 5';
COMMENT ON COLUMN volunteer_evaluations.communication_rating IS 'Avaliação de comunicação de 1 a 5';
COMMENT ON COLUMN volunteer_evaluations.support_rating IS 'Avaliação de suporte oferecido de 1 a 5';
COMMENT ON COLUMN volunteer_evaluations.organization_rating IS 'Avaliação de organização de 1 a 5';
COMMENT ON COLUMN volunteer_evaluations.motivation_rating IS 'Avaliação de motivação da equipe de 1 a 5';
COMMENT ON COLUMN volunteer_evaluations.problem_solving_rating IS 'Avaliação de resolução de problemas de 1 a 5';
COMMENT ON COLUMN volunteer_evaluations.felt_supported IS 'Se o voluntário se sentiu apoiado pelo capitão';
COMMENT ON COLUMN volunteer_evaluations.clear_instructions IS 'Se o capitão deu instruções claras';
COMMENT ON COLUMN volunteer_evaluations.recommend_captain IS 'Se recomendaria o capitão para outros voluntários';