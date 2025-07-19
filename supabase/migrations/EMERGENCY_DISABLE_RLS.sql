-- ================================================================
-- CORREÇÃO DE EMERGÊNCIA - DESABILITAR RLS TEMPORARIAMENTE
-- ================================================================
-- Use apenas em caso de emergência quando outras soluções não funcionam
-- ATENÇÃO: Isto remove temporariamente a segurança RLS!

-- Desabilitar RLS em todas as tabelas problemáticas
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verificar status
DO $$
BEGIN
  RAISE NOTICE '🚨 ATENÇÃO: RLS foi DESABILITADO em todas as tabelas!';
  RAISE NOTICE '⚠️ Isto é uma medida de emergência temporária';
  RAISE NOTICE '🛠️ Implemente as políticas corretas e reabilite RLS o mais rápido possível';
  RAISE NOTICE '✅ Sistema deve funcionar agora, mas SEM segurança RLS';
END;
$$;

-- ================================================================
-- PARA REABILITAR RLS APÓS CORREÇÃO:
-- ================================================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_evaluations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
