// Script de debug para verificar consistência nas contagens de eventos
// Execute este script no console do navegador na página dos eventos

console.log("🔍 VERIFICANDO CONSISTÊNCIA DE CONTAGENS")

// Função para verificar contagem em um evento específico
async function verificarContagem(eventId) {
    console.log(`\n📊 Verificando evento ID: ${eventId}`)

    // Query 1: Como nos dashboards (confirmed + pending)
    const { data: registrations1, count: count1 } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ["confirmed", "pending"])

    // Query 2: Apenas confirmed (como era antes)
    const { data: registrations2, count: count2 } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed")

    // Query 3: Buscar dados do evento
    const { data: eventData } = await supabase
        .from("events")
        .select("title, max_volunteers")
        .eq("id", eventId)
        .single()

    console.log(`📋 Evento: ${eventData?.title}`)
    console.log(`🎯 Max voluntários: ${eventData?.max_volunteers}`)
    console.log(`✅ Confirmed + Pending: ${count1}`)
    console.log(`🟡 Apenas Confirmed: ${count2}`)
    console.log(
        `🔢 Vagas disponíveis (método atual): ${
            (eventData?.max_volunteers || 0) - (count1 || 0)
        }`
    )

    return {
        eventId,
        title: eventData?.title,
        maxVolunteers: eventData?.max_volunteers,
        confirmedPending: count1,
        onlyConfirmed: count2,
        availableSpots: (eventData?.max_volunteers || 0) - (count1 || 0),
    }
}

// Verificar todos os eventos
async function verificarTodosEventos() {
    const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .eq("status", "published")
        .limit(5)

    console.log(`\n🎯 Verificando ${events?.length} eventos publicados...\n`)

    for (const event of events || []) {
        await verificarContagem(event.id)
    }
}

// Executar verificação
verificarTodosEventos()

console.log("\n💡 INSTRUÇÕES:")
console.log("1. Abra o console do navegador (F12)")
console.log("2. Cole e execute este código")
console.log("3. Compare os números exibidos com o que você vê na tela")
console.log("4. Relate qualquer inconsistência encontrada")
