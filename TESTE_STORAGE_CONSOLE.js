// Script de teste para console do navegador
// Cole este código no console (F12) para testar o storage

console.log("🔍 Iniciando diagnóstico do Supabase Storage...")

// Função para verificar buckets
async function checkBuckets() {
    try {
        console.log("📋 Verificando buckets existentes...")
        const { data: buckets, error } = await supabase.storage.listBuckets()

        if (error) {
            console.error("❌ Erro ao listar buckets:", error)
            return false
        }

        console.log("📁 Buckets encontrados:", buckets?.map((b) => b.id) || [])

        const requiredBuckets = ["profile-images", "event-images"]
        const missing = requiredBuckets.filter(
            (id) => !buckets?.some((b) => b.id === id)
        )

        if (missing.length > 0) {
            console.warn("⚠️ Buckets faltando:", missing)
            return false
        }

        console.log("✅ Todos os buckets necessários existem!")
        return true
    } catch (error) {
        console.error("💥 Erro inesperado:", error)
        return false
    }
}

// Função para testar upload
async function testUpload() {
    try {
        console.log("🧪 Testando upload básico...")

        // Criar arquivo de teste
        const testFile = new File(["test content"], "test.txt", {
            type: "text/plain",
        })

        const { data, error } = await supabase.storage
            .from("profile-images")
            .upload(`test-${Date.now()}.txt`, testFile)

        if (error) {
            console.error("❌ Erro no upload de teste:", error)
            return false
        }

        console.log("✅ Upload de teste bem-sucedido!")

        // Limpar arquivo de teste
        await supabase.storage.from("profile-images").remove([data.path])
        console.log("🧹 Arquivo de teste removido")

        return true
    } catch (error) {
        console.error("💥 Erro no teste de upload:", error)
        return false
    }
}

// Função para tentar setup automático
async function tryAutoSetup() {
    try {
        console.log("🛠️ Tentando setup automático...")

        const { data, error } = await supabase.rpc("setup_storage_buckets")

        if (error) {
            console.error("❌ Setup automático falhou:", error)
            console.log("💡 Dica: Execute os comandos SQL manualmente")
            return false
        }

        console.log("✅ Setup automático executado:", data)
        return true
    } catch (error) {
        console.log(
            "ℹ️ Função de setup não disponível (normal se não foi criada)"
        )
        return false
    }
}

// Executar todos os testes
async function runFullDiagnostic() {
    console.log("🚀 Executando diagnóstico completo...")
    console.log("=".repeat(50))

    // 1. Verificar buckets
    const bucketsOk = await checkBuckets()

    if (!bucketsOk) {
        console.log("🔧 Tentando setup automático...")
        await tryAutoSetup()

        // Verificar novamente
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await checkBuckets()
    }

    // 2. Testar upload
    await testUpload()

    console.log("=".repeat(50))
    console.log("📊 Diagnóstico completo!")
    console.log("💡 Se houver problemas, execute o script SQL manualmente")
}

// Executar automaticamente
runFullDiagnostic()

// Também disponibilizar funções individuais
window.storageDiagnostic = {
    checkBuckets,
    testUpload,
    tryAutoSetup,
    runFullDiagnostic,
}

console.log("🎯 Funções disponíveis:")
console.log("- storageDiagnostic.checkBuckets()")
console.log("- storageDiagnostic.testUpload()")
console.log("- storageDiagnostic.tryAutoSetup()")
console.log("- storageDiagnostic.runFullDiagnostic()")
