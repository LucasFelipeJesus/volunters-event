// TESTE SIMPLES - Cole este código no console do navegador
// na página "Gerenciar Usuários" para verificar se a política RLS funcionou

const testeRLS = async () => {
    console.log(
        "🧪 TESTE RLS - Verificando se admin pode ver todos os usuários"
    )

    const { data: allUsers, error } = await supabase
        .from("users")
        .select("id, email, full_name, role, is_active")

    console.log("📊 Todos os usuários retornados:", allUsers)
    console.log("❌ Erro:", error)
    console.log("📈 Total:", allUsers?.length || 0)

    if (allUsers && allUsers.length > 1) {
        console.log("✅ RLS FUNCIONANDO! Admin pode ver todos os usuários")
        console.log("👥 Roles encontrados:", [
            ...new Set(allUsers.map((u) => u.role)),
        ])
    } else {
        console.log(
            "❌ RLS ainda bloqueando. Execute a SQL no Supabase Dashboard primeiro."
        )
    }
}

// Execute a função
testeRLS()
