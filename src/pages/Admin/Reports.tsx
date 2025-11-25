import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { eventService, userService, teamService, evaluationService } from '../../lib/services'
import { supabase } from '../../lib/supabase'
import type { User, Event as EventType, Team as TeamType, TeamDetails, TeamMember, UserEventHistory, EvaluationDetails, AdminEvaluationDetails } from '../../lib/supabase'
import { Filter, Download } from 'lucide-react'
// pdfMake import via dynamic import (works better with Vite)
let cachedPdfMake: unknown = null
const loadPdfMake = async () => {
  if (cachedPdfMake) return cachedPdfMake
  // Tentar alguns caminhos comuns de import (UMD/ESM)
  const attempts = [
    ['pdfmake/build/pdfmake', 'pdfmake/build/vfs_fonts'],
    ['pdfmake/build/pdfmake.min', 'pdfmake/build/vfs_fonts'],
    ['pdfmake', 'pdfmake/build/vfs_fonts']
  ]
  let lastErr: unknown = null
  for (const [pkg, vfs] of attempts) {
    try {
      const pdfMod: unknown = await import(/* @vite-ignore */ pkg)
      const vfsMod: unknown = await import(/* @vite-ignore */ vfs)
      const pdf = (pdfMod as { default?: typeof import("pdfmake/build/pdfmake") })?.default || pdfMod
      // vfs pode existir em diferentes estruturas de exportação
      const vfsCast: unknown = vfsMod
      let vfsObject: unknown = undefined
      if (vfsCast && vfsCast.pdfMake && vfsCast.pdfMake.vfs) {
        vfsObject = vfsCast.pdfMake.vfs
      } else if (vfsCast && vfsCast.default && vfsCast.default.pdfMake && vfsCast.default.pdfMake.vfs) {
        vfsObject = vfsCast.default.pdfMake.vfs
      } else if (vfsCast && vfsCast.vfs) {
        vfsObject = vfsCast.vfs
      } else {
        vfsObject = vfsMod
      }
      (pdf as typeof import("pdfmake/build/pdfmake")).vfs = vfsObject;
      cachedPdfMake = pdf
      return cachedPdfMake
    } catch (err) {
      lastErr = err
      // try next
    }
  }
  // Fallback: tentar carregar via CDN (jsdelivr)
  try {
    const cdnBase = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.7/build'
    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`)
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('Erro ao carregar script'))) 
        return
      }
      const el = document.createElement('script')
      el.type = 'text/javascript'
      el.src = src
      el.onload = () => resolve()
      el.onerror = () => reject(new Error('Erro ao carregar script: ' + src))
      document.head.appendChild(el)
    })

    await loadScript(`${cdnBase}/pdfmake.min.js`)
    await loadScript(`${cdnBase}/vfs_fonts.js`)
    const win = window as Window & { pdfMake?: unknown }
    if (win && win.pdfMake) {
      cachedPdfMake = win.pdfMake
      return cachedPdfMake
    }
  } catch (cdnErr) {
    // se o CDN também falhar, jogar o erro original para facilitar debug
    throw new Error('Falha ao importar pdfMake: ' + (lastErr?.message || lastErr) + '; CDN erro: ' + (cdnErr instanceof Error ? cdnErr.message : cdnErr))
  }
  throw new Error('Falha ao importar pdfMake: ' + (lastErr?.message || lastErr))
}

interface ReportSectionToggle {
  id: string
  label: string
  checked: boolean
}

const nowDate = () => new Date().toLocaleString('pt-BR')

export const AdminReports: React.FC = () => {
  const { user } = useAuth()
    const [events, setEvents] = useState<EventType[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<TeamDetails[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [sectionToggles, setSectionToggles] = useState<ReportSectionToggle[]>([
    { id: 'users', label: 'Usuários', checked: true },
    { id: 'teams', label: 'Equipes e membros por evento', checked: true },
    { id: 'eventStats', label: 'Estatísticas de Eventos', checked: false },
    { id: 'evaluations', label: 'Avaliações (Resumo)', checked: false }
  ])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // No PDF settings persistence — removed

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [evs, us] = await Promise.all([eventService.getAllEvents(), userService.getAllUsers()])
        setEvents(evs)
        setUsers(us)
      } catch (err) {
        console.error('Erro carregando dados para relatórios', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    const loadTeams = async () => {
      if (!selectedEvent) {
        setTeams([])
        return
      }
      setLoading(true)
      try {
        const t = await teamService.getEventTeams(selectedEvent)
        // If the returned teams are missing members, fetch details for those teams
        const teamsMissingMembers = t.filter(tm => !Array.isArray((tm as TeamDetails).members) || (tm as TeamDetails).members.length === 0)
        if (teamsMissingMembers.length > 0) {
          const details = await Promise.all(teamsMissingMembers.map(tm => teamService.getTeamDetails((tm as TeamDetails).team_id)))
          // Merge details into original set
          const detailsMap = new Map(details.filter(Boolean).map((d: TeamDetails) => [d.team_id, d]))
          const merged = t.map(tm => detailsMap.get((tm as TeamDetails).team_id) || tm)
          setTeams(merged)
        } else {
          setTeams(t)
        }
      } catch (err) {
        console.error('Erro carregando teams', err)
      } finally {
        setLoading(false)
      }
    }
    loadTeams()
  }, [selectedEvent])

  const toggleSection = (id: string) => {
    setSectionToggles(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s))
  }

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(x => x !== userId) : [...prev, userId])
  }

  const toggleSelectTeam = (teamId: string) => {
    setSelectedTeamIds(prev => prev.includes(teamId) ? prev.filter(x => x !== teamId) : [...prev, teamId])
  }

  const toggleExpandTeam = (teamId: string) => {
    setExpandedTeamIds(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId])
  }

  const selectedToggles = useMemo(() => sectionToggles.filter(s => s.checked).map(s => s.id), [sectionToggles])

  const exportPDF = async () => {
    // Gera o documento pdf utilizando pdfMake
    const docDefinition: Record<string, unknown> = {
      pageSize: 'A4',
      pageMargins: [40, 80, 40, 60],
      header: () => {
        return {
          columns: [
            { text: 'Relatório - Volunters', style: 'headerLeft' },
            { text: nowDate(), alignment: 'right', style: 'headerRight' }
          ],
          margin: [40, 10, 40, 0]
        }
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        margin: [0, 0, 0, 10]
      }),
      content: [] as Array<Record<string, unknown>>,
      styles: {
        sectionTitle: { fontSize: 14, bold: true, margin: [0, 10, 0, 6] },
        subTitle: { fontSize: 11, italics: true, margin: [0, 0, 0, 8], color: '#666' },
        tableHeader: { bold: true, fillColor: '#f3f4f6' }
      }
    }

    // Helper to convert image url to dataURL
    // Image conversion helper removed (PDF trims). If a logo is needed, add a proper raster URL or a dataURL at build time.

    // Meta dos filtros
    const metaFilters: Array<Record<string, string>> = []
    if (selectedEvent) {
      const ev = events.find(e => e.id === selectedEvent)
      metaFilters.push({ text: `Evento: ${ev?.title || ev?.id}`, style: 'subTitle' })
    }
    if (dateFrom || dateTo) {
      metaFilters.push({ text: `Período: ${dateFrom || '-'} a ${dateTo || '-'}`, style: 'subTitle' })
    }
    if (searchTerm) {
      metaFilters.push({ text: `Pesquisa: ${searchTerm}`, style: 'subTitle' })
    }

    if (metaFilters.length > 0) docDefinition.content.push({ stack: metaFilters })

      // Usuários
    if (selectedToggles.includes('users')) {
      docDefinition.content.push({ text: 'Usuários', style: 'sectionTitle' })
      // Tabela de usuários
      const userTableBody: Array<Array<string | number>> = [
        [
          { text: 'Nome', style: 'tableHeader' },
          { text: 'Email', style: 'tableHeader' },
          { text: 'Cargo', style: 'tableHeader' },
          { text: 'Ativo', style: 'tableHeader' },
          { text: 'Cadastrado', style: 'tableHeader' }
        ]
      ]

      const filteredUsers = users
        .filter(u => !searchTerm || u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
        .filter(u => selectedUserIds.length === 0 ? true : selectedUserIds.includes(u.id))

      filteredUsers.forEach(u => {
        userTableBody.push([
          u.full_name || '-',
          u.email || '-',
          (u.role || '-') as string,
          u.is_active ? 'Sim' : 'Não',
          new Date(u.created_at).toLocaleDateString('pt-BR')
        ])
      })

      docDefinition.content.push({ table: { headerRows: 1, widths: ['*', '*', 80, 50, 90], body: userTableBody } })
      docDefinition.content.push({ text: '\n' })
    }

    // Detalhes individuais por usuário (quando selecionados)
    if (selectedToggles.includes('users') && selectedUserIds.length > 0) {
      docDefinition.content.push({ text: 'Detalhes de Usuários Selecionados', style: 'sectionTitle' })
      for (const userId of selectedUserIds) {
        const userObj = users.find(u => u.id === userId)
        if (!userObj) continue
        docDefinition.content.push({ text: userObj.full_name || userObj.email || userId, style: 'subTitle' })
        // Perfil principal
        docDefinition.content.push({ text: [
          { text: 'Email: ', bold: true }, { text: userObj.email || '-' },
          { text: '\nTelefone: ', bold: true }, { text: userObj.phone || '-' },
          { text: '\nCidade: ', bold: true }, { text: userObj.city || '-' }
        ], margin: [0, 0, 0, 6] })

        // Histórico de eventos
        try {
          const history: UserEventHistory[] = await userService.getEventHistory(userId)
          if (history && history.length > 0) {
            const histTable: Array<Array<string>> = [[ 'Evento', 'Data', 'Equipe', 'Papel' ]]
            history.forEach(h => histTable.push([h.event_title || '-', h.event_date || '-', h.team_name || '-', h.role_in_team || '-']))
            docDefinition.content.push({ text: 'Histórico de Eventos', bold: true, margin: [0, 4, 0, 4] })
            docDefinition.content.push({ table: { headerRows: 1, widths: ['*', 80, '*', 80], body: histTable } })
          }
        } catch (err) {
          console.warn('Erro ao carregar histórico de eventos para pdf', err)
        }

        // Avaliações (se existirem)
        try {
          let evals: Array<EvaluationDetails | AdminEvaluationDetails> = []
          if (userObj.role === 'captain') evals = await evaluationService.getCaptainEvaluations(userId)
          else evals = await evaluationService.getVolunteerEvaluations(userId)
          if (evals && evals.length > 0) {
            const evalTable: Array<Array<string | number>> = [[ 'Data', 'Evento', 'Nota', 'Comentários' ]]
            evals.forEach(ev => evalTable.push([ev.evaluation_date?.slice(0, 10) || ev.created_at?.slice(0, 10) || '-', ev.event_title || ev.event?.title || '-', String(ev.overall_rating || ev.rating || 0), ev.comments || '-']))
            docDefinition.content.push({ text: 'Avaliações', bold: true, margin: [0, 4, 0, 4] })
            docDefinition.content.push({ table: { headerRows: 1, widths: [80, '*', 40, '*'], body: evalTable } })
          }
        } catch (err) {
          console.warn('Erro ao carregar avaliações para pdf', err)
        }

        docDefinition.content.push({ text: '\n' })
      }
    }

    // Equipes e membros por evento
    if (selectedToggles.includes('teams')) {
      docDefinition.content.push({ text: 'Equipes por Evento', style: 'sectionTitle' })
      // Se não escolheu evento específico, expandir todos os eventos
      const targetEvents = selectedEvent ? events.filter(e => e.id === selectedEvent) : events
      for (const ev of targetEvents) {
        if (!selectedEvent) docDefinition.content.push({ text: `${ev.title} (${ev.event_date?.slice(0, 10)})`, style: 'subTitle' })
        // Carregar teams para esse evento, se não estão em memória, buscar via API
        const evTeams: Array<TeamType | TeamDetails> = ev?.teams || (ev.id ? teams.filter(t => t.event_id === ev.id) : [])
        const effectiveTeams: Array<TeamType | TeamDetails> = selectedTeamIds.length
          ? evTeams.filter((tm: TeamType | TeamDetails) => {
              const idValue = 'team_id' in tm ? (tm as TeamDetails).team_id : (tm as TeamType).id
              return idValue ? selectedTeamIds.includes(idValue) : false
            })
          : evTeams

        if (!evTeams || evTeams.length === 0) {
          docDefinition.content.push({ text: 'Nenhuma equipe encontrada', margin: [0, 0, 0, 6] })
          continue
        }

        // tabela com equipes e conteudo de membros (compacto)
        const teamTableBody: Array<Array<string | number>> = [
          [{ text: 'Equipe', style: 'tableHeader' }, { text: 'Capitão', style: 'tableHeader' }, { text: 'Voluntários', style: 'tableHeader' }]
        ]

        // Enrich member phones in batch for this event's teams
        try {
          const allMemberIds: string[] = []
          effectiveTeams.forEach(t => {
            if (Array.isArray((t as TeamDetails).members)) {
              (t as TeamDetails).members.forEach(m => { if (m?.user_id) allMemberIds.push(m.user_id) })
            }
            if ((t as TeamDetails).captain_id) allMemberIds.push((t as TeamDetails).captain_id)
          })
          const uniqueIds = Array.from(new Set(allMemberIds))
          if (uniqueIds.length > 0) {
            const { data: usersData } = await supabase.from('users').select('id, phone').in('id', uniqueIds) as { data: Array<{ id: string; phone?: string }> }
            const usersMap = new Map((usersData || []).map((u: { id: string; phone?: string }) => [u.id, u]))
            effectiveTeams.forEach(t => {
              if (Array.isArray((t as TeamDetails).members)) {
                (t as TeamDetails).members.forEach(m => {
                  const u = usersMap.get(m.user_id)
                  if (u) {
                    (m as TeamMember & { phone?: string }).phone = u.phone
                  }
                })
              }
              // attach captain phone if present
              if ((t as TeamDetails).captain_id) {
                const cap = usersMap.get((t as TeamDetails).captain_id)
                if (cap) (t as TeamDetails & { captain_phone?: string }).captain_phone = cap.phone
              }
            })
          }
        } catch (err) { console.warn('Erro ao enriquecer telefones de membros', err) }

        for (const tm of effectiveTeams) {
          // Ensure members are present; if not, attempt to fetch team details
          try {
            const id = 'team_id' in tm ? (tm as TeamDetails).team_id : (tm as TeamType).id
            if (id && (!Array.isArray((tm as TeamDetails).members) || (tm as TeamDetails).members.length === 0)) {
              const details = await teamService.getTeamDetails(id)
              if (details && Array.isArray(details.members) && details.members.length > 0) {
                ;(tm as TeamDetails).members = details.members
                ;(tm as TeamDetails).captain_name = details.captain_name || (tm as TeamDetails).captain_name || (tm as TeamDetails).captain?.full_name
              }
            }
          } catch (err) {
            console.warn('Erro ao carregar detalhes da equipe', err)
          }
          const memberCount = Array.isArray(tm.members) ? tm.members.length : (tm.current_volunteers || 0)
          // Capitão nome
          const rawCaptainName = tm.captain?.full_name || tm.captain_name || (tm.captain_id ? 'Id: ' + tm.captain_id : '-')
          const captainPhone = (tm as TeamDetails).captain_phone || tm.captain?.phone || ''
          const captainName = captainPhone ? `${rawCaptainName} • ${captainPhone}` : rawCaptainName

          teamTableBody.push([
            tm.team_name || tm.name || '-',
            captainName,
            String(memberCount)
          ])

          // Se membros existem, adicionar sub-items como tabela detalhada
          if (Array.isArray((tm as TeamDetails).members) && (tm as TeamDetails).members.length > 0) {
            docDefinition.content.push({ text: `Membros - ${tm.team_name || tm.name}`, style: 'subTitle' })
            const memberTableBody: Array<Array<string>> = [[ 'Nome', 'Telefone', 'Papel', 'Status' ]]
            ;(tm as TeamDetails).members.forEach((m: TeamMember) => {
              memberTableBody.push([
                m.full_name || m.user?.full_name || '-',
                (m as TeamMember & { phone?: string }).phone || m.user?.phone || '-',
                m.role_in_team || '-',
                m.status || '-'
              ])
            })
            docDefinition.content.push({ table: { headerRows: 1, widths: ['*', 100, 90, 70], body: memberTableBody }, layout: 'lightHorizontalLines' })
          }
        }

        docDefinition.content.push({ table: { headerRows: 1, widths: ['*', 120, 80], body: teamTableBody }, layout: 'lightHorizontalLines' })
        docDefinition.content.push({ text: '\n' })

      }
    }

    // Event stats
    if (selectedToggles.includes('eventStats')) {
      docDefinition.content.push({ text: 'Estatísticas do Evento', style: 'sectionTitle' })
      const targetEvents = selectedEvent ? events.filter(e => e.id === selectedEvent) : events
      for (const ev of targetEvents) {
        const eventTeams: TeamType[] = ev.teams || []
        const totalTeams = eventTeams.length
        const totalVolunteers = eventTeams.reduce((acc: number, t: TeamType) => acc + (t.current_volunteers || 0), 0)
        const pctFull = ev.max_volunteers ? Math.round((totalVolunteers / (ev.max_volunteers || 1)) * 100) : 0

        const table = {
          table: {
            widths: ['*', '*', '*'],
            body: [
              ['Equipes', 'Voluntários', 'Capacidade (%)'],
              [String(totalTeams), String(totalVolunteers), `${pctFull}%`]
            ]
          }
        }

        if (!selectedEvent) docDefinition.content.push({ text: ev.title, style: 'subTitle' })
        docDefinition.content.push(table)
        docDefinition.content.push({ text: '\n' })
      }
    }

    // Summaries of evaluations - show counts and averages, using views if available
    if (selectedToggles.includes('evaluations')) {
      docDefinition.content.push({ text: 'Avaliações - Resumo', style: 'sectionTitle' })
      // Fetch quick stats via RPCs if exists; fallback to local counts
      try {
        // Example: buscar média geral de avaliações via RPC 'get_system_evaluation_summary' - pode não existir
        const { data: stats, error } = await supabase.rpc('get_system_evaluation_summary') as unknown as { data?: { average_rating?: number; total_evaluations?: number }; error?: unknown }
        if (!error && stats) {
          docDefinition.content.push({ text: `Média geral: ${stats.average_rating?.toFixed(1) || '-'} / 5`, margin: [0, 2, 0, 6] })
          docDefinition.content.push({ text: `Total avaliações: ${stats.total_evaluations || 0}`, margin: [0, 2, 0, 6] })
        } else {
          // Fallback: agregação básica
          const { data: evs } = await supabase.from('evaluations').select<{ rating: number }>('rating')
          const avg = evs && evs.length > 0 ? (evs.reduce((s: number, r: { rating: number }) => s + Number(r.rating || 0), 0) / evs.length) : 0
          docDefinition.content.push({ text: `Média geral: ${avg ? avg.toFixed(1) : '-'} / 5`, margin: [0, 2, 0, 6] })
        }
      } catch (err) {
        console.warn('get_system_evaluation_summary não existe ou falhou', err)
      }
    }

    // Finalizar e mostrar arquivo
    try {
      setExportingPdf(true)
      // Server-side generation removed; always use client-side pdfMake
      const pdf = await loadPdfMake()
        // No PDF cover adjustments; using default document content
      // If there are metaFilters, add them to cover
      // metaFilters already added as content above; no cover stacking required
      pdf.createPdf(docDefinition).download(`relatorio_volunters_${Date.now()}.pdf`)
    } catch (err) {
      console.error('Erro gerando PDF com pdfMake', err)
      alert('Erro gerando PDF: ' + (err instanceof Error ? err.message : err))
    } finally {
      setExportingPdf(false)
    }
  }

  // CSV export removed

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Acesso Negado</h2>
          <p className="text-gray-600">Apenas administradores podem acessar relatórios.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios Administrativos</h1>
          <p className="text-gray-600 mt-2">Exporte relatórios customizados com filtros, selecione seções e gere PDF profissional.</p>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={exportPDF} disabled={exportingPdf} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 disabled:opacity-50">
            <Download className="w-4 h-4" />
            <span>{exportingPdf ? 'Gerando...' : 'Exportar PDF'}</span>
          </button>
          {/* PDF settings removed — direct export only */}
        </div>
      </div>

      {/* PDF Settings Modal */}
      {/* PDF settings modal removed */}

      {/* Filtros */}
      <div className="bg-white p-6 rounded shadow border border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-sm font-medium text-gray-700">Evento</label>
            <select title="Selecionar evento" value={selectedEvent || ''} onChange={(e) => setSelectedEvent(e.target.value || null)} className="w-full border border-gray-300 rounded px-3 py-2">
              <option value="">Todos os eventos</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Data início</label>
            <input title="Data de início" type="date" className="w-full border border-gray-300 rounded px-3 py-2" value={dateFrom || ''} onChange={(e) => setDateFrom(e.target.value || null)} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Data fim</label>
            <input title="Data de fim" type="date" className="w-full border border-gray-300 rounded px-3 py-2" value={dateTo || ''} onChange={(e) => setDateTo(e.target.value || null)} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Pesquisar</label>
            <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Nome ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2"><Filter className="w-4 h-4" /> Seções</h4>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sectionToggles.map(s => (
              <label key={s.id} className="flex items-center space-x-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={s.checked} onChange={() => toggleSection(s.id)} className="form-checkbox h-4 w-4" />
                <span className="text-sm font-medium">{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white p-6 rounded shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Pré-visualização</h2>
          <div className="text-sm text-gray-500">Seções selecionadas: <strong>{selectedToggles.join(', ') || 'Nenhuma'}</strong></div>
        </div>

        {/* PDF cover preview removed */}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mr-4"></div>
            <div className="text-gray-600">Carregando dados...</div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Users preview */}
          {selectedToggles.includes('users') && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Usuários</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUserIds(users.map(u => u.id))
                            else setSelectedUserIds([])
                          }}
                          aria-label="Selecionar todos os usuários"
                        />
                      </th>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Ativo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {users.filter(u => !searchTerm || u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())).filter(u => selectedUserIds.length === 0 ? true : selectedUserIds.includes(u.id)).slice(0, 20).map(u => (
                      <tr key={u.id} className="border-b">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleSelectUser(u.id)} aria-label={`Selecionar usuário ${u.full_name}`} />
                        </td>
                        <td className="px-3 py-2">{u.full_name}</td>
                        <td className="px-3 py-2">{u.email}</td>
                        <td className="px-3 py-2">{u.role}</td>
                        <td className="px-3 py-2">{u.is_active ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Teams preview */}
          {selectedToggles.includes('teams') && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Equipes</h3>
              {selectedEvent ? (
                teams.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhuma equipe encontrada</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-700">Equipes do evento</div>
                      <div>
                        <label className="text-sm"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelectedTeamIds(teams.map(t => t.team_id || t.id)); else setSelectedTeamIds([]) }} /> Selecionar todos</label>
                      </div>
                    </div>
                      {teams.filter(t => selectedTeamIds.length === 0 ? true : selectedTeamIds.includes(t.team_id || t.id)).map(t => (
                        <div key={t.team_id || t.id} className="p-3 border rounded flex items-center justify-between">
                          <div className="mr-3">
                            <input type="checkbox" checked={selectedTeamIds.includes(t.team_id || t.id)} onChange={() => toggleSelectTeam(t.team_id || t.id)} aria-label={`Selecionar equipe ${t.team_name || t.name}`} />
                          </div>
                        <div>
                          <div className="font-medium text-gray-900">{t.team_name || t.name}</div>
                          <div className="text-sm text-gray-600">Capitão: {((t as TeamDetails).captain_name || t.captain?.full_name || '-')}{((t as TeamDetails).captain_phone || t.captain?.phone) ? ' • ' + ((t as TeamDetails).captain_phone || t.captain?.phone) : ''}</div>
                        </div>
                        <div className="text-sm text-gray-600">Membros: {t.members?.length || t.current_volunteers || 0}</div>
                      </div>
                      ))}
                      {/* Member list compact */}
                      {teams.filter(t => selectedTeamIds.length === 0 ? true : selectedTeamIds.includes(t.team_id || t.id)).map(t => (
                        <div className="px-3" key={(t.team_id || t.id) + '_members'}>
                          {Array.isArray(t.members) && t.members.length > 0 ? (
                            <>
                              <div className="text-sm text-gray-700 mt-1">{(t.members as (TeamMember & { phone?: string })[]).slice(0, 4).map(m => `${m.full_name}${m.phone || m.user?.phone ? ' | ' + (m.phone || m.user?.phone) : ''}`).join(', ')}{(t.members as TeamMember[]).length > 4 ? '...' : ''}</div>
                              <div className="mt-2">
                                <button className="text-sm text-blue-600" onClick={() => toggleExpandTeam(t.team_id || t.id)}>
                                  {expandedTeamIds.includes(t.team_id || t.id) ? 'Ocultar membros' : 'Ver membros'}
                                </button>
                                {expandedTeamIds.includes(t.team_id || t.id) && (
                                  <div className="mt-2 text-sm text-gray-700 space-y-1">
                                    {(t.members as TeamMember[]).map(m => (
                                      <div key={m.user_id} className="flex items-center gap-2">
                                        <div className="font-medium">{m.full_name}</div>
                                        <div className="text-xs text-gray-500">{m.role_in_team}{((m as TeamMember & { phone?: string }).phone || m.user?.phone) ? ' • ' + (((m as TeamMember & { phone?: string }).phone || m.user?.phone)) : ''}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ))}
                    
                  </div>
                )
              ) : (
                <div className="text-sm text-gray-500">Selecione um evento para ver as equipes.</div>
              )}
            </div>
          )}

          {/* Event stats preview */}
          {selectedToggles.includes('eventStats') && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Estatísticas do Evento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(selectedEvent ? events.filter(e => e.id === selectedEvent) : events).map(ev => (
                  <div key={ev.id} className="p-3 border rounded">
                    <div className="font-medium text-gray-900 mb-1">{ev.title}</div>
                    <div className="text-xs text-gray-500">{ev.event_date?.slice(0, 10)}</div>

                    <div className="mt-3 space-y-1 text-sm text-gray-700">
                      <div>Total equipes: {ev.teams?.length || 0}</div>
                      <div>Total voluntários: {ev.teams?.reduce((acc: number, t: TeamType) => acc + (t.current_volunteers || 0), 0) || 0}</div>
                      <div>Capacidade: {ev.max_volunteers ? `${ev.teams?.reduce((acc: number, t: TeamType) => acc + (t.current_volunteers || 0), 0)}/${ev.max_volunteers}` : '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluations preview */}
          {selectedToggles.includes('evaluations') && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Avaliações (Visão Geral)</h3>
              <div className="text-sm text-gray-600">Média geral, contagem de avaliações e principais comentários — obtidos via view ou agregação.</div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

export default AdminReports
