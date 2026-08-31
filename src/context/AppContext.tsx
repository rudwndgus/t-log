import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { inviteCode, uid } from '../lib/utils'
import { ensureCloudDay, loadCloudData } from '../services/cloud'
import type { ChatMessage, ItineraryPlace, NoteBlock, NotePage, PollOption, Profile, Proposal, TLogData, TransportSegment, Trip } from '../types'

const STORAGE_KEY = 'tlog:data:v1'
const PROFILE_KEY = 'tlog:profile:v1'
const noteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const emptyData: TLogData = { trips: [], notes: [], places: [], segments: [], messages: [], proposals: [] }
const fallbackProfile: Profile = { id: 'local-user', name: '여행자' }

interface CreateTripInput { name: string; destination: string; startDate: string; endDate: string; emoji: string }
type NewPlaceInput = Omit<ItineraryPlace, 'id' | 'sortOrder' | 'createdBy' | 'createdAt'>

interface AppContextValue {
  data: TLogData
  profile: Profile
  ready: boolean
  online: boolean
  cloudMode: boolean
  signedIn: boolean
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  setProfileName: (name: string) => void
  createTrip: (input: CreateTripInput) => Trip
  joinTrip: (code: string) => Trip | null
  joinCloudTrip: (code: string) => Promise<string>
  addNotePage: (tripId: string, title?: string) => NotePage
  updateNotePage: (pageId: string, changes: Partial<Pick<NotePage, 'title' | 'blocks'>>) => void
  deleteNotePage: (pageId: string) => void
  duplicateNotePage: (pageId: string) => void
  reorderNotePages: (tripId: string, oldIndex: number, newIndex: number) => void
  addBlock: (pageId: string, block: Omit<NoteBlock, 'id'>) => void
  addPlace: (input: NewPlaceInput) => ItineraryPlace
  updatePlace: (placeId: string, changes: Partial<ItineraryPlace>) => void
  deletePlace: (placeId: string) => void
  reorderPlaces: (tripId: string, day: number, orderedIds: string[]) => void
  upsertSegment: (segment: TransportSegment) => void
  sendMessage: (tripId: string, body: string, type?: ChatMessage['type'], refs?: Partial<ChatMessage>) => void
  createProposal: (input: Omit<Proposal, 'id' | 'createdBy' | 'createdAt' | 'status'>) => Proposal
  vote: (proposalId: string, optionId: string) => void
  setProposalStatus: (proposalId: string, status: Proposal['status']) => void
}

const AppContext = createContext<AppContextValue | null>(null)

