# 🛠️ Solução Manual via Interface do Supabase

Já que o script SQL está dando problema, vamos criar os buckets pela interface do Supabase Dashboard:

## 📋 Passo a Passo Manual

### 1. Acessar o Supabase Dashboard
- Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Entre no seu projeto
- Vá para **Storage** na barra lateral esquerda

### 2. Criar Bucket profile-images
- Clique em **"New bucket"**
- Nome: `profile-images`
- ✅ Marque **"Public bucket"**
- Clique em **"Save"**

### 3. Criar Bucket event-images
- Clique em **"New bucket"** novamente
- Nome: `event-images`
- ✅ Marque **"Public bucket"**
- Clique em **"Save"**

### 4. Configurar Políticas RLS
Na aba **Policies** do Storage:

#### Política de Leitura Pública:
```sql
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (true);
```

#### Política de Upload Autenticado:
```sql
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### 5. Verificar se Funcionou
No **SQL Editor**, execute:
```sql
SELECT id, name, public FROM storage.buckets;
```

Deve mostrar:
```
profile-images | profile-images | true
event-images   | event-images   | true
```

## 🚀 Alternativa: Via SQL Editor (Comandos Individuais)

Execute **um comando por vez** no SQL Editor:

```sql
-- 1. Verificar storage
SELECT * FROM storage.buckets;
```

```sql
-- 2. Criar bucket profile-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-images', 'profile-images', true);
```

```sql
-- 3. Criar bucket event-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true);
```

```sql
-- 4. Verificar criação
SELECT * FROM storage.buckets WHERE id IN ('profile-images', 'event-images');
```

## ✅ Verificação Final

Após criar os buckets, teste no seu app:
1. Vá para a página de perfil
2. Tente fazer upload de uma imagem
3. Verifique se não há mais erros "Bucket not found"

## 🔧 Se Ainda Não Funcionar

### Diagnóstico Rápido:
Execute no console do navegador:
```javascript
// Verificar se buckets existem
const { data, error } = await supabase.storage.listBuckets()
console.log('Buckets:', data)
console.log('Error:', error)
```

### Resultado Esperado:
```javascript
Buckets: [
  { id: 'profile-images', name: 'profile-images', public: true },
  { id: 'event-images', name: 'event-images', public: true }
]
Error: null
```

## 📞 Suporte Adicional

Se nada funcionar:
1. **Verifique se o Storage está habilitado** no seu projeto Supabase
2. **Confirme suas permissões** de administrador
3. **Tente recriar o projeto** Supabase se necessário
4. **Use o sistema de fallback** que já está implementado no código

O sistema já tem fallback para base64, então mesmo se os buckets não funcionarem, o upload de imagem continuará funcionando com aviso ao usuário.
