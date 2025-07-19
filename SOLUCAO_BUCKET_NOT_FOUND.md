# Solução para Erro "Bucket not found" - Upload de Imagens

## 🔍 Diagnóstico do Problema

O erro `Bucket not found` ocorre porque o bucket `profile-images` não existe no Supabase Storage. Este bucket é necessário para o upload de imagens de perfil dos usuários.

## ✅ Solução Rápida

### 1. Executar Script SQL no Supabase

Acesse o **SQL Editor** no Dashboard do Supabase e execute o script `CREATE_PROFILE_IMAGES_BUCKET.sql`:

```sql
-- Script para criar bucket profile-images no Supabase Storage

-- 1. Criar bucket para imagens de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images', 
    'profile-images', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de acesso (já incluídas no script)
```

### 2. Verificar se os Buckets Foram Criados

Após executar o script SQL, verifique no Dashboard:
- Vá para **Storage** > **Settings**
- Confirme que os buckets `profile-images` e `event-images` existem

## 🔧 Melhorias Implementadas

### 1. Validação de Arquivo Aprimorada
- ✅ Verificação de tipo de arquivo (JPEG, PNG, WebP, GIF)
- ✅ Limite de tamanho (5MB)
- ✅ Validação de usuário autenticado

### 2. Verificação de Bucket
- ✅ Verifica se o bucket existe antes do upload
- ✅ Mensagens de erro mais informativas
- ✅ Logs detalhados para debugging

### 3. Estrutura de Pastas Organizada
- ✅ Imagens de perfil: `profile-images/{userId}/profile_{timestamp}.ext`
- ✅ Imagens de eventos: `event-images/event_{eventId}_{timestamp}.ext`

### 4. Serviço Reutilizável
Criado `imageUploadService.ts` com funcionalidades:
- Upload de imagens
- Validação de arquivos
- Verificação de buckets
- Funções de conveniência

## 🚀 Como Usar Após a Correção

### Para Imagem de Perfil:
```typescript
import { uploadProfileImage } from '../utils/imageUploadService'

// Upload simples
const imageUrl = await uploadProfileImage(file, userId)
```

### Para Imagem de Evento:
```typescript
import { uploadEventImage } from '../utils/imageUploadService'

// Upload de imagem de evento
const imageUrl = await uploadEventImage(file, eventId)
```

## 🛠️ Debug e Monitoramento

### Verificar Status dos Buckets:
```typescript
import { debugBuckets } from '../utils/bucketManager'

// Executar no console do navegador
await debugBuckets()
```

### Logs Úteis:
O sistema agora inclui logs detalhados:
- ✅ Tentativas de upload
- ✅ Verificação de buckets
- ✅ Erros específicos
- ✅ URLs geradas

## 📋 Checklist de Verificação

- [ ] Script SQL executado no Supabase
- [ ] Buckets criados (profile-images, event-images)
- [ ] Políticas de acesso configuradas
- [ ] Código atualizado nos componentes
- [ ] Teste de upload funcionando

## 🚨 Problemas Comuns

### 1. "Bucket not found" ainda aparece
- Verifique se o script SQL foi executado com sucesso
- Confirme no Dashboard do Supabase se os buckets existem

### 2. "Access denied" ou 403
- Verifique se as políticas de RLS estão configuradas
- Confirme se o usuário está autenticado

### 3. Upload muito lento
- Verifique o tamanho da imagem (máximo 5MB)
- Teste com imagens menores

## 🔄 Próximos Passos

1. **Teste o upload** após executar o script SQL
2. **Monitore os logs** no console do navegador
3. **Documente** qualquer erro adicional
4. **Considere implementar** preview de imagem e progress bar

## 📞 Suporte

Se o problema persistir:
1. Verifique os logs do console
2. Execute `await debugBuckets()` no console
3. Confirme as configurações do Supabase Storage
4. Contate o administrador do sistema se necessário
