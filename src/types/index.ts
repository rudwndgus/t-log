export type TripRole = 'OWNER' | 'MEMBER'
export type ProposalStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type MessageType = 'TEXT' | 'NOTE_SHARE' | 'PLACE_SHARE' | 'PROPOSAL' | 'POLL' | 'DECISION' | 'SYSTEM'
export type TransportMode = 'walk' | 'driving' | 'cycling' | 'bus' | 'train' | 'plane' | 'transit' | 'ferry' | 'shuttle' | 'other'
export type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'todo' | 'toggle' | 'quote' | 'divider' | 'link' | 'location' | 'image' | 'file' | 'embed'

export interface Profile { id: string; name: string; email?: string }
export interface TripMember { id: string; profile: Profile; role: TripRole }
export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  emoji: string
  inviteCode: string
  members: TripMember[]
  createdBy: string
  createdAt: string
  publicShareId?: string
}
export interface NoteBlock { id: string; type: BlockType; content: string; checked?: boolean; children?: NoteBlock[]; collapsed?: boolean; attachmentId?: string; attachmentKind?: 'image' | 'pdf' | 'file'; embedUrl?: string }
export interface NotePage { id: string; tripId: string; title: string; blocks: NoteBlock[]; updatedAt: string }
export interface NoteAttachment {
  id: string
  tripId: string
  notePageId: string
  blockId: string
  kind: 'image' | 'pdf' | 'file'
  fileName: string
  mimeType: string
  size: number
  storedSize: number
  chunkCount: number
  width?: number
  height?: number
  status: 'uploading' | 'ready'
  createdBy: string
  createdAt: string
}
export interface ItineraryPlace {
  id: string
  tripId: string
  day: number
  name: string
  address: string
  latitude: number
  longitude: number
  startTime?: string
  endTime?: string
  notes?: string
  link?: string
  googleMapsUrl?: string
  source?: 'search' | 'google_maps' | 'manual_pin' | 'note' | 'proposal'
  providerPlaceId?: string
  sortOrder: number
  category?: string
  createdBy: string
  createdAt: string
}
export interface TransportSegment {
  id: string
  tripId: string
  day: number
  sourcePlaceId: string
  destinationPlaceId: string
  mode: TransportMode
  duration?: number
  distance?: number
  notes?: string
}
export interface PollOption { id: string; label: string; voterIds: string[] }
export interface Proposal {
  id: string
  tripId: string
  title: string
  description?: string
  status: ProposalStatus
  options: PollOption[]
  referencedNotePageId?: string
  referencedPlaceId?: string
  proposedPlace?: Partial<ItineraryPlace>
  createdBy: string
  createdAt: string
}
export interface ChatMessage {
  id: string
  tripId: string
  type: MessageType
  body?: string
  author: Profile
  createdAt: string
  referencedNotePageId?: string
  referencedPlaceId?: string
  proposalId?: string
}
export interface TLogData {
  trips: Trip[]
  notes: NotePage[]
  places: ItineraryPlace[]
  segments: TransportSegment[]
  messages: ChatMessage[]
  proposals: Proposal[]
}
