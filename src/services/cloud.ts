import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage, ItineraryPlace, NoteBlock, NotePage, Profile, Proposal, TLogData, TransportSegment, Trip, TripMember } from '../types'

const rows = <T>(value: T[] | null) => value || []

export async function loadCloudData(client: SupabaseClient): Promise<TLogData> {
  const { data: tripRows, error } = await client.from('trips').select('*').order('created_at', { ascending: false })
  if (error) throw error
  const tripIds = rows(tripRows).map((trip) => trip.id)
  if (!tripIds.length) return { trips: [], notes: [], places: [], segments: [], messages: [], proposals: [] }

  const [membersResult, pagesResult, blocksResult, daysResult, placesResult, segmentsResult, messagesResult, proposalsResult, optionsResult, votesResult] = await Promise.all([
    client.from('trip_members').select('*').in('trip_id', tripIds),
    client.from('note_pages').select('*').in('trip_id', tripIds).order('position'),
    client.from('note_blocks').select('*, note_pages!inner(trip_id)').in('note_pages.trip_id', tripIds).order('position'),
    client.from('itinerary_days').select('*').in('trip_id', tripIds),
    client.from('itinerary_places').select('*').in('trip_id', tripIds).order('sort_order'),
    client.from('transport_segments').select('*').in('trip_id', tripIds),
    client.from('chat_messages').select('*').in('trip_id', tripIds).order('created_at'),
    client.from('proposals').select('*').in('trip_id', tripIds),
    client.from('poll_options').select('*, proposals!inner(trip_id)').in('proposals.trip_id', tripIds).order('position'),
    client.from('poll_votes').select('*, proposals!inner(trip_id)').in('proposals.trip_id', tripIds)
  ])
  const members = rows(membersResult.data)
  const userIds = Array.from(new Set([...members.map((member) => member.user_id), ...rows(messagesResult.data).map((message) => message.sender_id)]))
  let profileRows: Profile[] = []
  if (userIds.length) { const result = await client.from('profiles').select('id,name').in('id', userIds); profileRows = (result.data || []) as Profile[] }
  const profiles = new Map(profileRows.map((profile) => [profile.id, profile]))
  const dayRows = rows(daysResult.data); const dayById = new Map(dayRows.map((day) => [day.id, day.day_index]))
  const blockRows = rows(blocksResult.data); const optionRows = rows(optionsResult.data); const voteRows = rows(votesResult.data)

  const trips: Trip[] = rows(tripRows).map((trip) => ({
    id: trip.id, name: trip.name, destination: trip.destination, startDate: trip.start_date, endDate: trip.end_date, emoji: trip.emoji, inviteCode: trip.invite_code, createdBy: trip.created_by, createdAt: trip.created_at,
    members: members.filter((member) => member.trip_id === trip.id).map((member): TripMember => ({ id: `${member.trip_id}:${member.user_id}`, profile: profiles.get(member.user_id) || { id: member.user_id, name: '여행자' }, role: member.role }))
  }))
  const notes: NotePage[] = rows(pagesResult.data).map((page) => ({ id: page.id, tripId: page.trip_id, title: page.title, updatedAt: page.updated_at, blocks: blockRows.filter((block) => block.page_id === page.id).map((block): NoteBlock => ({ id: block.id, type: block.type, content: typeof block.content === 'string' ? block.content : block.content?.text || '', checked: block.content?.checked })) }))
  const places: ItineraryPlace[] = rows(placesResult.data).map((place) => ({ id: place.id, tripId: place.trip_id, day: dayById.get(place.day_id) || 0, name: place.name, address: place.address || '', latitude: place.latitude, longitude: place.longitude, startTime: place.start_time?.slice(0, 5), endTime: place.end_time?.slice(0, 5), notes: place.notes, link: place.link, providerPlaceId: place.provider_place_id, sortOrder: place.sort_order, category: place.category, createdBy: place.created_by, createdAt: place.created_at }))
  const segments: TransportSegment[] = rows(segmentsResult.data).map((segment) => ({ id: segment.id, tripId: segment.trip_id, day: places.find((place) => place.id === segment.source_place_id)?.day || 0, sourcePlaceId: segment.source_place_id, destinationPlaceId: segment.destination_place_id, mode: segment.mode, duration: segment.duration_minutes, distance: segment.distance_km ? Number(segment.distance_km) : undefined, notes: segment.notes }))
  const messages: ChatMessage[] = rows(messagesResult.data).map((message) => { const metadata = message.metadata || {}; return { id: message.id, tripId: message.trip_id, type: message.type, body: message.body, author: profiles.get(message.sender_id) || { id: message.sender_id, name: '여행자' }, createdAt: message.created_at, referencedNotePageId: metadata.referencedNotePageId, referencedPlaceId: metadata.referencedPlaceId, proposalId: metadata.proposalId } })
  const proposals: Proposal[] = rows(proposalsResult.data).map((proposal) => ({ id: proposal.id, tripId: proposal.trip_id, title: proposal.title, description: proposal.description, status: proposal.status, referencedNotePageId: proposal.referenced_note_page_id, referencedPlaceId: proposal.referenced_place_id, proposedPlace: proposal.proposed_place, createdBy: proposal.created_by, createdAt: proposal.created_at, options: optionRows.filter((option) => option.proposal_id === proposal.id).map((option) => ({ id: option.id, label: option.label, voterIds: voteRows.filter((vote) => vote.option_id === option.id).map((vote) => vote.user_id) })) }))
  return { trips, notes, places, segments, messages, proposals }
}

export async function ensureCloudDay(client: SupabaseClient, tripId: string, day: number, startDate: string) {
  const existing = await client.from('itinerary_days').select('id').eq('trip_id', tripId).eq('day_index', day).maybeSingle()
  if (existing.data) return existing.data.id as string
  const date = new Date(`${startDate}T12:00:00`); date.setDate(date.getDate() + day)
  const created = await client.from('itinerary_days').insert({ trip_id: tripId, day_index: day, date: date.toISOString().slice(0, 10) }).select('id').single()
  if (created.error) throw created.error
  return created.data.id as string
}