function readLocalData(): TLogData {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as TLogData } catch { return emptyData }
}
function readProfile(): Profile {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '') as Profile } catch { return fallbackProfile }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TLogData>(readLocalData)
  const [profile, setProfile] = useState<Profile>(readProfile)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [online, setOnline] = useState(navigator.onLine)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }, [data])
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) }, [profile])

  useEffect(() => {
    const client = supabase
    if (!client) return
    let channel: ReturnType<typeof client.channel> | null = null
    const refresh = () => loadCloudData(client).then(setData).catch(() => undefined)
    client.auth.getSession().then(({ data: auth }) => {
      if (auth.session?.user) { setProfile({ id: auth.session.user.id, name: auth.session.user.user_metadata.name || auth.session.user.email?.split('@')[0] || '여행자', email: auth.session.user.email }); setSignedIn(true); void refresh() }
      setReady(true)
      channel = client.channel('tlog-live').on('postgres_changes', { event: '*', schema: 'public' }, () => void refresh()).subscribe()
    })
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
      if (session?.user) { setProfile({ id: session.user.id, name: session.user.user_metadata.name || session.user.email?.split('@')[0] || '여행자', email: session.user.email }); void refresh() }
    })
    return () => { authListener.subscription.unsubscribe(); if (channel) void client.removeChannel(channel) }
  }, [])

  const mutate = useCallback((fn: (previous: TLogData) => TLogData) => setData((previous) => fn(previous)), [])
  const setProfileName = (name: string) => { const next = name.trim() || '여행자'; setProfile((current) => ({ ...current, name: next })); if (supabase && signedIn) void supabase.from('profiles').update({ name: next, updated_at: new Date().toISOString() }).eq('id', profile.id) }
  const signInWithEmail = async (email: string) => { if (!supabase) throw new Error('NOT_CONFIGURED'); const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } }); if (error) throw error }
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setSignedIn(false); setProfile(fallbackProfile) }
  const createTrip = (input: CreateTripInput) => {
    const trip: Trip = { id: uid(), ...input, inviteCode: inviteCode(), createdBy: profile.id, createdAt: new Date().toISOString(), members: [{ id: uid(), profile, role: 'OWNER' }] }
    mutate((current) => ({ ...current, trips: [trip, ...current.trips] }))
    const client = supabase
    if (client && signedIn) void client.from('trips').insert({ id: trip.id, name: trip.name, destination: trip.destination, start_date: trip.startDate, end_date: trip.endDate, emoji: trip.emoji, invite_code: trip.inviteCode, created_by: profile.id }).then(({ error }) => { if (!error) void client.from('trip_members').insert({ trip_id: trip.id, user_id: profile.id, role: 'OWNER' }) })
    return trip
  }
  const joinTrip = (code: string) => data.trips.find((trip) => trip.inviteCode === code.trim().toUpperCase()) || null
  const joinCloudTrip = async (code: string) => { if (!supabase || !signedIn) throw new Error('AUTH_REQUIRED'); const { data: tripId, error } = await supabase.rpc('join_trip_by_code', { invite_code_input: code.trim().toUpperCase() }); if (error || !tripId) throw error || new Error('INVALID_INVITE'); setData(await loadCloudData(supabase)); return tripId as string }
  const addNotePage = (tripId: string, title = '새 페이지') => {
    const page: NotePage = { id: uid(), tripId, title, blocks: [{ id: uid(), type: 'paragraph', content: '' }], updatedAt: new Date().toISOString() }
    mutate((current) => ({ ...current, notes: [...current.notes, page] }))
    const client = supabase
    if (client && signedIn) void client.from('note_pages').insert({ id: page.id, trip_id: tripId, title, position: data.notes.filter((note) => note.tripId === tripId).length, created_by: profile.id }).then(({ error }) => { if (!error) void client.from('note_blocks').insert({ id: page.blocks[0].id, page_id: page.id, type: 'paragraph', content: { text: '' }, position: 0, created_by: profile.id }) })
    return page
  }
  const updateNotePage = (pageId: string, changes: Partial<Pick<NotePage, 'title' | 'blocks'>>) => {
    const page = data.notes.find((item) => item.id === pageId); const next = page ? { ...page, ...changes, updatedAt: new Date().toISOString() } : null
    mutate((current) => ({ ...current, notes: current.notes.map((item) => item.id === pageId ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) }))
    if (supabase && signedIn && next) { const currentTimer = noteSaveTimers.get(pageId); if (currentTimer) clearTimeout(currentTimer); noteSaveTimers.set(pageId, setTimeout(() => { if (!supabase) return; void supabase.from('note_pages').update({ title: next.title, updated_at: next.updatedAt }).eq('id', pageId); const blockRows = next.blocks.map((block, position) => ({ id: block.id, page_id: pageId, type: block.type, content: { text: block.content, checked: block.checked }, position, created_by: profile.id, updated_at: next.updatedAt })); if (blockRows.length) { void supabase.from('note_blocks').upsert(blockRows); void supabase.from('note_blocks').delete().eq('page_id', pageId).not('id', 'in', `(${blockRows.map((block) => block.id).join(',')})`) } else void supabase.from('note_blocks').delete().eq('page_id', pageId) }, 800)) }
  }
  const deleteNotePage = (pageId: string) => { mutate((current) => ({ ...current, notes: current.notes.filter((page) => page.id !== pageId) })); if (supabase && signedIn) void supabase.from('note_pages').delete().eq('id', pageId) }
  const duplicateNotePage = (pageId: string) => mutate((current) => { const original = current.notes.find((page) => page.id === pageId); if (!original) return current; return { ...current, notes: [...current.notes, { ...original, id: uid(), title: `${original.title} 복사본`, blocks: original.blocks.map((block) => ({ ...block, id: uid() })), updatedAt: new Date().toISOString() }] } })
  const reorderNotePages = (tripId: string, oldIndex: number, newIndex: number) => mutate((current) => { const own = current.notes.filter((page) => page.tripId === tripId); const moved = own.splice(oldIndex, 1)[0]; if (!moved) return current; own.splice(newIndex, 0, moved); return { ...current, notes: [...current.notes.filter((page) => page.tripId !== tripId), ...own] } })
  const addBlock = (pageId: string, block: Omit<NoteBlock, 'id'>) => mutate((current) => ({ ...current, notes: current.notes.map((page) => page.id === pageId ? { ...page, blocks: [...page.blocks, { ...block, id: uid() }], updatedAt: new Date().toISOString() } : page) }))
  const addPlace = (input: NewPlaceInput) => { const place: ItineraryPlace = { ...input, id: uid(), sortOrder: data.places.filter((item) => item.tripId === input.tripId && item.day === input.day).length, createdBy: profile.id, createdAt: new Date().toISOString() }; mutate((current) => ({ ...current, places: [...current.places, place] })); if (supabase && signedIn) { const trip = data.trips.find((item) => item.id === input.tripId); if (trip) void ensureCloudDay(supabase, input.tripId, input.day, trip.startDate).then((dayId) => supabase?.from('itinerary_places').insert({ id: place.id, trip_id: place.tripId, day_id: dayId, provider_place_id: place.providerPlaceId, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, start_time: place.startTime || null, end_time: place.endTime || null, notes: place.notes, link: place.link, category: place.category, sort_order: place.sortOrder, created_by: profile.id })) } return place }
  const updatePlace = (placeId: string, changes: Partial<ItineraryPlace>) => { mutate((current) => ({ ...current, places: current.places.map((place) => place.id === placeId ? { ...place, ...changes } : place) })); if (supabase && signedIn) void supabase.from('itinerary_places').update({ name: changes.name, address: changes.address, latitude: changes.latitude, longitude: changes.longitude, start_time: changes.startTime, end_time: changes.endTime, notes: changes.notes, link: changes.link, category: changes.category, sort_order: changes.sortOrder, updated_at: new Date().toISOString() }).eq('id', placeId) }
  const deletePlace = (placeId: string) => { mutate((current) => ({ ...current, places: current.places.filter((place) => place.id !== placeId), segments: current.segments.filter((segment) => segment.sourcePlaceId !== placeId && segment.destinationPlaceId !== placeId) })); if (supabase && signedIn) void supabase.from('itinerary_places').delete().eq('id', placeId) }
  const reorderPlaces = (tripId: string, day: number, orderedIds: string[]) => { mutate((current) => ({ ...current, places: current.places.map((place) => place.tripId === tripId && place.day === day ? { ...place, sortOrder: orderedIds.indexOf(place.id) } : place) })); if (supabase && signedIn) void Promise.all(orderedIds.map((id, sortOrder) => supabase?.from('itinerary_places').update({ sort_order: sortOrder }).eq('id', id))) }
  const upsertSegment = (segment: TransportSegment) => { mutate((current) => ({ ...current, segments: [...current.segments.filter((item) => item.id !== segment.id), segment] })); if (supabase && signedIn) void supabase.from('transport_segments').upsert({ id: segment.id, trip_id: segment.tripId, source_place_id: segment.sourcePlaceId, destination_place_id: segment.destinationPlaceId, mode: segment.mode, duration_minutes: segment.duration, distance_km: segment.distance, notes: segment.notes, updated_at: new Date().toISOString() }) }
  const sendMessage = (tripId: string, body: string, type: ChatMessage['type'] = 'TEXT', refs: Partial<ChatMessage> = {}) => { const message: ChatMessage = { id: uid(), tripId, body, type, author: profile, createdAt: new Date().toISOString(), ...refs }; mutate((current) => ({ ...current, messages: [...current.messages, message] })); if (supabase && signedIn) void supabase.from('chat_messages').insert({ id: message.id, trip_id: tripId, sender_id: profile.id, type, body, metadata: refs }) }
  const createProposal = (input: Omit<Proposal, 'id' | 'createdBy' | 'createdAt' | 'status'>) => { const proposal: Proposal = { ...input, id: uid(), createdBy: profile.id, createdAt: new Date().toISOString(), status: 'OPEN' }; const messageId = uid(); mutate((current) => ({ ...current, proposals: [...current.proposals, proposal], messages: [...current.messages, { id: messageId, tripId: input.tripId, type: 'PROPOSAL', body: input.description, author: profile, createdAt: new Date().toISOString(), proposalId: proposal.id }] })); if (supabase && signedIn) { const client = supabase; void client.from('proposals').insert({ id: proposal.id, trip_id: proposal.tripId, title: proposal.title, description: proposal.description, status: proposal.status, referenced_note_page_id: proposal.referencedNotePageId, referenced_place_id: proposal.referencedPlaceId, proposed_place: proposal.proposedPlace, created_by: profile.id }).then(({ error }) => { if (error) return; void client.from('poll_options').insert(proposal.options.map((option, position) => ({ id: option.id, proposal_id: proposal.id, label: option.label, position }))); void client.from('chat_messages').insert({ id: messageId, trip_id: proposal.tripId, sender_id: profile.id, type: 'PROPOSAL', body: proposal.description, metadata: { proposalId: proposal.id } }) }) } return proposal }
  const vote = (proposalId: string, optionId: string) => { mutate((current) => ({ ...current, proposals: current.proposals.map((proposal) => proposal.id !== proposalId ? proposal : { ...proposal, options: proposal.options.map((option): PollOption => ({ ...option, voterIds: option.id === optionId ? Array.from(new Set([...option.voterIds.filter((id) => id !== profile.id), profile.id])) : option.voterIds.filter((id) => id !== profile.id) })) }) })); if (supabase && signedIn) void supabase.from('poll_votes').upsert({ proposal_id: proposalId, option_id: optionId, user_id: profile.id }, { onConflict: 'proposal_id,user_id' }) }
  const setProposalStatus = (proposalId: string, status: Proposal['status']) => { mutate((current) => ({ ...current, proposals: current.proposals.map((proposal) => proposal.id === proposalId ? { ...proposal, status } : proposal) })); if (supabase && signedIn) void supabase.from('proposals').update({ status, updated_at: new Date().toISOString() }).eq('id', proposalId) }

  const value = { data, profile, ready, online, cloudMode: isSupabaseConfigured, signedIn, signInWithEmail, signOut, setProfileName, createTrip, joinTrip, joinCloudTrip, addNotePage, updateNotePage, deleteNotePage, duplicateNotePage, reorderNotePages, addBlock, addPlace, updatePlace, deletePlace, reorderPlaces, upsertSegment, sendMessage, createProposal, vote, setProposalStatus }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => { const value = useContext(AppContext); if (!value) throw new Error('AppProvider is missing'); return value }
