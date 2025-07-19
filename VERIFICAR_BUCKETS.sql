-- TESTE SIMPLES - Execute no SQL Editor para verificar storage

-- Ver todos os buckets existentes
SELECT id, name, public, created_at FROM storage.buckets ORDER BY created_at;

-- Contar buckets necessários
SELECT 
  COUNT(*) as total_necessarios,
  COUNT(CASE WHEN id = 'profile-images' THEN 1 END) as profile_existe,
  COUNT(CASE WHEN id = 'event-images' THEN 1 END) as event_existe
FROM storage.buckets 
WHERE id IN ('profile-images', 'event-images');

-- Status final
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM storage.buckets WHERE id IN ('profile-images', 'event-images')) = 2 
    THEN '✅ TODOS OS BUCKETS EXISTEM - PRONTO PARA USAR!'
    ELSE '❌ BUCKETS FALTANDO - CRIAR VIA INTERFACE'
  END as status;
