import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { eventService, userService, teamService } from '../../lib/services';
import type { User, Event as EventType } from '../../lib/supabase';
import { Download } from 'lucide-react';
import { formatWhatsappLink } from '../../utils/phoneUtils';
import { displayRole, getRoleEmoji } from '../../utils/roleUtils';

let cachedPdfMake: any = null;
const loadPdfMake = async () => {
  if (cachedPdfMake) return cachedPdfMake;
  const pdfMake = await import('pdfmake/build/pdfmake');
  const pdfFonts = await import('pdfmake/build/vfs_fonts');
  const vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs || (pdfFonts as any).default?.vfs;
  if (vfs) pdfMake.vfs = vfs;
  cachedPdfMake = pdfMake;
  return pdfMake;
};

const formatPhoneForWa = (phone?: string | null) => {
  if (!phone) return null;
  const digits = String(phone).replace(/[^0-9]/g, '');
  // Assumes numbers already include country code when provided; if not, you might want to prefix.
  return digits || null;
};


const resolveMember = (member: any, users: User[]) => {
  if (!member) return null;
  // If the member is a join record with the user nested (team_members.user)
  if (member.user && typeof member.user === 'object') return member.user as User;
  // If it's already a user-like object (has full_name or email), return it
  if (typeof member === 'object' && (member.id && (member.full_name || member.email || member.phone))) return member as User;
  // Otherwise try to resolve by common id fields
  const id = member?.user_id || member?.id || member;
  return users.find(u => u.id === id) || null;
};


