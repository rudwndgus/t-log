import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import { inviteCode, uid } from '../lib/utils'
import { createProposalDocument, createTripDocument, deleteNoteDocument, deletePlaceDocument, deleteTripDocument, ensureInitialNoteDocument, joinTripByCode, publishTripDocument, saveMessageDocument, saveNoteDocument, savePlaceDocument, savePlaceOrder, saveProfile, saveProposalStatus, saveSegmentDocument, saveVote, subscribeToUserData } from '../services/firestore'
import { loadLocalData, saveLocalData } from '../services/localStore'
import { collectAttachmentIds, deleteAttachment } from '../services/noteAttachments'
import type { ChatMessage, ItineraryPlace, NoteBlock, NotePage, PollOption, Profile, Proposal, TLogData, TransportSegment, Trip } from '../types'

const PROFILE_KEY = 'tlog:profile:v2'
const emptyData: TLogData = { trips: [], notes: [], places: [], segments: [], messages: [], proposals: [] }
const fallbackProfile: Profile = { id: 'local-user', name: '여행자' }
const noteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface CreateTripInput { name: string; destination: string; startDate: string; endDate: string; emoji: string }
type NewPlaceInput = Omit<ItineraryPlace, 'id' | 'sortOrder' | 'createdBy' | 'createdAt'>
interface AppContextValue {
  data: TLogData; profile: Profile; ready: boolean; online: boolean; cloudMode: boolean; signedIn: boolean; cloudError: string | null; clearCloudError: () => void
  signIn: (email: string, password: string) => Promise<void>; signUp: (name: string, email: string, password: string) => Promise<void>; signOut: () => Promise<void>; setProfileName: (name: string) => void
  createTrip: (input: CreateTripInput) => Promise<Trip>; deleteTrip: (tripId: string) => Promise<void>; shareTrip: (tripId: string, includeNotes: boolean) => Promise<string>; joinTrip: (code: string) => Trip | null; joinCloudTrip: (code: string) => Promise<string>
  addNotePage: (tripId: string, title?: string) => Promise<NotePage>; ensureInitialNotePage: (tripId: string) => Promise<NotePage>; updateNotePage: (pageId: string, changes: Partial<Pick<NotePage, 'title' | 'blocks'>>) => void; deleteNotePage: (pageId: string) => Promise<void>; duplicateNotePage: (pageId: string) => Promise<NotePage | undefined>; reorderNotePages: (tripId: string, oldIndex: number, newIndex: number) => void; addBlock: (pageId: string, block: Omit<NoteBlock, 'id'>) => void
  addPlace: (input: NewPlaceInput) => Promise<ItineraryPlace>; updatePlace: (placeId: string, changes: Partial<ItineraryPlace>) => Promise<void>; deletePlace: (placeId: string) => Promise<void>; reorderPlaces: (tripId: string, day: number, orderedIds: string[]) => Promise<void>; upsertSegment: (segment: TransportSegment) => Promise<void>
  sendMessage: (tripId: string, body: string, type?: ChatMessage['type'], refs?: Partial<ChatMessage>) => Promise<ChatMessage>; createProposal: (input: Omit<Proposal, 'id' | 'createdBy' | 'createdAt' | 'status'>) => Promise<Proposal>; vote: (proposalId: string, optionId: string) => Promise<void>; setProposalStatus: (proposalId: string, status: Proposal['status']) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)
const readProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || localStorage.getItem('tlog:profile:v1') || '') as Profile } catch { return fallbackProfile } }
const firebaseErrorDetails = (error: unknown) => ({
  code: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
  message: error instanceof Error ? error.message : String(error)
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TLogData>(emptyData)
  const [profile, setProfile] = useState<Profile>(() => isFirebaseConfigured ? fallbackProfile : readProfile())
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [signedIn, setSignedIn] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const mutate = useCallback((fn: (previous: TLogData) => TLogData) => setData((previous) => fn(previous)), [])
  const clearCloudError = useCallback(() => setCloudError(null), [])
  const reportCloudError = useCallback((operation: string, error: unknown, context: Record<string, unknown> = {}) => {
    const details = firebaseErrorDetails(error)
    console.error('[T Log Firebase]', { operation, ...details, ...context })
    setCloudError(details.code.includes('permission-denied')
      ? 'Firebase 권한 때문에 저장하거나 불러오지 못했어요. Firestore 규칙을 확인해 주세요.'
      : details.code.includes('unauthenticated')
        ? '로그인 세션이 만료됐어요. 다시 로그인해 주세요.'
        : '클라우드 작업을 완료하지 못했어요. 네트워크 연결을 확인하고 다시 시도해 주세요.')
  }, [])

  useEffect(() => { const onOnline = () => setOnline(true); const onOffline = () => setOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) } }, [])
  useEffect(() => { if (!isFirebaseConfigured) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) }, [profile])
  useEffect(() => { if (!isFirebaseConfigured) void loadLocalData(emptyData).then((stored) => { setData(stored); setReady(true) }) }, [])
  useEffect(() => { if (!isFirebaseConfigured && ready) void saveLocalData(data) }, [data, ready])
  useEffect(() => {
    const flushBeforeUpdate = () => {
      if (!isFirebaseConfigured) { void saveLocalData(data); return }
      const database = db
      if (database && signedIn) data.notes.forEach((page) => { void saveNoteDocument(database, page, profile.id).catch((error) => reportCloudError('flush-note-before-update', error, { tripId: page.tripId, userId: profile.id })) })
    }
    window.addEventListener('tlog:before-update', flushBeforeUpdate)
    return () => window.removeEventListener('tlog:before-update', flushBeforeUpdate)
  }, [data, profile.id, reportCloudError, signedIn])
  useEffect(() => {
    const firebaseAuth = auth; const database = db
    if (!firebaseAuth || !database) return
    let unsubscribeData: (() => void) | undefined
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribeData?.(); unsubscribeData = undefined
      noteSaveTimers.forEach((timer) => clearTimeout(timer)); noteSaveTimers.clear()
      setCloudError(null); setData(emptyData)
      if (!user) { setSignedIn(false); setProfile(fallbackProfile); setReady(true); return }
      setReady(false)
      const nextProfile: Profile = { id: user.uid, name: user.displayName || user.email?.split('@')[0] || '여행자', email: user.email || undefined }
      setProfile(nextProfile); setSignedIn(true)
      // A newly-created Auth user emits once before updateProfile finishes.
      // signUp owns that first profile write so two concurrent setDoc calls cannot stall navigation.
      if (user.displayName) void saveProfile(database, nextProfile).catch((error) => reportCloudError('save-profile', error, { userId: user.uid }))
      unsubscribeData = subscribeToUserData(database, user.uid, (nextData) => { setData(nextData); setReady(true) }, (error, context) => { reportCloudError('subscribe-user-data', error, { userId: user.uid, ...context }); setReady(true) })
    }, (error) => { reportCloudError('auth-state', error); setReady(true) })
    return () => { unsubscribeAuth(); unsubscribeData?.() }
  }, [reportCloudError])

  const signIn = async (email: string, password: string) => { if (!auth) throw new Error('NOT_CONFIGURED'); await signInWithEmailAndPassword(auth, email, password) }
  const signUp = async (name: string, email: string, password: string) => { if (!auth || !db) throw new Error('NOT_CONFIGURED'); const credential = await createUserWithEmailAndPassword(auth, email, password); const nextProfile = { id: credential.user.uid, name: name.trim(), email }; await updateProfile(credential.user, { displayName: name.trim() }); await credential.user.getIdToken(true); await saveProfile(db, nextProfile); setProfile(nextProfile) }
  const signOut = async () => { if (auth) await firebaseSignOut(auth); setSignedIn(false); setData(emptyData); setProfile(fallbackProfile); setCloudError(null) }
  const setProfileName = (name: string) => { const next = name.trim() || '여행자'; const updated = { ...profile, name: next }; setProfile(updated); if (auth?.currentUser) void updateProfile(auth.currentUser, { displayName: next }).catch((error) => reportCloudError('update-auth-profile', error, { userId: profile.id })); if (db && signedIn) void saveProfile(db, updated).catch((error) => reportCloudError('save-profile', error, { userId: profile.id })) }

  const createTrip = async (input: CreateTripInput) => {
    const trip: Trip = { id: uid(), ...input, inviteCode: inviteCode(), createdBy: profile.id, createdAt: new Date().toISOString(), members: [{ id: profile.id, profile, role: 'OWNER' }] }
    try { if (db && signedIn) await createTripDocument(db, trip, profile); mutate((current) => ({ ...current, trips: [trip, ...current.trips.filter((item) => item.id !== trip.id)] })); return trip } catch (error) { reportCloudError('create-trip', error, { tripId: trip.id, userId: profile.id }); throw error }
  }
  const deleteTrip = async (tripId: string) => { const trip = data.trips.find((item) => item.id === tripId); if (!trip) return; try { if (db && signedIn) await deleteTripDocument(db, trip); mutate((current) => ({ ...current, trips: current.trips.filter((item) => item.id !== tripId), notes: current.notes.filter((item) => item.tripId !== tripId), places: current.places.filter((item) => item.tripId !== tripId), segments: current.segments.filter((item) => item.tripId !== tripId), messages: current.messages.filter((item) => item.tripId !== tripId), proposals: current.proposals.filter((item) => item.tripId !== tripId) })) } catch (error) { reportCloudError('delete-trip', error, { tripId, userId: profile.id }); throw error } }
  const shareTrip = async (tripId: string, includeNotes: boolean) => { const trip = data.trips.find((item) => item.id === tripId); if (!trip) throw new Error('TRIP_NOT_FOUND'); if (!db || !signedIn) throw new Error('CLOUD_REQUIRED'); const shareId = trip.publicShareId || uid().replaceAll('-', '').slice(0, 20); try { await publishTripDocument(db, trip, data.places, data.notes, shareId, includeNotes); mutate((current) => ({ ...current, trips: current.trips.map((item) => item.id === tripId ? { ...item, publicShareId: shareId } : item) })); return `${location.origin}${location.pathname}#/shared/${shareId}` } catch (error) { reportCloudError('publish-trip', error, { tripId, userId: profile.id, includeNotes }); throw error } }
  const joinTrip = (code: string) => data.trips.find((trip) => trip.inviteCode === code.trim().toUpperCase()) || null
  const joinCloudTrip = async (code: string) => { if (!db || !signedIn) throw new Error('AUTH_REQUIRED'); try { const trip = await joinTripByCode(db, code, profile); mutate((current) => ({ ...current, trips: [trip, ...current.trips.filter((item) => item.id !== trip.id)] })); return trip.id } catch (error) { reportCloudError('join-trip', error, { inviteCode: code.toUpperCase(), userId: profile.id }); throw error } }
  const addNotePage = async (tripId: string, title = '새 페이지') => { const page: NotePage = { id: uid(), tripId, title, blocks: [{ id: uid(), type: 'paragraph', content: '' }], updatedAt: new Date().toISOString() }; try { if (db && signedIn) await saveNoteDocument(db, page, profile.id); mutate((current) => ({ ...current, notes: [...current.notes.filter((item) => item.id !== page.id), page] })); return page } catch (error) { reportCloudError('create-note', error, { tripId, userId: profile.id }); throw error } }
  const ensureInitialNotePage = async (tripId: string) => {
    const existing = data.notes.find((page) => page.tripId === tripId); if (existing) return existing
    const candidate: NotePage = { id: 'initial', tripId, title: '', blocks: [{ id: 'initial-block', type: 'paragraph', content: '' }], updatedAt: new Date().toISOString() }
    mutate((current) => current.notes.some((page) => page.tripId === tripId) ? current : { ...current, notes: [...current.notes, candidate] })
    try {
      const page = db && signedIn ? await ensureInitialNoteDocument(db, tripId, profile) : candidate
      mutate((current) => { const remaining = current.notes.filter((item) => !(item.tripId === tripId && item.id === candidate.id)); return { ...current, notes: remaining.some((item) => item.id === page.id) ? remaining : [...remaining, page] } })
      return page
    } catch (error) { mutate((current) => ({ ...current, notes: current.notes.filter((item) => !(item.tripId === tripId && item.id === candidate.id)) })); reportCloudError('ensure-initial-note', error, { tripId, userId: profile.id }); throw error }
  }
  const updateNotePage = (pageId: string, changes: Partial<Pick<NotePage, 'title' | 'blocks'>>) => {
    const page = data.notes.find((item) => item.id === pageId); const next = page ? { ...page, ...changes, updatedAt: new Date().toISOString() } : null
    mutate((current) => ({ ...current, notes: current.notes.map((item) => item.id === pageId ? { ...item, ...changes, updatedAt: next?.updatedAt || item.updatedAt } : item) }))
    const database = db
    if (database && signedIn && page && next) { const original = page; const timer = noteSaveTimers.get(pageId); if (timer) clearTimeout(timer); noteSaveTimers.set(pageId, setTimeout(() => { void saveNoteDocument(database, next, profile.id).catch((error) => { mutate((current) => ({ ...current, notes: current.notes.map((item) => item.id === pageId && item.updatedAt === next.updatedAt ? original : item) })); reportCloudError('update-note', error, { tripId: original.tripId, userId: profile.id }) }) }, 800)) }
  }
  const deleteNotePage = async (pageId: string) => { const page = data.notes.find((item) => item.id === pageId); if (!page) return; try { if (db && signedIn) { await deleteNoteDocument(db, page.tripId, pageId); const referencedElsewhere = new Set(data.notes.filter((item) => item.id !== pageId).flatMap((item) => collectAttachmentIds(item.blocks))); await Promise.all(collectAttachmentIds(page.blocks).filter((id) => !referencedElsewhere.has(id)).map((id) => deleteAttachment(db!, page.tripId, id))) } mutate((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== pageId) })) } catch (error) { reportCloudError('delete-note', error, { tripId: page.tripId, userId: profile.id }); throw error } }
  const duplicateNotePage = async (pageId: string) => { const original = data.notes.find((page) => page.id === pageId); if (!original) return undefined; const copy: NotePage = { ...original, id: uid(), title: `${original.title} 복사본`, blocks: original.blocks.map((block) => ({ ...block, id: uid() })), updatedAt: new Date().toISOString() }; try { if (db && signedIn) await saveNoteDocument(db, copy, profile.id); mutate((current) => ({ ...current, notes: [...current.notes.filter((item) => item.id !== copy.id), copy] })); return copy } catch (error) { reportCloudError('duplicate-note', error, { tripId: copy.tripId, userId: profile.id }); throw error } }
  const reorderNotePages = (tripId: string, oldIndex: number, newIndex: number) => mutate((current) => { const own = current.notes.filter((page) => page.tripId === tripId); const moved = own.splice(oldIndex, 1)[0]; if (!moved) return current; own.splice(newIndex, 0, moved); return { ...current, notes: [...current.notes.filter((page) => page.tripId !== tripId), ...own] } })
  const addBlock = (pageId: string, block: Omit<NoteBlock, 'id'>) => { const page = data.notes.find((item) => item.id === pageId); if (page) updateNotePage(pageId, { blocks: [...page.blocks, { ...block, id: uid() }] }) }
  const addPlace = async (input: NewPlaceInput) => { const place: ItineraryPlace = { ...input, id: uid(), sortOrder: data.places.filter((item) => item.tripId === input.tripId && item.day === input.day).length, createdBy: profile.id, createdAt: new Date().toISOString() }; try { if (db && signedIn) await savePlaceDocument(db, place, true); mutate((current) => ({ ...current, places: [...current.places.filter((item) => item.id !== place.id), place] })); return place } catch (error) { reportCloudError('add-place', error, { tripId: input.tripId, userId: profile.id }); throw error } }
  const updatePlace = async (placeId: string, changes: Partial<ItineraryPlace>) => { const place = data.places.find((item) => item.id === placeId); if (!place) return; const next = { ...place, ...changes }; try { if (db && signedIn) await savePlaceDocument(db, next); mutate((current) => ({ ...current, places: current.places.map((item) => item.id === placeId ? next : item) })) } catch (error) { reportCloudError('update-place', error, { tripId: place.tripId, userId: profile.id }); throw error } }
  const deletePlace = async (placeId: string) => { const place = data.places.find((item) => item.id === placeId); if (!place) return; try { if (db && signedIn) await deletePlaceDocument(db, place.tripId, placeId); mutate((current) => ({ ...current, places: current.places.filter((item) => item.id !== placeId), segments: current.segments.filter((segment) => segment.sourcePlaceId !== placeId && segment.destinationPlaceId !== placeId) })) } catch (error) { reportCloudError('delete-place', error, { tripId: place.tripId, userId: profile.id }); throw error } }
  const reorderPlaces = async (tripId: string, day: number, orderedIds: string[]) => { const previous = data.places; mutate((current) => ({ ...current, places: current.places.map((place) => place.tripId === tripId && place.day === day ? { ...place, sortOrder: orderedIds.indexOf(place.id) } : place) })); try { if (db && signedIn) await savePlaceOrder(db, tripId, orderedIds) } catch (error) { mutate((current) => ({ ...current, places: previous })); reportCloudError('reorder-itinerary', error, { tripId, userId: profile.id }); throw error } }
  const upsertSegment = async (segment: TransportSegment) => { try { if (db && signedIn) await saveSegmentDocument(db, segment); mutate((current) => ({ ...current, segments: [...current.segments.filter((item) => item.id !== segment.id), segment] })) } catch (error) { reportCloudError('save-segment', error, { tripId: segment.tripId, userId: profile.id }); throw error } }
  const sendMessage = async (tripId: string, body: string, type: ChatMessage['type'] = 'TEXT', refs: Partial<ChatMessage> = {}) => { const message: ChatMessage = { id: uid(), tripId, body, type, author: profile, createdAt: new Date().toISOString(), ...refs }; try { if (db && signedIn) await saveMessageDocument(db, message); mutate((current) => ({ ...current, messages: [...current.messages.filter((item) => item.id !== message.id), message] })); return message } catch (error) { reportCloudError('send-message', error, { tripId, userId: profile.id }); throw error } }
  const createProposal = async (input: Omit<Proposal, 'id' | 'createdBy' | 'createdAt' | 'status'>) => { const proposal: Proposal = { ...input, id: uid(), createdBy: profile.id, createdAt: new Date().toISOString(), status: 'OPEN' }; const message: ChatMessage = { id: uid(), tripId: input.tripId, type: 'PROPOSAL', body: input.description, author: profile, createdAt: new Date().toISOString(), proposalId: proposal.id }; try { if (db && signedIn) await createProposalDocument(db, proposal, message); mutate((current) => ({ ...current, proposals: [...current.proposals.filter((item) => item.id !== proposal.id), proposal], messages: [...current.messages.filter((item) => item.id !== message.id), message] })); return proposal } catch (error) { reportCloudError('create-proposal', error, { tripId: input.tripId, userId: profile.id }); throw error } }
  const vote = async (proposalId: string, optionId: string) => { const proposal = data.proposals.find((item) => item.id === proposalId); if (!proposal) return; try { if (db && signedIn) await saveVote(db, proposal.tripId, proposalId, optionId, profile.id); mutate((current) => ({ ...current, proposals: current.proposals.map((item) => item.id !== proposalId ? item : { ...item, options: item.options.map((option): PollOption => ({ ...option, voterIds: option.id === optionId ? Array.from(new Set([...option.voterIds.filter((id) => id !== profile.id), profile.id])) : option.voterIds.filter((id) => id !== profile.id) })) }) })) } catch (error) { reportCloudError('vote', error, { tripId: proposal.tripId, proposalId, userId: profile.id }); throw error } }
  const setProposalStatus = async (proposalId: string, status: Proposal['status']) => { const proposal = data.proposals.find((item) => item.id === proposalId); if (!proposal) return; try { if (db && signedIn) await saveProposalStatus(db, proposal.tripId, proposalId, status); mutate((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === proposalId ? { ...item, status } : item) })) } catch (error) { reportCloudError('set-proposal-status', error, { tripId: proposal.tripId, proposalId, userId: profile.id }); throw error } }

  return <AppContext.Provider value={{ data, profile, ready, online, cloudMode: isFirebaseConfigured, signedIn, cloudError, clearCloudError, signIn, signUp, signOut, setProfileName, createTrip, deleteTrip, shareTrip, joinTrip, joinCloudTrip, addNotePage, ensureInitialNotePage, updateNotePage, deleteNotePage, duplicateNotePage, reorderNotePages, addBlock, addPlace, updatePlace, deletePlace, reorderPlaces, upsertSegment, sendMessage, createProposal, vote, setProposalStatus }}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => { const value = useContext(AppContext); if (!value) throw new Error('AppProvider is missing'); return value }
