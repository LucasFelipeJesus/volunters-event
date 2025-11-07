-- SISTEMA DE DEMOÇÃO AUTOMÁTICA DE CAPITÃES
-- Este script implementa o sistema que demove capitães de volta a voluntários após eventos finalizados

-- 1. FUNÇÃO PARA DEMOVER CAPITÃES DE VOLTA A VOLUNTÁRIOS
CREATE OR REPLACE FUNCTION demote_captains_after_event(event_id_param uuid)
RETURNS integer AS $$
DECLARE
  demoted_count integer := 0;
  captain_record record;
BEGIN
  -- Buscar todos os capitães que participaram do evento (como líderes de equipe)
  FOR captain_record IN 
    SELECT DISTINCT u.id, u.full_name, u.email
    FROM users u
    JOIN teams t ON t.captain_id = u.id
    WHERE t.event_id = event_id_param 
      AND u.role = 'captain'
      AND u.role != 'admin' -- Não demover admins
  LOOP
    -- Demover capitão de volta a voluntário
    UPDATE users 
    SET role = 'volunteer'
    WHERE id = captain_record.id;
    
    -- Criar notificação informando sobre a demoção
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      captain_record.id,
      'Retorno ao Status de Voluntário',
      'Após a finalização do evento, você retornou ao status de voluntário. Aguarde uma nova promoção do administrador para liderar novamente.',
      'info'
    );
    
    demoted_count := demoted_count + 1;
    
    -- Log da demoção
    RAISE NOTICE 'Capitão % (%) foi demovido de volta a voluntário', captain_record.full_name, captain_record.email;
  END LOOP;
  
  RETURN demoted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNÇÃO PARA DEMOVER UM USUÁRIO ESPECÍFICO (PARA ADMINS)
CREATE OR REPLACE FUNCTION demote_to_volunteer(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  -- Verificar se o usuário existe e é capitão
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id_param AND role = 'captain') THEN
    RAISE EXCEPTION 'Usuário não encontrado ou não é capitão';
  END IF;
  
  -- Demover de capitão para voluntário
  UPDATE users 
  SET role = 'volunteer'
  WHERE id = user_id_param AND role = 'captain';
  
  IF FOUND THEN
    -- Criar notificação
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      user_id_param,
      'Status Alterado para Voluntário',
      'Seu status foi alterado para voluntário pelo administrador.',
      'info'
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER PARA EXECUTAR DEMOÇÃO AUTOMÁTICA QUANDO EVENTO É COMPLETADO
CREATE OR REPLACE FUNCTION handle_event_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o evento mudou para 'completed' e antes não estava completo
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Executar demoção automática dos capitães deste evento
    PERFORM demote_captains_after_event(NEW.id);
    
    -- Log da execução
    RAISE NOTICE 'Evento % completado - capitães foram demovidos automaticamente', NEW.title;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger na tabela events
DROP TRIGGER IF EXISTS trigger_event_completion ON events;
CREATE TRIGGER trigger_event_completion
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION handle_event_completion();

-- 4. FUNÇÃO PARA ADMINS PROMOVEREM USUÁRIOS (MELHORADA)
CREATE OR REPLACE FUNCTION promote_to_captain(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  -- Verificar se o usuário existe e é voluntário
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id_param AND role = 'volunteer') THEN
    RAISE EXCEPTION 'Usuário não encontrado ou não é voluntário';
  END IF;
  
  -- Promover de voluntário para capitão
  UPDATE users 
  SET role = 'captain'
  WHERE id = user_id_param AND role = 'volunteer';
  
  IF FOUND THEN
    -- Criar notificação
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNÇÃO PARA LISTAR CAPITÃES ATIVOS (PARA INTERFACE ADMIN)
CREATE OR REPLACE FUNCTION get_current_captains()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  created_at timestamp with time zone,
  active_teams integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.created_at,
    COALESCE(active_team_count.count, 0)::integer as active_teams
  FROM users u
  LEFT JOIN (
    SELECT captain_id, COUNT(*) as count
    FROM teams t
    JOIN events e ON t.event_id = e.id
    WHERE e.status IN ('published', 'in_progress')
    GROUP BY captain_id
  ) active_team_count ON u.id = active_team_count.captain_id
  WHERE u.role = 'captain'
  ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNÇÃO PARA EXECUTAR DEMOÇÃO MANUAL DE TODOS OS CAPITÃES (EMERGÊNCIA)
CREATE OR REPLACE FUNCTION demote_all_captains_except_admin()
RETURNS integer AS $$
DECLARE
  demoted_count integer := 0;
BEGIN
  -- Demover todos os capitães exceto admins
  UPDATE users 
  SET role = 'volunteer'
  WHERE role = 'captain';
  
  GET DIAGNOSTICS demoted_count = ROW_COUNT;
  
  -- Criar notificações para todos os demovidos
  INSERT INTO notifications (user_id, title, message, type)
  SELECT 
    id,
    'Status Alterado para Voluntário',
    'Seu status foi alterado para voluntário pelo administrador.',
    'info'
  FROM users 
  WHERE role = 'volunteer' 
    AND id IN (
      SELECT id FROM users WHERE role = 'captain' 
    );
  
  RETURN demoted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMENTÁRIOS E INSTRUÇÕES DE USO:
-- 
-- Para testar as funções:
-- SELECT demote_captains_after_event('event-id-aqui'); -- Demover capitães de um evento específico
-- SELECT demote_to_volunteer('user-id-aqui'); -- Demover usuário específico
-- SELECT promote_to_captain('user-id-aqui'); -- Promover usuário específico
-- SELECT * FROM get_current_captains(); -- Listar capitães ativos
-- SELECT demote_all_captains_except_admin(); -- EMERGÊNCIA: demover todos os capitães
--
-- O trigger handle_event_completion() executa automaticamente quando um evento muda para 'completed'