const AdminReports: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [eventStatusFilter, setEventStatusFilter] = useState<string>('all');
  const [teamDetailsByEvent, setTeamDetailsByEvent] = useState<Record<string, any[]>>({});

  const getTeamsForEvent = (ev: any) => {
    if (!ev) return [];
    const evTeamsRaw: any[] = (ev as any).teams || [];
    const hasMembersInEvTeams = evTeamsRaw.some(t => Array.isArray(t.members) && t.members.length > 0) || evTeamsRaw.some(t => Array.isArray(t.team_members) && t.team_members.length > 0);
    if (hasMembersInEvTeams) return evTeamsRaw;
    return (teamDetailsByEvent[ev.id] ?? evTeamsRaw);
  };

  // Normaliza objetos de equipe vindos de diferentes queries/views
  const normalizeTeam = (t: any) => {
    if (!t) return null;
    const id = t.id || t.team_id || t.teamId || null;
    const name = t.name || t.team_name || t.teamName || t.team_name_local || 'Equipe sem nome';
    const status = t.status || t.team_status || t.teamStatus || null;
    const members = Array.isArray(t.members) ? t.members : (Array.isArray(t.team_members) ? t.team_members : (Array.isArray(t.members_list) ? t.members_list : (Array.isArray(t.members || []) ? t.members : [])));
    const captain = t.captain || (t.captain_id ? { id: t.captain_id } : null) || null;
    return { ...t, id, name, status, members, captain };
  };

  const sectionToggles = useMemo(() => [
    { id: 'teams', label: 'Equipes', checked: true },
    { id: 'eventStats', label: 'Estatísticas', checked: true }
  ], []);

  const [selectedToggles] = useState<string[]>(() => sectionToggles.filter(s => s.checked).map(s => s.id));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const evs = await eventService.getAllEvents();
        const us = await userService.getAllUsers();
        setEvents(evs || []);
        setUsers(us || []);
      } catch (err) {
        console.error('Erro carregando dados do relatório', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Quando o usuário seleciona um evento, buscar versão detalhada (com membros) desse evento
  useEffect(() => {
    if (!selectedEventId) return;
    let mounted = true;
    (async () => {
      try {
        // Prefer fetching team details for the selected event (contains members/team_members)
        const teams = await teamService.getEventTeams(selectedEventId);
        if (mounted && teams) {
          setTeamDetailsByEvent(prev => ({ ...prev, [selectedEventId]: teams }));
        }

        // Also fetch detailed event (fallback) to keep event-level fields up to date
        const detailed = await eventService.getEvent(selectedEventId);
        if (!mounted || !detailed) return;
        setEvents(prev => {
          const found = prev.find(e => e.id === selectedEventId);
          if (!found) return [detailed, ...prev];
          return prev.map(e => e.id === selectedEventId ? detailed : e);
        });
      } catch (err) {
        console.warn('Erro ao carregar dados detalhados do evento', err);
      }
    })();
    return () => { mounted = false; };
  }, [selectedEventId]);

  // When user checks event checkboxes (multiple selection), fetch missing details
  useEffect(() => {
    if (!selectedEventIds || selectedEventIds.length === 0) return;
    let mounted = true;
    (async () => {
      for (const evId of selectedEventIds) {
        if (!mounted) break;
        if (teamDetailsByEvent[evId]) continue;
        try {
          const teams = await teamService.getEventTeams(evId);
          const detailed = await eventService.getEvent(evId);
          if (!mounted) break;
          if (teams) setTeamDetailsByEvent(prev => ({ ...prev, [evId]: teams }));
          if (detailed) setEvents(prev => prev.map(e => e.id === evId ? detailed : e));
        } catch (err) {
          console.warn('Erro ao carregar dados detalhados do evento (multi):', evId, err);
        }
      }
    })();
    return () => { mounted = false; };
  }, [selectedEventIds]);

  // Prefetch team details for loaded events so counts and members show immediately
  useEffect(() => {
    if (!events || events.length === 0) return;
    let mounted = true;
    (async () => {
      for (const ev of events) {
        if (!mounted) break;
        if (teamDetailsByEvent[ev.id]) continue;
        try {
          const teams = await teamService.getEventTeams(ev.id);
          if (mounted && teams) {
            setTeamDetailsByEvent(prev => ({ ...prev, [ev.id]: teams }));
          }
        } catch (err) {
          console.warn('Erro ao pré-carregar equipes do evento', ev.id, err);
        }
      }
    })();
    return () => { mounted = false; };
  }, [events, teamDetailsByEvent]);

  const exportPDF = async () => {
    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 40, 40, 40],
      content: [],
      styles: { title: { fontSize: 18, bold: true } }
    };
    const targetEvents = (selectedEventIds && selectedEventIds.length > 0)
      ? events.filter(e => selectedEventIds.includes(e.id))
      : (selectedEventId ? events.filter(e => e.id === selectedEventId) : events);

    // helper to fetch image and convert to dataURL (cached)
    const placeholderKey = '/placeholder-avatar.png';
    const imageCache = new Map<string, string | null>();

    // convert a raster image dataURL into a circular PNG dataURL using canvas
    const convertToCircularDataUrl = async (dataUrl: string, size = 96) => {
      try {
        return await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error('Canvas not supported'));
              // draw circular clipping
              ctx.clearRect(0, 0, size, size);
              ctx.save();
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
              ctx.closePath();
              ctx.clip();
              // draw image covering the canvas while preserving aspect ratio (cover)
              const ratio = Math.max(size / img.width, size / img.height);
              const w = img.width * ratio;
              const h = img.height * ratio;
              const dx = (size - w) / 2;
              const dy = (size - h) / 2;
              ctx.drawImage(img, dx, dy, w, h);
              ctx.restore();
              const png = canvas.toDataURL('image/png');
              resolve(png);
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => reject(new Error('Image load error'));
          img.src = dataUrl;
        });
      } catch (e) {
        console.warn('Falha ao converter imagem para circular:', e);
        throw e;
      }
    };
    const failedImageLogs: Array<{ url: string; reason: string; error?: any }> = [];
    const fetchImageAsDataUrl = async (url?: string | null, makeCircular = false) => {
      if (!url) return null;
      // If it's already a data URL, use it directly
      if (typeof url === 'string' && url.startsWith('data:')) {
        // Optionally convert inline data images to circular
        if (makeCircular && url.startsWith('data:image/')) {
          try {
            const circ = await convertToCircularDataUrl(url, 128);
            imageCache.set(url, circ);
            return circ;
          } catch (e) {
            imageCache.set(url, url);
            return url;
          }
        }
        imageCache.set(url, url);
        return url;
      }
      if (imageCache.has(url)) return imageCache.get(url) || null;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onerror = () => reject(new Error('fileReader error'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
        // If the image is SVG, convert to PNG because pdfMake may not support SVG data URIs
        const isSvg = typeof dataUrl === 'string' && dataUrl.startsWith('data:image/svg');
        const finalDataUrl = isSvg ? await (async () => {
          try {
            return await new Promise<string>((resolveConvert, rejectConvert) => {
              const img = new Image();
              img.onload = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width || 100;
                  canvas.height = img.height || 100;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return rejectConvert(new Error('Canvas not supported'));
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const png = canvas.toDataURL('image/png');
                  resolveConvert(png);
                } catch (e) {
                  rejectConvert(e);
                }
              };
              img.onerror = () => rejectConvert(new Error('Image load error'));
              img.src = dataUrl;
            });
          } catch (e) {
            console.warn('Falha ao converter SVG para PNG:', e);
            failedImageLogs.push({ url: String(url), reason: 'svg-conversion-failed', error: e });
            return dataUrl; // fallback to original
          }
        })() : dataUrl;
        // optionally convert raster images to circular avatars (avoid placeholder)
        let cachedResult = finalDataUrl;
        if (makeCircular && typeof finalDataUrl === 'string' && finalDataUrl.startsWith('data:image/') && url !== placeholderKey) {
          try {
            cachedResult = await convertToCircularDataUrl(finalDataUrl, 128);
          } catch (e) {
            // fallback to original finalDataUrl
            failedImageLogs.push({ url: String(url), reason: 'circular-conversion-failed', error: e });
            cachedResult = finalDataUrl;
          }
        }
        // store final (possibly converted) data URL
        imageCache.set(url, cachedResult);
        return cachedResult;
      } catch (err) {
        console.warn('Não foi possível carregar imagem para PDF:', url, err);
        failedImageLogs.push({ url: String(url), reason: 'fetch-or-read-failed', error: err });
        imageCache.set(url, null);
        return null;
      }
    };

    // prefetch unique avatars used in the targeted events, applying current filters
    const avatarUrls = new Set<string>();
    // also prefetch a local placeholder image (if available) so we can embed it when a member has no avatar
    const getTeamsForEvent = (ev: any) => {
      const evTeamsRaw: any[] = (ev as any).teams || [];
      const hasMembersInEvTeams = evTeamsRaw.some(t => Array.isArray(t.members) && t.members.length > 0) || evTeamsRaw.some(t => Array.isArray(t.team_members) && t.team_members.length > 0);
      if (hasMembersInEvTeams) return evTeamsRaw;
      return (teamDetailsByEvent[ev.id] ?? evTeamsRaw);
    };

    for (const ev of targetEvents) {
      const evTeams: any[] = getTeamsForEvent(ev);
      for (const team of evTeams) {
        const nt = normalizeTeam(team) || team;
        if (selectedTeamIds.length > 0 && !selectedTeamIds.includes(String(nt.id))) continue;
        const members = Array.isArray((nt as any).members) ? (nt as any).members : (Array.isArray((nt as any).team_members) ? (nt as any).team_members : (Array.isArray((nt as any).members_list) ? (nt as any).members_list : []));
        for (const m of members) {
          const member = resolveMember(m, users);
          const avatar = (member as any)?.profile_image_url || (member as any)?.avatar_url || (member as any)?.image || (member as any)?.photo_url || null;
          if (avatar) avatarUrls.add(avatar);
        }
      }
    }
    // ensure placeholder is available in the cache (don't circularize placeholder)
    try {
      await fetchImageAsDataUrl(placeholderKey, false);
      avatarUrls.add(placeholderKey);
    } catch (e) {
      // ignore if placeholder not found
    }
    // prefetch avatars: convert to circular for real avatar URLs (not placeholder)
    await Promise.all(Array.from(avatarUrls).map(u => fetchImageAsDataUrl(u, u !== placeholderKey)));
    const placeholderDataUri = imageCache.get(placeholderKey) || null;

    // Build images dictionary for pdfMake and a map from original url -> image key
    const imagesDict: Record<string, string> = {};
    const urlToImageKey = new Map<string, string>();
    let imgIdx = 0;
    for (const url of avatarUrls) {
      const cached = imageCache.get(url);
      // only register images that are explicit image data URIs (avoid data:text/html etc)
      if (typeof cached === 'string' && cached.startsWith('data:image/')) {
        const key = `img_${imgIdx++}`;
        imagesDict[key] = cached;
        urlToImageKey.set(url, key);
      } else {
        // log for debugging if conversion failed or returned non-image data
        if (cached === null) {
          failedImageLogs.push({ url: String(url), reason: 'conversion-failed-or-null' });
        } else {
          failedImageLogs.push({ url: String(url), reason: 'not-image-data-uri', error: cached });
        }
        if (cached !== null) console.warn('Imagem não é data:image e será ignorada pelo PDF:', url, cached);
      }
    }
    // ensure placeholder is available under a key if present
    let placeholderKeyName: string | null = null;
    if (placeholderDataUri && typeof placeholderDataUri === 'string' && placeholderDataUri.startsWith('data:')) {
      const key = `img_${imgIdx++}`;
      imagesDict[key] = placeholderDataUri;
      urlToImageKey.set(placeholderKey, key);
      placeholderKeyName = key;
    }

    // attach images dictionary to docDefinition so pdfMake recognizes keys
    if (Object.keys(imagesDict).length > 0) docDefinition.images = imagesDict;

    if (failedImageLogs.length > 0) {
      console.groupCollapsed('Relatório - imagens ignoradas/convert-failed');
      console.table(failedImageLogs);
      console.groupEnd();
    }

    if (selectedToggles.includes('teams')) {
      docDefinition.content.push({ text: 'Equipes por Evento', style: 'title' });
      for (const ev of targetEvents) {
        docDefinition.content.push({ text: ev.title || '-', margin: [0, 8, 0, 6], style: 'subheader' });
        const evTeams: any[] = getTeamsForEvent(ev);
        // build card wrappers for this event and then layout as grid (3 columns)
        const eventCardWrappers: any[] = [];
          for (const team of evTeams) {
            const nt = normalizeTeam(team) || team;
            if (selectedTeamIds.length > 0 && !selectedTeamIds.includes(String(nt.id))) continue;

            const members = Array.isArray((nt as any).members) ? (nt as any).members : (Array.isArray((nt as any).team_members) ? (nt as any).team_members : (Array.isArray((nt as any).members_list) ? (nt as any).members_list : []));
            const resolvedMembers: Array<{ raw: any; user: User | null }> = members.map((m: any) => ({ raw: m, user: resolveMember(m, users) }));
            const captainIdLocal = nt && nt.captain && typeof nt.captain === 'object' ? nt.captain.id : (nt.captain_id || nt.captain);
            const captainEntryLocal = resolvedMembers.find((e: { raw: any; user: User | null }) => (e.user && (e.user as any).id && (e.user as any).id === captainIdLocal) || (e.raw && (e.raw.id === captainIdLocal || e.raw.user_id === captainIdLocal || e.raw === captainIdLocal)));
            const orderedMembers = captainEntryLocal ? [captainEntryLocal, ...resolvedMembers.filter((e: { raw: any; user: User | null }) => e !== captainEntryLocal)] : resolvedMembers;

            // Build member rows
            const memberRows: any[] = [];
            for (const entry of orderedMembers) {
              const m = entry.raw;
              const member = entry.user || (m && m.user) || null;
              const phone = (member as any)?.phone || (member as any)?.phone_number || '';
              const avatar = (member as any)?.profile_image_url || (member as any)?.avatar_url || (member as any)?.image || (member as any)?.photo_url || null;
              const imageKey = avatar && urlToImageKey.has(avatar) ? urlToImageKey.get(avatar) : (placeholderKeyName || null);
              const isCaptain = !!member && ((member as any).id === captainIdLocal);

              const photoCell = imageKey
                ? { image: imageKey, width: 40, height: 40, margin: [0, 2, 8, 2] }
                : { text: '', margin: [0, 8, 8, 8] };
              const nameText = (member as any)?.full_name || (m && (m.name || m.user?.full_name)) || '-';
              const nameCell = { text: nameText + (isCaptain ? '  (Capitão)' : ''), style: isCaptain ? 'memberCaptain' : 'memberName' };
              const waNumber = formatPhoneForWa(phone as any);
              const phoneCell = waNumber ? { text: phone || '-', link: `https://wa.me/${waNumber}`, color: '#1D9B58' } : (phone || '-');

              memberRows.push([{ stack: [photoCell] }, nameCell, phoneCell]);
            }

            // Modern card layout for team: header + member rows as styled items
            const memberItems: any[] = [];
            // colors by status (palette: laranja e preto) - use normalized team `nt`
            const teamStatus = (nt && (nt.status || nt.team_status)) || 'unknown';
            const accentColor = teamStatus === 'published' ? '#F97316' /* orange-500 */ : teamStatus === 'in_progress' ? '#111827' /* black */ : teamStatus === 'draft' ? '#9CA3AF' /* gray */ : teamStatus === 'completed' ? '#000000' : '#6B7280';
            for (const entry of orderedMembers) {
              const m = entry.raw;
              const member = entry.user || (m && m.user) || null;
              const phone = (member as any)?.phone || (member as any)?.phone_number || '';
              const avatar = (member as any)?.profile_image_url || (member as any)?.avatar_url || (member as any)?.image || (member as any)?.photo_url || null;
              const imageKey = avatar && urlToImageKey.has(avatar) ? urlToImageKey.get(avatar) : (placeholderKeyName || null);
              const isCaptain = !!member && ((member as any).id === captainIdLocal);

              const photoObj = imageKey ? { image: imageKey, width: 44, height: 44, margin: [0, 0, 6, 0] } : { text: '', width: 44 };
              const nameText = (member as any)?.full_name || (m && (m.name || m.user?.full_name)) || '-';
              const waNumber = formatPhoneForWa(phone as any);
              const phoneNode = waNumber ? { text: phone || '-', link: `https://wa.me/${waNumber}`, color: '#1D9B58' } : (phone || '-');

              memberItems.push({
                columns: [
                  { width: 48, stack: [photoObj] },
                  { width: '*', stack: [{ text: nameText + (isCaptain ? '  (Capitão)' : ''), style: isCaptain ? 'memberCaptain' : 'memberName' }, { text: displayRole((m && m.role_in_team) || (member && (member as any).role) || 'volunteer'), style: 'small' }] },
                  { width: 100, text: phoneNode, alignment: 'right' }
                ],
                margin: [0, 4, 0, 4]
              });
            }

            // build a card-like container using a two-column table: small colored stripe + content
            const cardTable = {
              table: {
                widths: [4, '*'],
                body: [
                  [
                    { text: '', fillColor: accentColor, margin: [0, 0, 0, 0], border: [false, false, false, false] },
                    {
                      stack: [
                        { columns: [{ width: '*', stack: [{ text: `Equipe: ${nt.name || nt.team_name || '-'}`, style: 'teamCardTitle', color: (accentColor === '#111827' || accentColor === '#000000') ? '#FFFFFF' : '#111827' }] }, { width: 'auto', text: `${orderedMembers.length} voluntários`, style: 'teamCardMeta', alignment: 'right', color: (accentColor === '#111827' || accentColor === '#000000') ? '#FFFFFF' : '#6B7280' }], margin: [6, 4, 6, 4] },
                        { stack: memberItems }
                      ],
                      fillColor: '#ffffff'
                    }
                  ]
                ]
              },
              layout: {
                hLineWidth: function (_i: any, _node: any) { return 0.5; },
                vLineWidth: function () { return 0; },
                hLineColor: function () { return '#E5E7EB'; },
                paddingLeft: function () { return 4; },
                paddingRight: function () { return 4; },
                paddingTop: function () { return 4; },
                paddingBottom: function () { return 4; }
              }
            };

            const cardWrapper: any = {
              stack: [cardTable],
              margin: [0, 4, 0, 4]
            };

            if (orderedMembers.length > 20) {
              cardWrapper.pageBreak = 'before';
            }

          eventCardWrappers.push(cardWrapper);
        }
        // now layout the event cards into rows of up to 3 columns
        const colsPerRow = 4;
        let buffer: any[] = [];
        const flushBuffer = () => {
          if (buffer.length === 0) return;
          // create a columns row (more compact)
          docDefinition.content.push({ columns: buffer.map((c: any) => ({ width: '*', stack: [c] })), columnGap: 6, margin: [0, 2, 0, 2] });
          buffer = [];
        };

        for (const cw of eventCardWrappers) {
          if (cw.pageBreak) {
            // flush any buffered cards first
            flushBuffer();
            // push the large card as full width (it already has pageBreak)
            docDefinition.content.push(cw);
            continue;
          }
          buffer.push(cw);
          if (buffer.length >= colsPerRow) {
            flushBuffer();
          }
        }
        // flush remaining
        flushBuffer();
      }

      // styles for the PDF
      docDefinition.styles = {
        title: { fontSize: 18, bold: true, margin: [0, 0, 0, 6] },
        subheader: { fontSize: 13, bold: true, margin: [0, 6, 0, 4] },
        teamName: { fontSize: 12, bold: true },
        teamCardTitle: { fontSize: 12, bold: true },
        teamCardMeta: { fontSize: 9, color: '#6B7280' },
        small: { fontSize: 9, color: '#6B7280' },
        memberName: { fontSize: 10 },
        memberCaptain: { fontSize: 10, bold: true, color: '#92400E' }
      };
    }
    try {
      setExportingPdf(true);
      const pdf = await loadPdfMake();
      // sanitize images dictionary: keep only valid data:image/* entries
      if (docDefinition.images) {
        for (const k of Object.keys(docDefinition.images)) {
          const v = (docDefinition.images as any)[k];
          if (typeof v !== 'string' || !v.startsWith('data:image/')) {
            console.warn('Removendo imagem inválida do docDefinition.images', k, v);
            delete (docDefinition.images as any)[k];
          }
        }
      }

      // recursively remove or replace image references that point to missing keys
      const cleanseImagesInNode = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(cleanseImagesInNode);
        if (node.image && typeof node.image === 'string') {
          const imgRef = node.image;
          const images = docDefinition.images || {};
          const isKey = !!images[imgRef];
          const isData = typeof imgRef === 'string' && imgRef.startsWith('data:image/');
          if (!isKey && !isData) {
            // Replace the image node with a safe text node and remove image-specific props
            node.text = '';
            delete node.image;
            delete node.width;
            delete node.height;
            delete node.margin;
          }
        }
        for (const key of Object.keys(node)) cleanseImagesInNode(node[key]);
      };
      cleanseImagesInNode(docDefinition.content);
      pdf.createPdf(docDefinition).download(`relatorio_volunters_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Erro gerando PDF', err);
      alert('Erro gerando PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  if (!user || user.role !== 'admin') return (<div className="p-8">Acesso negado</div>);

  const visibleEvents = events.filter(ev => (!selectedEventId || ev.id === selectedEventId) && (eventStatusFilter === 'all' || (ev && ev.status === eventStatusFilter)));
  const displayedEvents = (selectedEventIds && selectedEventIds.length > 0)
    ? events.filter(e => selectedEventIds.includes(e.id))
    : visibleEvents;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex items-center gap-2">
          <select aria-label="Filtrar status do evento" value={eventStatusFilter} onChange={e => setEventStatusFilter(e.target.value)} className="border rounded px-2 py-1">
            <option value="all">Todos os status</option>
            <option value="published">Publicados</option>
            <option value="in_progress">Em progresso</option>
            <option value="draft">Rascunhos</option>
            <option value="completed">Concluídos</option>
          </select>

          <select aria-label="Selecionar evento" value={selectedEventId || ''} onChange={e => { setSelectedEventId(e.target.value || null); setSelectedTeamIds([]); }} className="border rounded px-2 py-1">
            <option value="">Todos os eventos</option>
            {events.map(ev => <option key={ev.id} value={ev.id || ''}>{ev.title}</option>)}
          </select>

          <select aria-label="Selecionar equipe" value={selectedTeamIds[0] || ''} onChange={e => setSelectedTeamIds(e.target.value ? [e.target.value] : [])} className="border rounded px-2 py-1">
            <option value="">Todas as equipes</option>
            {(() => {
              const selectedEvent = events.find(ev => ev.id === selectedEventId);
              const teams = selectedEvent ? getTeamsForEvent(selectedEvent) : (selectedEventId ? (teamDetailsByEvent[selectedEventId] ?? []) : []);
              return (teams as any[])
                .map(normalizeTeam)
                .filter((nt: any) => !!nt)
                .map((nt: any) => (
                  <option key={nt.id || nt.name} value={nt.id || ''}>{nt.name}</option>
                ));
            })()}
          </select>
          <label className="inline-flex items-center space-x-2">
            <input
              aria-label="Marcar todos os eventos"
              type="checkbox"
              checked={displayedEvents.length > 0 && displayedEvents.every((ev: any) => selectedEventIds.includes(ev.id))}
              onChange={() => {
                const allIds = displayedEvents.map((ev: any) => ev.id).filter(Boolean);
                const currentlyAll = displayedEvents.length > 0 && displayedEvents.every((ev: any) => selectedEventIds.includes(ev.id));
                setSelectedEventIds(currentlyAll ? [] : allIds);
              }}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            <span className="text-sm text-gray-700">Marcar todos</span>
          </label>
          <button onClick={exportPDF} disabled={exportingPdf} className="bg-blue-600 text-white px-3 py-1 rounded inline-flex items-center">
            <Download className="w-4 h-4 inline-block mr-2" />{exportingPdf ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div>
        {loading ? <div>Carregando...</div> : (
          (() => {
            // build flat list of teams to render across selected/displayed events
              const teamsToRender: Array<{ team: any; event: any }> = ([] as any[]).concat(...displayedEvents.map((ev: any) => (getTeamsForEvent(ev) || [])
              .map(normalizeTeam)
                .filter((team: any) => team && (selectedTeamIds.length === 0 || selectedTeamIds.includes(String(team.id))))
              .map((team: any) => ({ team, event: ev }))));

            if (teamsToRender.length === 0) return <div className="text-sm text-gray-600">Nenhuma equipe encontrada.</div>;

            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teamsToRender.map(({ team, event }: any) => {
                  // team já foi normalizada via normalizeTeam: possui id, name, status, members
                  const membersArray = Array.isArray(team.members) ? team.members : [];
                  const resolved: Array<{ raw: any; user: User | null }> = membersArray.map((m: any) => ({ raw: m, user: resolveMember(m, users) }));
                  const captainId = team && team.captain && typeof team.captain === 'object' ? team.captain.id : (team.captain_id || team.captain || null);
                  const captainEntry = resolved.find((e: any) => (e.user && (e.user as any).id && (e.user as any).id === captainId) || (e.raw && (e.raw.id === captainId || e.raw.user_id === captainId || e.raw === captainId)));
                  const others = resolved.filter((e: any) => e !== captainEntry);
                  const ordered = captainEntry ? [captainEntry, ...others] : [...resolved];

                  return (
                    <div key={team.id || team.name} className="border rounded p-3 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs text-gray-500">{event?.title}</div>
                          <div className="font-medium">{team.name || team.team_name || 'Equipe sem nome'}</div>
                          <div className="text-sm text-gray-600">Voluntários: {ordered.length} {team.arrival_time ? `· Chegada: ${String(team.arrival_time).slice(0, 5)}` : ''}</div>
                        </div>
                        <div>
                          <label className="inline-flex items-center space-x-2">
                            <input
                              aria-label={`Selecionar equipe ${team?.name || ''}`}
                              type="checkbox"
                              checked={selectedTeamIds.includes(String(team?.id))}
                              onChange={() => setSelectedTeamIds(prev => (prev.includes(String(team?.id)) ? prev.filter(x => x !== String(team?.id)) : [...prev, String(team?.id)]))}
                              className="form-checkbox h-4 w-4 text-blue-600"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mt-2 space-y-2">
                        {(ordered || []).map(({ raw, user }: any) => {
                          const memberRec = raw;
                          const member = user || (raw && raw.user) || resolveMember(raw, users);
                          const status = memberRec?.status ?? 'active';
                          if (status !== 'active') return null;
                          const roleInTeam = (memberRec && memberRec.role_in_team) || (member && ((member as any).role_in_team || (member as any).role)) || 'volunteer';
                          const phone = (member as any)?.phone || (member as any)?.phone_number || null;
                          const waLink = phone ? formatWhatsappLink(phone, { message: `Olá ${member?.full_name || ''}, você foi alocado(a) na equipe ${team?.name || team?.team_name || ''}`, eventLocation: (event as any)?.location }) : null;
                          const avatar = (member as any)?.profile_image_url || (member as any)?.avatar_url || (member as any)?.image || (member as any)?.photo_url || null;
                          return (
                            <div key={(member as any)?.id || JSON.stringify(memberRec)} className="flex items-center space-x-3 bg-gray-50 rounded p-2">
                              {avatar ? (
                                <img src={avatar} alt={member?.full_name || 'avatar'} className="w-10 h-10 rounded-full object-cover" onError={(e: any) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-transparent" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-gray-900">{member?.full_name || memberRec?.name || 'Nome não disponível'}</p>
                                  <span className="text-xs text-gray-500">{getRoleEmoji(roleInTeam)} {displayRole(roleInTeam)}</span>
                                </div>
                                <div className="flex items-center space-x-3 mt-2">
                                  <p className="text-sm text-gray-600">{phone || 'Telefone não informado'}</p>
                                  {phone && waLink && (
                                    <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded-md">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="currentColor"><path d="M20.52 3.48A11.88 11.88 0 0012 .02C5.53.02.53 5.01.53 11.49c0 2.03.54 4.02 1.57 5.78L.02 23.5l6.43-1.65A11.41 11.41 0 0012 23c6.47 0 11.47-4.99 11.47-11.48 0-3.07-1.21-5.94-3.95-8.04zM12 21.36c-1.14 0-2.25-.31-3.21-.9l-.23-.13-3.82.98.98-3.72-.14-.24A9.04 9.04 0 013 11.5C3 6.26 7.1 2.16 12.34 2.16c2.63 0 5.11 1.03 6.97 2.88 1.86 1.86 2.88 4.34 2.88 6.96 0 5.25-4.1 9.35-9.37 9.35z" /></svg>
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

export default AdminReports;
export { AdminReports };
