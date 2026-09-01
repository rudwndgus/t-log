import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type DocumentReference, type Firestore, type Unsubscribe } from 'firebase/firestore'
import type { ChatMessage, ItineraryPlace, NotePage, Profile, Proposal, TLogData, TransportSegment, Trip, TripMember } from '../types'

const emptyData: TLogData = { trips: [], notes: [], places: [], segments: [], messages: [], proposals: [] }
const asIso = (value: unknown) => value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate().toISOString() : typeof value === 'string' ? value : new Date().toISOString()

export function subscribeToUserData(database: Firestore, userId: string, onData: (data: TLogData) => void, onError: (error: Error, context?: Record<string, unknown>) => void): Unsubscribe {
  let childUnsubscribers: Unsubscribe[] = []
  let trips: Trip[] = []; const members = new Map<string, TripMember[]>(); const notes = new Map<string, NotePage[]>(); const places = new Map<string, ItineraryPlace[]>(); const segments = new Map<string, TransportSegment[]>(); const messages = new Map<string, ChatMessage[]>(); const proposals = new Map<string, Proposal[]>()
  const emit = () => onData({ trips: trips.map((trip) => ({ ...trip, members: members.get(trip.id) || trip.members })), notes: Array.from(notes.values()).flat(), places: Array.from(places.values()).flat(), segments: Array.from(segments.values()).flat(), messages: Array.from(messages.values()).flat(), proposals: Array.from(proposals.values()).flat() })
  const listen = <T>(tripId: string, path: string, target: Map<string, T[]>, mapRow: (id: string, row: Record<string, unknown>) => T, sortField?: string) => {
    const base = collection(database, 'trips', tripId, path); const source = sortField ? query(base, orderBy(sortField)) : base
    childUnsubscribers.push(onSnapshot(source, (snapshot) => { target.set(tripId, snapshot.docs.map((item) => mapRow(item.id, item.data()))); emit() }, (error) => onError(error, { tripId, collection: path })))
  }
  const tripQuery = query(collection(database, 'trips'), where('memberIds', 'array-contains', userId))
  const unsubscribeTrips = onSnapshot(tripQuery, { includeMetadataChanges: true }, (snapshot) => {
    // A local latency-compensated trip snapshot can arrive before the create
    // batch is acknowledged. Starting child listeners at that point makes the
    // server evaluate membership against a parent that does not exist yet.
    if (snapshot.metadata.hasPendingWrites) return
    childUnsubscribers.forEach((unsubscribe) => unsubscribe()); childUnsubscribers = []; members.clear(); notes.clear(); places.clear(); segments.clear(); messages.clear(); proposals.clear()
    trips = snapshot.docs.map((item): Trip => { const row = item.data(); return { id: item.id, name: row.name, destination: row.destination, startDate: row.startDate, endDate: row.endDate, emoji: row.emoji || '✈️', inviteCode: row.inviteCode, members: [], createdBy: row.ownerId, createdAt: asIso(row.createdAt), publicShareId: row.publicShareId ? String(row.publicShareId) : undefined } }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    trips.forEach((trip) => {
      listen<TripMember>(trip.id, 'members', members, (id, row) => ({ id, profile: { id: String(row.userId), name: String(row.displayName || '여행자'), email: row.email ? String(row.email) : undefined }, role: row.role === 'owner' ? 'OWNER' : 'MEMBER' }))
      listen<NotePage>(trip.id, 'notes', notes, (id, row) => ({ id, tripId: trip.id, title: typeof row.title === 'string' ? row.title : '새 페이지', blocks: Array.isArray(row.blocks) ? row.blocks as NotePage['blocks'] : [], updatedAt: asIso(row.updatedAt) }))
      listen<ItineraryPlace>(trip.id, 'places', places, (id, row) => ({ id, tripId: trip.id, day: Number(row.day || 0), name: String(row.name || 'Pinned location'), address: String(row.address || ''), latitude: Number(row.latitude), longitude: Number(row.longitude), startTime: row.startTime ? String(row.startTime) : undefined, endTime: row.endTime ? String(row.endTime) : undefined, notes: row.notes ? String(row.notes) : undefined, link: row.link ? String(row.link) : undefined, googleMapsUrl: row.googleMapsUrl ? String(row.googleMapsUrl) : undefined, providerPlaceId: row.providerPlaceId ? String(row.providerPlaceId) : undefined, sortOrder: Number(row.sortOrder || 0), category: row.category ? String(row.category) : undefined, source: row.source as ItineraryPlace['source'], createdBy: String(row.createdBy), createdAt: asIso(row.createdAt) }))
      listen<TransportSegment>(trip.id, 'segments', segments, (id, row) => ({ id, tripId: trip.id, day: Number(row.day || 0), sourcePlaceId: String(row.sourcePlaceId), destinationPlaceId: String(row.destinationPlaceId), mode: row.mode as TransportSegment['mode'], duration: row.duration ? Number(row.duration) : undefined, distance: row.distance ? Number(row.distance) : undefined, notes: row.notes ? String(row.notes) : undefined }))
      listen<ChatMessage>(trip.id, 'messages', messages, (id, row) => ({ id, tripId: trip.id, type: row.type as ChatMessage['type'], body: row.body ? String(row.body) : undefined, author: row.author as Profile, createdAt: asIso(row.createdAt), referencedNotePageId: row.referencedNotePageId ? String(row.referencedNotePageId) : undefined, referencedPlaceId: row.referencedPlaceId ? String(row.referencedPlaceId) : undefined, proposalId: row.proposalId ? String(row.proposalId) : undefined }), 'createdAt')
      listen<Proposal>(trip.id, 'proposals', proposals, (id, row) => ({ id, tripId: trip.id, title: String(row.title), description: row.description ? String(row.description) : undefined, status: row.status as Proposal['status'], options: Array.isArray(row.options) ? row.options as Proposal['options'] : [], referencedNotePageId: row.referencedNotePageId ? String(row.referencedNotePageId) : undefined, referencedPlaceId: row.referencedPlaceId ? String(row.referencedPlaceId) : undefined, proposedPlace: row.proposedPlace as Proposal['proposedPlace'], createdBy: String(row.createdBy), createdAt: asIso(row.createdAt) }))
    }); emit()
  }, (error) => onError(error, { collection: 'trips' }))
  return () => { unsubscribeTrips(); childUnsubscribers.forEach((unsubscribe) => unsubscribe()); onData(emptyData) }
}

export async function saveProfile(database: Firestore, profile: Profile) { await setDoc(doc(database, 'users', profile.id), { displayName: profile.name, email: profile.email || null, updatedAt: serverTimestamp() }, { merge: true }) }
export async function createTripDocument(database: Firestore, trip: Trip, profile: Profile) {
  const batch = writeBatch(database); const tripRef = doc(database, 'trips', trip.id)
  batch.set(tripRef, { name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, emoji: trip.emoji, inviteCode: trip.inviteCode, ownerId: profile.id, memberIds: [profile.id], createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  batch.set(doc(tripRef, 'members', profile.id), { userId: profile.id, role: 'owner', displayName: profile.name, email: profile.email || null, joinedAt: serverTimestamp() })
  batch.set(doc(database, 'inviteCodes', trip.inviteCode), { tripId: trip.id, createdBy: profile.id, createdAt: serverTimestamp() })
  await batch.commit()
}
export async function joinTripByCode(database: Firestore, code: string, profile: Profile) {
  const invite = await getDoc(doc(database, 'inviteCodes', code.toUpperCase())); if (!invite.exists()) throw new Error('INVALID_INVITE')
  const tripId = String(invite.data().tripId); const tripRef = doc(database, 'trips', tripId)
  const tripSnapshot = await getDoc(tripRef); if (!tripSnapshot.exists()) throw new Error('INVALID_INVITE')
  const row = tripSnapshot.data(); const batch = writeBatch(database)
  batch.update(tripRef, { memberIds: arrayUnion(profile.id), updatedAt: serverTimestamp() })
  batch.set(doc(tripRef, 'members', profile.id), { userId: profile.id, role: 'member', displayName: profile.name, email: profile.email || null, joinedAt: serverTimestamp() })
  await batch.commit()
  return {
    id: tripId, name: String(row.name), destination: String(row.destination), startDate: String(row.startDate),
    endDate: String(row.endDate), emoji: String(row.emoji || '✈️'), inviteCode: String(row.inviteCode),
    members: [{ id: profile.id, profile, role: 'MEMBER' as const }], createdBy: String(row.ownerId),
    createdAt: asIso(row.createdAt), publicShareId: row.publicShareId ? String(row.publicShareId) : undefined
  }
}
export const saveNoteDocument = (database: Firestore, page: NotePage, createdBy: string) => setDoc(doc(database, 'trips', page.tripId, 'notes', page.id), { title: page.title, blocks: page.blocks, createdBy, updatedAt: serverTimestamp() }, { merge: true })
export async function ensureInitialNoteDocument(database: Firestore, tripId: string, profile: Profile): Promise<NotePage> {
  const existing = await getDocs(query(collection(database, 'trips', tripId, 'notes'), limit(1)))
  if (!existing.empty) {
    const snapshot = existing.docs[0]; const row = snapshot.data()
    return { id: snapshot.id, tripId, title: typeof row.title === 'string' ? row.title : '', blocks: Array.isArray(row.blocks) ? row.blocks as NotePage['blocks'] : [], updatedAt: asIso(row.updatedAt) }
  }
  const page: NotePage = { id: 'initial', tripId, title: '', blocks: [{ id: 'initial-block', type: 'paragraph', content: '' }], updatedAt: new Date().toISOString() }
  const reference = doc(database, 'trips', tripId, 'notes', page.id)
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) transaction.set(reference, { title: page.title, blocks: page.blocks, createdBy: profile.id, updatedAt: serverTimestamp() })
  })
  return page
}
export const deleteNoteDocument = (database: Firestore, tripId: string, pageId: string) => deleteDoc(doc(database, 'trips', tripId, 'notes', pageId))
export const savePlaceDocument = (database: Firestore, place: ItineraryPlace, creating = false) => { const { id, tripId, createdAt: _createdAt, ...fields } = place; void _createdAt; return setDoc(doc(database, 'trips', tripId, 'places', id), { ...fields, ...(creating ? { createdAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() }, { merge: true }) }
export const deletePlaceDocument = (database: Firestore, tripId: string, placeId: string) => deleteDoc(doc(database, 'trips', tripId, 'places', placeId))
export async function savePlaceOrder(database: Firestore, tripId: string, orderedIds: string[]) { const batch = writeBatch(database); orderedIds.forEach((id, sortOrder) => batch.update(doc(database, 'trips', tripId, 'places', id), { sortOrder, updatedAt: serverTimestamp() })); await batch.commit() }
export const saveSegmentDocument = (database: Firestore, segment: TransportSegment) => setDoc(doc(database, 'trips', segment.tripId, 'segments', segment.id), { ...segment, updatedAt: serverTimestamp() }, { merge: true })
export const saveMessageDocument = (database: Firestore, message: ChatMessage) => setDoc(doc(database, 'trips', message.tripId, 'messages', message.id), { ...message, createdAt: serverTimestamp() })
export async function createProposalDocument(database: Firestore, proposal: Proposal, message: ChatMessage) { const batch = writeBatch(database); batch.set(doc(database, 'trips', proposal.tripId, 'proposals', proposal.id), { ...proposal, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); batch.set(doc(database, 'trips', message.tripId, 'messages', message.id), { ...message, createdAt: serverTimestamp() }); await batch.commit() }
export async function saveVote(database: Firestore, tripId: string, proposalId: string, optionId: string, userId: string) {
  const proposalRef = doc(database, 'trips', tripId, 'proposals', proposalId); const voteRef = doc(proposalRef, 'votes', userId)
  await runTransaction(database, async (transaction) => { const snapshot = await transaction.get(proposalRef); if (!snapshot.exists()) throw new Error('PROPOSAL_NOT_FOUND'); const options = (snapshot.data().options || []) as Proposal['options']; const updated = options.map((option) => ({ ...option, voterIds: option.id === optionId ? Array.from(new Set([...option.voterIds.filter((id) => id !== userId), userId])) : option.voterIds.filter((id) => id !== userId) })); transaction.update(proposalRef, { options: updated, updatedAt: serverTimestamp() }); transaction.set(voteRef, { userId, optionId, updatedAt: serverTimestamp() }) })
}
export const saveProposalStatus = (database: Firestore, tripId: string, proposalId: string, status: Proposal['status']) => updateDoc(doc(database, 'trips', tripId, 'proposals', proposalId), { status, updatedAt: serverTimestamp() })

const publicPlaceFields = (place: ItineraryPlace) => ({
  id: place.id, day: place.day, name: place.name, address: place.address,
  latitude: place.latitude, longitude: place.longitude, startTime: place.startTime || null,
  endTime: place.endTime || null, sortOrder: place.sortOrder, category: place.category || null
})

export interface PublicTrip {
  id: string
  sourceTripId: string
  name: string
  destination: string
  startDate: string
  endDate: string
  emoji: string
  places: ItineraryPlace[]
}

export async function publishTripDocument(database: Firestore, trip: Trip, places: ItineraryPlace[], shareId: string, userId: string) {
  const batch = writeBatch(database)
  batch.set(doc(database, 'publicTrips', shareId), {
    sourceTripId: trip.id, ownerId: userId, name: trip.name, destination: trip.destination,
    startDate: trip.startDate, endDate: trip.endDate, emoji: trip.emoji,
    places: places.filter((place) => place.tripId === trip.id).map(publicPlaceFields),
    publishedAt: serverTimestamp(), updatedAt: serverTimestamp()
  })
  batch.update(doc(database, 'trips', trip.id), { publicShareId: shareId, updatedAt: serverTimestamp() })
  await batch.commit()
}

export async function getPublicTrip(database: Firestore, shareId: string): Promise<PublicTrip | null> {
  const snapshot = await getDoc(doc(database, 'publicTrips', shareId))
  if (!snapshot.exists()) return null
  const row = snapshot.data(); const rawPlaces = Array.isArray(row.places) ? row.places as Array<Record<string, unknown>> : []
  return {
    id: shareId, sourceTripId: String(row.sourceTripId), name: String(row.name), destination: String(row.destination),
    startDate: String(row.startDate), endDate: String(row.endDate), emoji: String(row.emoji || '✈️'),
    places: rawPlaces.map((place, index): ItineraryPlace => ({
      id: String(place.id || index), tripId: shareId, day: Number(place.day || 0), name: String(place.name || '장소'),
      address: String(place.address || ''), latitude: Number(place.latitude), longitude: Number(place.longitude),
      startTime: place.startTime ? String(place.startTime) : undefined, endTime: place.endTime ? String(place.endTime) : undefined,
      sortOrder: Number(place.sortOrder || 0), category: place.category ? String(place.category) : undefined,
      source: 'manual_pin', createdBy: 'public', createdAt: ''
    }))
  }
}

async function collectionReferences(database: Firestore, ...path: string[]) {
  const [first, ...rest] = path
  if (!first) return []
  return (await getDocs(collection(database, first, ...rest))).docs.map((snapshot) => snapshot.ref)
}

async function deleteReferences(database: Firestore, references: DocumentReference[]) {
  for (let offset = 0; offset < references.length; offset += 450) {
    const batch = writeBatch(database)
    references.slice(offset, offset + 450).forEach((reference) => batch.delete(reference))
    await batch.commit()
  }
}

export async function deleteTripDocument(database: Firestore, trip: Trip) {
  const childNames = ['members', 'notes', 'places', 'segments', 'messages', 'proposals', 'attachments']
  const childGroups = await Promise.all(childNames.map((name) => collectionReferences(database, 'trips', trip.id, name)))
  const proposalReferences = childGroups[5]
  const attachmentReferences = childGroups[6]
  const voteGroups = await Promise.all(proposalReferences.map((proposal) => collectionReferences(database, 'trips', trip.id, 'proposals', proposal.id, 'votes')))
  const chunkGroups = await Promise.all(attachmentReferences.map((attachment) => collectionReferences(database, 'trips', trip.id, 'attachments', attachment.id, 'chunks')))
  await deleteReferences(database, voteGroups.flat())
  await deleteReferences(database, chunkGroups.flat())
  await deleteReferences(database, childGroups.flat())
  const finalBatch = writeBatch(database)
  finalBatch.delete(doc(database, 'inviteCodes', trip.inviteCode))
  if (trip.publicShareId) finalBatch.delete(doc(database, 'publicTrips', trip.publicShareId))
  finalBatch.delete(doc(database, 'trips', trip.id))
  await finalBatch.commit()
}
