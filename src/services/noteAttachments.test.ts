import { describe, expect, it } from 'vitest'
import { ATTACHMENT_CHUNK_SIZE, chunkAttachmentBytes, reassembleAttachmentChunks } from './noteAttachments'

describe('Firestore attachment chunks', () => {
  it('keeps chunks safely below the Firestore document limit', () => expect(ATTACHMENT_CHUNK_SIZE).toBeLessThan(700 * 1024))
  it('round-trips binary data across multiple chunks', () => {
    const original = Uint8Array.from({ length: ATTACHMENT_CHUNK_SIZE * 2 + 17 }, (_, index) => index % 251); const chunks = chunkAttachmentBytes(original)
    expect(chunks).toHaveLength(3); expect(reassembleAttachmentChunks(chunks)).toEqual(original)
  })
})
