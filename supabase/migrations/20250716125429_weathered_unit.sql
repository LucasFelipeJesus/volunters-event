/*
  # Sistema de Gerenciamento de Voluntários e Eventos

  1. Tabelas Principais
    - `users` - Perfis de usuários (volunteer, captain, admin)
    - `events` - Eventos criados pelos administradores
    - `teams` - Equipes montadas pelos administradores para eventos
    - `team_members` - Membros das equipes (voluntários e capitães)
    - `evaluations` - Avaliações de voluntários pelos capitães
    - `admin_evaluations` - Avaliações de capitães pelos administradores
    - `notifications` - Sistema de notificações

  2. Hierarquia de Usuários
    - Admin: Gerencia eventos, equipes e usuários
    - Captain: Lidera equipe e avalia voluntários
    - Volunteer: Participa de eventos e equipes

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas baseadas em roles e hierarquia
*/

-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'captain', 'admin')),
  bio text,
  skills text[],
  availability text[],
  is_first_login boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de eventos
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_teams integer NOT NULL DEFAULT 1,
  current_teams integer NOT NULL DEFAULT 0,
  admin_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
  requirements text,
  category text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de equipes
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  captain_id uuid REFERENCES users(id) ON DELETE SET NULL,
  max_volunteers integer NOT NULL DEFAULT 5,
  current_volunteers integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'complete', 'active', 'finished')),
  created_by uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de membros da equipe
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role_in_team text NOT NULL DEFAULT 'volunteer' CHECK (role_in_team IN ('captain', 'volunteer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  UNIQUE(team_id, user_id)
);

-- Criar tabela de avaliações de voluntários (feitas pelos capitães)
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  captain_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments text,
  skills_demonstrated text[],
  areas_for_improvement text,
  would_work_again boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(volunteer_id, captain_id, event_id)
);

-- Criar tabela de avaliações de capitães (feitas pelos administradores)
CREATE TABLE IF NOT EXISTS admin_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captain_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  leadership_rating integer NOT NULL CHECK (leadership_rating >= 1 AND leadership_rating <= 5),
  team_management_rating integer NOT NULL CHECK (team_management_rating >= 1 AND team_management_rating <= 5),
  communication_rating integer NOT NULL CHECK (communication_rating >= 1 AND communication_rating <= 5),
  overall_rating integer NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  comments text,
  strengths text,
  areas_for_improvement text,
  promotion_ready boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(captain_id, admin_id, event_id)
);

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'evaluation')),
  related_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  related_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para users
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update user roles"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Políticas para events
CREATE POLICY "Everyone can read published events"
  ON events
  FOR SELECT
  TO authenticated
  USING (status IN ('published', 'in_progress'));

CREATE POLICY "Admins can manage all events"
  ON events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can read their team memberships" ON team_members;
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = teams.id 
      AND team_members.user_id = auth.uid()
    )
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
DROP POLICY IF EXISTS "Admins can manage team members" ON team_members;
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Políticas para team_members
DROP POLICY IF EXISTS "Everyone can read published events" ON events;
CREATE POLICY "Users can read their team memberships"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
DROP POLICY IF EXISTS "Admins can manage all events" ON events;
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'captain')
    )
  );

CREATE POLICY "Admins can manage team members"
  ON team_members
DROP POLICY IF EXISTS "Admins can create events" ON events;
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can leave teams"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Políticas para evaluations
DROP POLICY IF EXISTS "Team members can read their teams" ON teams;
CREATE POLICY "Volunteers can read their evaluations"
  ON evaluations
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

CREATE POLICY "Captains can create evaluations"
  ON evaluations
DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
  FOR INSERT
  TO authenticated
  WITH CHECK (
    captain_id = auth.uid()
    AND 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'captain'
    )
  );

CREATE POLICY "Captains can update their evaluations"
  ON evaluations
  FOR UPDATE
  TO authenticated
  USING (
    captain_id = auth.uid()
    AND 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'captain'
    )
  );

