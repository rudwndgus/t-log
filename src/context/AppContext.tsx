import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import { inviteCode, uid } from '../lib/utils'
import { createProposalDocument, createTripDocument, deleteNoteDocument, deletePlaceDocument, joinTripByCode, saveMessageDocument, saveNoteDocument, savePlaceDocument, savePlaceOrder, saveProfile, saveProposalStatus, saveSegmentDocument, saveVote, subscribeToUserData } from '../services/firestore'
import { loadLocalData, saveLocalData } from '../services/localStore'
import type { ChatMessage, ItineraryPlace, NoteBlock, NotePage, PollOption, Profile, Proposal, TLogData, TransportSegment, Trip } from '../types'

const PROFILE_KEY = 'tlog:profile:v2'
const emptyData: TLogData = { trips: [], notes: [], places: [], segments: [], messages: [], proposals: [] }
const fallbackProfile: Profile = { id: 'local-user', name: '여행자' }
const noteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface CreateTripInput { name: string; destination: string; startDate: string; endDate: string; emoji: string }
type NewPlaceInput = Omit<ItineraryPlace, 'id' | 'sortOrder' | 'createdBy' | 'createdAt'>
interface AppContextValue {
  data: TLogData; profile: Profile; ready: boolean; online: boolean; cloudMode: boolean; signedIn: boolean
  signIn: (email: string, password: string) => Promise<void>; signUp: (name: string, email: string, password: string) => Promise<void>; signOut: () => Promise<void>; setProfileName: (name: string) => void
  createTrip: (input: CreateTripInput) => Trip; joinTrip: (code: string) => Trip | null; joinCloudTrip: (code: string) => Promise<string>
  addNotePage: (tripId: string, title?: string) => NotePage; updateNotePage: (pageId: string, changes: Partial<Pick<NotePage, 'title' | 'blocks'>>) => void; deleteNotePage: (pageId: string) => void; duplicateNotePage: (pageId: string) => void; reorderNotePages: (tripId: string, oldIndex: number, newIndex: number) => void; addBlock: (pageId: string, block: Omit<NoteBlock, 'id'>) => void
  addPlace: (input: NewPlaceInput) => ItineraryPlace; updatePlace: (placeId: string, changes: Partial<ItineraryPlace>) => void; deletePlace: (placeId: string) => void; reorderPlaces: (tripId: string, day: number, orderedIds: string[]) => void; upsertSegment: (segment: TransportSegment) => void
  sendMessage: (tripId: string, body: string, type?: ChatMessage['type'], refs?: Partial<ChatMessage>) => void; createProposal: (input: Omit<Proposal, 'id' | 'createdBy' | 'createdAt' | 'status'>) => Proposal; vote: (proposalId: string, optionId: string) => void; setProposalStatus: (proposalId: string, status: Proposal['status']) => void
}

