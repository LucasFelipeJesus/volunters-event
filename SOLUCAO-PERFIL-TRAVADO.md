# Solução Rápida - Perfil Travado

## Problema
O sistema fica travado em "Buscando perfil do usuário".

## Solução Rápida ⚡

Abra o **Console do Navegador** (F12) e execute:

```javascript
// Comando rápido de diagnóstico
window.debugAuth.diagnoseProfile(window.debugAuth.getCurrentUser().session?.user?.id);
```

## Criar Perfil Automaticamente

Se o diagnóstico mostrar que o usuário não existe, execute:

```javascript
// Criar perfil faltante automaticamente
async function repararPerfil() {
  const user = window.debugAuth.getCurrentUser().session?.user;
  if (user) {
    const resultado = await window.debugAuth.createProfile(user.id, user.email);
    if (resultado) {
      console.log('✅ Perfil criado! Recarregue a página.');
      setTimeout(() => window.location.reload(), 2000);
    }
  }
}
repararPerfil();
```

## Comandos de Debug Disponíveis

```javascript
// Ver estado atual
window.debugAuth.getCurrentUser();

// Diagnóstico completo
window.debugAuth.diagnoseProfile('user-id-aqui');

// Criar perfil manualmente
window.debugAuth.createProfile('user-id', 'email@exemplo.com');

// Acesso direto ao Supabase
window.debugAuth.supabase;
```

## Se Nada Funcionar

1. **Limpe o cache do navegador**
2. **Verifique se você está conectado à internet**
3. **Tente em aba anônima/privada**
4. **Verifique no Supabase Dashboard**:
   - Tabela `users` existe?
   - Políticas RLS permitem SELECT para `auth.uid() = id`?
   - Usuário existe na tabela Auth?
