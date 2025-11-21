-- Migration: criar função get_admin_ids para retornar ids de administradores
-- Data: 2025-11-21

BEGIN;

-- Cria função que retorna ids de usuários com role = 'admin' e is_active = true
CREATE OR REPLACE FUNCTION public.get_admin_ids()
RETURNS TABLE(id uuid) AS $$
  SELECT id FROM public.users WHERE role = 'admin' AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

COMMIT;
