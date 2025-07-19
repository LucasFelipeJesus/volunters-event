# Configuração Inicial do Administrador

## Problema Identificado

O administrador inicial não pode ser criado diretamente via migration porque a tabela `auth.users` é gerenciada internamente pelo Supabase Auth. 

## Solução: Configuração Manual

### 1. Executar Migration

Primeiro, aplique a migration no Supabase:

```bash
npx supabase db reset
# ou
npx supabase migration up
```

### 2. Criar Usuário Administrador Manualmente

**Opção A: Via Dashboard do Supabase**

1. Acesse o Dashboard do Supabase
2. Vá para Authentication > Users
3. Clique em "Add user"
4. Crie o usuário:
   - **Email**: `admin@sistema.com`
   - **Password**: `admin123`
   - **Metadata**: `{"full_name": "Administrador do Sistema"}`
   - **Confirm email**: ✅ (marcar como confirmado)

**Opção B: Via SQL no Editor**

Execute no SQL Editor do Supabase:

```sql
-- Primeiro, obter o ID do usuário criado
SELECT id, email FROM auth.users WHERE email = 'admin@sistema.com';

-- Depois, configurar o perfil como admin (substitua o UUID pelo ID real)
SELECT setup_admin_profile(
  'UUID_DO_USUARIO_AQUI'::uuid,
  'admin@sistema.com',
  'Administrador do Sistema'
);
```

**Opção C: Via Código JavaScript**

```javascript
import { supabase } from './src/lib/supabase'

// Criar usuário admin (execute uma vez)
const { data, error } = await supabase.auth.admin.createUser({
  email: 'admin@sistema.com',
  password: 'admin123',
  email_confirm: true,
  user_metadata: {
    full_name: 'Administrador do Sistema'
  }
})

if (data.user) {
  console.log('Usuário criado:', data.user.id)
  
  // Configurar como admin
  const { data: result, error: setupError } = await supabase
    .rpc('setup_admin_profile', {
      admin_user_id: data.user.id,
      admin_email: 'admin@sistema.com',
      admin_name: 'Administrador do Sistema'
    })
  
  console.log('Setup admin result:', result)
}
```

### 3. Verificar Configuração

Execute no SQL Editor para verificar:

```sql
-- Verificar se o usuário foi criado
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'admin@sistema.com';

-- Verificar se o perfil foi criado corretamente
SELECT id, email, full_name, role, is_first_login FROM users WHERE email = 'admin@sistema.com';
```

### 4. Configuração Automática (Novo Trigger)

A migration agora inclui um trigger que **automaticamente** cria perfis na tabela `users` quando novos usuários são criados via Supabase Auth:

```sql
-- Trigger criado na migration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

Isso significa que:
- Novos usuários que se registrarem automaticamente terão perfil criado como `volunteer`
- O administrador precisa ser configurado manualmente apenas uma vez

### 5. Primeiro Login do Admin

1. Faça login com:
   - **Email**: `admin@sistema.com`
   - **Senha**: `admin123`

2. O sistema detectará `is_first_login = true` e solicitará:
   - Mudança de senha
   - Configuração do perfil

3. Use a função `completeFirstLogin()` do contexto de auth para marcar como configurado

## Funções Disponíveis

### `setup_admin_profile(user_id, email, name)`
Configura um usuário existente como administrador.

### `handle_new_user()`
Trigger automático que cria perfil para novos usuários.

## Verificação de Problemas

Se o administrador não estiver funcionando:

1. **Verificar se existe na auth.users**:
   ```sql
   SELECT * FROM auth.users WHERE email = 'admin@sistema.com';
   ```

2. **Verificar se existe na tabela users**:
   ```sql
   SELECT * FROM users WHERE email = 'admin@sistema.com';
   ```

3. **Recriar o perfil se necessário**:
   ```sql
   SELECT setup_admin_profile(
     'ID_DO_USUARIO'::uuid,
     'admin@sistema.com',
     'Administrador do Sistema'
   );
   ```

## Segurança

- A senha padrão `admin123` deve ser alterada no primeiro login
- O trigger `handle_new_user()` tem `security definer` para funcionar corretamente
- As políticas RLS protegem o acesso baseado em roles

## Próximos Passos

Após configurar o administrador:

1. ✅ Testar login
2. ✅ Alterar senha
3. ✅ Criar primeiro evento
4. ✅ Criar primeira equipe
5. ✅ Promover um voluntário a capitão
6. ✅ Testar sistema de avaliações