-- Políticas para admin_evaluations
CREATE POLICY "Captains and admins can read captain evaluations"
  ON admin_evaluations
  FOR SELECT
  TO authenticated
  USING (
    captain_id = auth.uid()
    OR admin_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create captain evaluations"
  ON admin_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update captain evaluations"
  ON admin_evaluations
  FOR UPDATE
  TO authenticated
  USING (
    admin_id = auth.uid()
    AND 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Políticas para notifications
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
DROP POLICY IF EXISTS "Admins can read all users" ON users;
  TO authenticated
  WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';
DROP POLICY IF EXISTS "Admins can update user roles" ON users;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_admin_evaluations_updated_at BEFORE UPDATE ON admin_evaluations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Função para atualizar contador de voluntários na equipe
CREATE OR REPLACE FUNCTION update_team_volunteers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role_in_team = 'volunteer' AND NEW.status = 'active' THEN
    UPDATE teams 
    SET current_volunteers = current_volunteers + 1 
    WHERE id = NEW.team_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.role_in_team = 'volunteer' THEN
    UPDATE teams 
    SET current_volunteers = current_volunteers - 1 
    WHERE id = OLD.team_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.role_in_team = 'volunteer' THEN
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE teams 
      SET current_volunteers = current_volunteers - 1 
      WHERE id = NEW.team_id;
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE teams 
      SET current_volunteers = current_volunteers + 1 
      WHERE id = NEW.team_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger para atualizar contador de voluntários automaticamente
CREATE TRIGGER update_team_volunteers_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE PROCEDURE update_team_volunteers_count();

-- Função para atualizar contador de equipes no evento
CREATE OR REPLACE FUNCTION update_event_teams_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events 
    SET current_teams = current_teams + 1 
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events 
    SET current_teams = current_teams - 1 
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger para atualizar contador de equipes automaticamente
CREATE TRIGGER update_event_teams_count_trigger
  AFTER INSERT OR DELETE ON teams
  FOR EACH ROW EXECUTE PROCEDURE update_event_teams_count();

-- Função para criar notificação quando uma avaliação é feita
CREATE OR REPLACE FUNCTION create_evaluation_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    related_event_id
  ) VALUES (
    NEW.volunteer_id,
    'Nova Avaliação Recebida',
    'Você recebeu uma nova avaliação do seu capitão.',
    'evaluation',
    NEW.event_id
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para notificar sobre avaliações
CREATE TRIGGER evaluation_notification_trigger
  AFTER INSERT ON evaluations
  FOR EACH ROW EXECUTE PROCEDURE create_evaluation_notification();

-- Função para criar notificação quando uma avaliação de capitão é feita
CREATE OR REPLACE FUNCTION create_captain_evaluation_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    related_event_id
  ) VALUES (
    NEW.captain_id,
    'Nova Avaliação de Liderança',
    'Você recebeu uma nova avaliação de liderança do administrador.',
    'evaluation',
    NEW.event_id
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para notificar sobre avaliações de capitão
CREATE TRIGGER captain_evaluation_notification_trigger
  AFTER INSERT ON admin_evaluations
  FOR EACH ROW EXECUTE PROCEDURE create_captain_evaluation_notification();

-- Função para criar o administrador inicial
CREATE OR REPLACE FUNCTION setup_admin_profile(admin_user_id uuid, admin_email text, admin_name text)
RETURNS boolean AS $$
BEGIN
  -- Inserir ou atualizar perfil do administrador
  INSERT INTO users (id, email, full_name, role, is_first_login, is_active)
  VALUES (
    admin_user_id,
    admin_email,
    admin_name,
    'admin',
    true,
    true
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = 'admin',
    is_active = true,
    updated_at = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ language 'plpgsql';

-- Função para criar perfil automaticamente quando usuário é criado via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role, is_first_login, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'volunteer',
    true,
    true
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Se falhar, não impede a criação do usuário na auth
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Views para facilitar consultas

-- View para histórico de eventos do usuário
CREATE VIEW user_event_history AS
SELECT 
  u.id as user_id,
  u.full_name,
  e.id as event_id,
  e.title as event_title,
  e.event_date,
  e.start_time,
  e.end_time,
  e.location,
  e.status as event_status,
  t.id as team_id,
  t.name as team_name,
  tm.role_in_team,
  tm.status as membership_status,
  tm.joined_at,
  tm.left_at
FROM users u
JOIN team_members tm ON u.id = tm.user_id
JOIN teams t ON tm.team_id = t.id
JOIN events e ON t.event_id = e.id
ORDER BY e.event_date DESC;

-- View para equipes e seus membros
CREATE VIEW team_details AS
SELECT 
  t.id as team_id,
  t.name as team_name,
  t.event_id,
  e.title as event_title,
  e.event_date,
  t.captain_id,
  captain.full_name as captain_name,
  t.max_volunteers,
  t.current_volunteers,
  t.status as team_status,
  array_agg(
    json_build_object(
      'user_id', tm.user_id,
      'full_name', u.full_name,
      'role_in_team', tm.role_in_team,
      'status', tm.status,
      'joined_at', tm.joined_at
    )
  ) FILTER (WHERE tm.user_id IS NOT NULL) as members
FROM teams t
LEFT JOIN events e ON t.event_id = e.id
LEFT JOIN users captain ON t.captain_id = captain.id
LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.status = 'active'
LEFT JOIN users u ON tm.user_id = u.id
GROUP BY t.id, t.name, t.event_id, e.title, e.event_date, t.captain_id, captain.full_name, t.max_volunteers, t.current_volunteers, t.status;

-- View para avaliações com detalhes completos
CREATE VIEW evaluation_details AS
SELECT 
  ev.id as evaluation_id,
  ev.rating,
  ev.comments,
  ev.skills_demonstrated,
  ev.areas_for_improvement,
  ev.would_work_again,
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

-- View para avaliações de administradores com detalhes completos
CREATE VIEW admin_evaluation_details AS
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

-- Função para promover usuário a capitão
CREATE OR REPLACE FUNCTION promote_to_captain(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE users 
  SET role = 'captain'
  WHERE id = user_id_param AND role = 'volunteer';
  
  IF FOUND THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      user_id_param,
      'Promoção a Capitão',
      'Parabéns! Você foi promovido a Capitão. Agora você pode liderar equipes e avaliar voluntários.',
      'success'
    );
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ language 'plpgsql';

-- Função para remover usuário de equipe
CREATE OR REPLACE FUNCTION leave_team(user_id_param uuid, team_id_param uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE team_members 
  SET status = 'inactive', left_at = now()
  WHERE user_id = user_id_param AND team_id = team_id_param AND status = 'active';
  
  IF FOUND THEN
    INSERT INTO notifications (user_id, title, message, type, related_team_id)
    VALUES (
      user_id_param,
      'Saída da Equipe',
      'Você saiu da equipe com sucesso.',
      'info',
      team_id_param
    );
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ language 'plpgsql';

-- Função para deletar conta do usuário
CREATE OR REPLACE FUNCTION delete_user_account(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  -- Remove o usuário de todas as equipes ativas
  UPDATE team_members 
  SET status = 'removed', left_at = now()
  WHERE user_id = user_id_param AND status = 'active';
  
  -- Marca o usuário como inativo
  UPDATE users 
  SET is_active = false, email = email || '_deleted_' || extract(epoch from now())
  WHERE id = user_id_param;
  
  IF FOUND THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ language 'plpgsql';

-- Função para obter estatísticas do usuário
CREATE OR REPLACE FUNCTION get_user_stats(user_id_param uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_events', COUNT(DISTINCT t.event_id),
    'completed_events', COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN t.event_id END),
    'average_rating', ROUND(AVG(ev.rating), 2),
    'total_evaluations', COUNT(ev.id),
    'teams_participated', COUNT(DISTINCT tm.team_id)
  ) INTO result
  FROM team_members tm
  LEFT JOIN teams t ON tm.team_id = t.id
  LEFT JOIN events e ON t.event_id = e.id
  LEFT JOIN evaluations ev ON ev.volunteer_id = user_id_param
  WHERE tm.user_id = user_id_param;
  
  RETURN result;
END;
$$ language 'plpgsql';

-- Índices para otimização de performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_volunteer_id ON evaluations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_captain_id ON evaluations(captain_id);
CREATE INDEX IF NOT EXISTS idx_admin_evaluations_captain_id ON admin_evaluations(captain_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);