const AppContext = createContext<AppContextValue | null>(null)
const readProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || localStorage.getItem('tlog:profile:v1') || '') as Profile } catch { return fallbackProfile } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TLogData>(emptyData); const [profile, setProfile] = useState<Profile>(readProfile); const [ready, setReady] = useState(false); const [online, setOnline] = useState(navigator.onLine); const [signedIn, setSignedIn] = useState(false)
  const mutate = useCallback((fn: (previous: TLogData) => TLogData) => setData((previous) => fn(previous)), [])

  useEffect(() => { const onOnline = () => setOnline(true); const onOffline = () => setOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) } }, [])
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) }, [profile])
  useEffect(() => { if (!isFirebaseConfigured) void loadLocalData(emptyData).then((stored) => { setData(stored); setReady(true) }) }, [])
  useEffect(() => { if (!isFirebaseConfigured && ready) void saveLocalData(data) }, [data, ready])
  useEffect(() => {
    const firebaseAuth = auth; const database = db
    if (!firebaseAuth || !database) return
    let unsubscribeData: (() => void) | undefined
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribeData?.(); unsubscribeData = undefined
      if (!user) { setSignedIn(false); setData(emptyData); setReady(true); return }
      const nextProfile: Profile = { id: user.uid, name: user.displayName || user.email?.split('@')[0] || '여행자', email: user.email || undefined }
      setProfile(nextProfile); setSignedIn(true); void saveProfile(database, nextProfile)
      unsubscribeData = subscribeToUserData(database, user.uid, setData, () => setReady(true)); setReady(true)
    })
    return () => { unsubscribeAuth(); unsubscribeData?.() }
  }, [])

  const signIn = async (email: string, password: string) => { if (!auth) throw new Error('NOT_CONFIGURED'); await signInWithEmailAndPassword(auth, email, password) }
  const signUp = async (name: string, email: string, password: string) => { if (!auth || !db) throw new Error('NOT_CONFIGURED'); const credential = await createUserWithEmailAndPassword(auth, email, password); const nextProfile = { id: credential.user.uid, name: name.trim(), email }; await updateProfile(credential.user, { displayName: name.trim() }); await saveProfile(db, nextProfile); setProfile(nextProfile) }
  const signOut = async () => { if (auth) await firebaseSignOut(auth); setSignedIn(false); setData(emptyData); setProfile(fallbackProfile) }
  const setProfileName = (name: string) => { const next = name.trim() || '여행자'; const updated = { ...profile, name: next }; setProfile(updated); if (auth?.currentUser) void updateProfile(auth.currentUser, { displayName: next }); if (db && signedIn) void saveProfile(db, updated) }

  const createTrip = (input: CreateTripInput) => { const trip: Trip = { id: uid(), ...input, inviteCode: inviteCode(), createdBy: profile.id, createdAt: new Date().toISOString(), members: [{ id: profile.id, profile, role: 'OWNER' }] }; mutate((current) => ({ ...current, trips: [trip, ...current.trips] })); if (db && signedIn) void createTripDocument(db, trip, profile); return trip }
  const joinTrip = (code: string) => data.trips.find((trip) => trip.inviteCode === code.trim().toUpperCase()) || null
  const joinCloudTrip = async (code: string) => { if (!db || !signedIn) throw new Error('AUTH_REQUIRED'); return joinTripByCode(db, code, profile) }
  const addNotePage = (tripId: string, title = '새 페이지') => { const page: NotePage = { id: uid(), tripId, title, blocks: [{ id: uid(), type: 'paragraph', content: '' }], updatedAt: new Date().toISOString() }; mutate((current) => ({ ...current, notes: [...current.notes, page] })); if (db && signedIn) void saveNoteDocument(db, page, profile.id); return page }
  const updateNotePage = (pageId: string, changes: Partial<Pick<NotePage, 'title' | 'blocks'>>) => { const page = data.notes.find((item) => item.id === pageId); const next = page ? { ...page, ...changes, updatedAt: new Date().toISOString() } : null; mutate((current) => ({ ...current, notes: current.notes.map((item) => item.id === pageId ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })); if (db && signedIn && next) { const timer = noteSaveTimers.get(pageId); if (timer) clearTimeout(timer); noteSaveTimers.set(pageId, setTimeout(() => { if (db) void saveNoteDocument(db, next, profile.id) }, 800)) } }
  const deleteNotePage = (pageId: string) => { const page = data.notes.find((item) => item.id === pageId); mutate((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== pageId) })); if (db && signedIn && page) void deleteNoteDocument(db, page.tripId, pageId) }
  const duplicateNotePage = (pageId: string) => { const original = data.notes.find((page) => page.id === pageId); if (!original) return; const copy: NotePage = { ...original, id: uid(), title: `${original.title} 복사본`, blocks: original.blocks.map((block) => ({ ...block, id: uid() })), updatedAt: new Date().toISOString() }; mutate((current) => ({ ...current, notes: [...current.notes, copy] })); if (db && signedIn) void saveNoteDocument(db, copy, profile.id) }
  const reorderNotePages = (tripId: string, oldIndex: number, newIndex: number) => mutate((current) => { const own = current.notes.filter((page) => page.tripId === tripId); const moved = own.splice(oldIndex, 1)[0]; if (!moved) return current; own.splice(newIndex, 0, moved); return { ...current, notes: [...current.notes.filter((page) => page.tripId !== tripId), ...own] } })
  const addBlock = (pageId: string, block: Omit<NoteBlock, 'id'>) => { const page = data.notes.find((item) => item.id === pageId); if (page) updateNotePage(pageId, { blocks: [...page.blocks, { ...block, id: uid() }] }) }
  const addPlace = (input: NewPlaceInput) => { const place: ItineraryPlace = { ...input, id: uid(), sortOrder: data.places.filter((item) => item.tripId === input.tripId && item.day === input.day).length, createdBy: profile.id, createdAt: new Date().toISOString() }; mutate((current) => ({ ...current, places: [...current.places, place] })); if (db && signedIn) void savePlaceDocument(db, place, true); return place }
  const updatePlace = (placeId: string, changes: Partial<ItineraryPlace>) => { const place = data.places.find((item) => item.id === placeId); const next = place ? { ...place, ...changes } : null; mutate((current) => ({ ...current, places: current.places.map((item) => item.id === placeId ? { ...item, ...changes } : item) })); if (db && signedIn && next) void savePlaceDocument(db, next) }
  const deletePlace = (placeId: string) => { const place = data.places.find((item) => item.id === placeId); mutate((current) => ({ ...current, places: current.places.filter((item) => item.id !== placeId), segments: current.segments.filter((segment) => segment.sourcePlaceId !== placeId && segment.destinationPlaceId !== placeId) })); if (db && signedIn && place) void deletePlaceDocument(db, place.tripId, placeId) }
  const reorderPlaces = (tripId: string, day: number, orderedIds: string[]) => { mutate((current) => ({ ...current, places: current.places.map((place) => place.tripId === tripId && place.day === day ? { ...place, sortOrder: orderedIds.indexOf(place.id) } : place) })); if (db && signedIn) void savePlaceOrder(db, tripId, orderedIds) }
  const upsertSegment = (segment: TransportSegment) => { mutate((current) => ({ ...current, segments: [...current.segments.filter((item) => item.id !== segment.id), segment] })); if (db && signedIn) void saveSegmentDocument(db, segment) }
  const sendMessage = (tripId: string, body: string, type: ChatMessage['type'] = 'TEXT', refs: Partial<ChatMessage> = {}) => { const message: ChatMessage = { id: uid(), tripId, body, type, author: profile, createdAt: new Date().toISOString(), ...refs }; mutate((current) => ({ ...current, messages: [...current.messages, message] })); if (db && signedIn) void saveMessageDocument(db, message) }
  const createProposal = (input: Omit<Proposal, 'id' | 'createdBy' | 'createdAt' | 'status'>) => { const proposal: Proposal = { ...input, id: uid(), createdBy: profile.id, createdAt: new Date().toISOString(), status: 'OPEN' }; const message: ChatMessage = { id: uid(), tripId: input.tripId, type: 'PROPOSAL', body: input.description, author: profile, createdAt: new Date().toISOString(), proposalId: proposal.id }; mutate((current) => ({ ...current, proposals: [...current.proposals, proposal], messages: [...current.messages, message] })); if (db && signedIn) void createProposalDocument(db, proposal, message); return proposal }
  const vote = (proposalId: string, optionId: string) => { const proposal = data.proposals.find((item) => item.id === proposalId); mutate((current) => ({ ...current, proposals: current.proposals.map((item) => item.id !== proposalId ? item : { ...item, options: item.options.map((option): PollOption => ({ ...option, voterIds: option.id === optionId ? Array.from(new Set([...option.voterIds.filter((id) => id !== profile.id), profile.id])) : option.voterIds.filter((id) => id !== profile.id) })) }) })); if (db && signedIn && proposal) void saveVote(db, proposal.tripId, proposalId, optionId, profile.id) }
  const setProposalStatus = (proposalId: string, status: Proposal['status']) => { const proposal = data.proposals.find((item) => item.id === proposalId); mutate((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === proposalId ? { ...item, status } : item) })); if (db && signedIn && proposal) void saveProposalStatus(db, proposal.tripId, proposalId, status) }

  return <AppContext.Provider value={{ data, profile, ready, online, cloudMode: isFirebaseConfigured, signedIn, signIn, signUp, signOut, setProfileName, createTrip, joinTrip, joinCloudTrip, addNotePage, updateNotePage, deleteNotePage, duplicateNotePage, reorderNotePages, addBlock, addPlace, updatePlace, deletePlace, reorderPlaces, upsertSegment, sendMessage, createProposal, vote, setProposalStatus }}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => { const value = useContext(AppContext); if (!value) throw new Error('AppProvider is missing'); return value }
