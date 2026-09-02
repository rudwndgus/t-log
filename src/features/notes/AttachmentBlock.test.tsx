// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AttachmentBlock } from './AttachmentBlock'

const attachmentMocks = vi.hoisted(() => ({
  createUrl: vi.fn(() => 'blob:tlog-preview'),
  getManifest: vi.fn(),
  load: vi.fn(),
  revokeUrl: vi.fn(),
}))

vi.mock('../../lib/firebase', () => ({ db: {} }))
vi.mock('../../services/noteAttachments', () => ({
  createAttachmentBlobUrl: attachmentMocks.createUrl,
  getAttachmentManifest: attachmentMocks.getManifest,
  loadAttachment: attachmentMocks.load,
  revokeAttachmentBlobUrl: attachmentMocks.revokeUrl,
}))

const manifest = {
  id: 'attachment-1', tripId: 'trip-1', notePageId: 'page-1', blockId: 'block-1', kind: 'file' as const,
  fileName: 'mobile-note.txt', mimeType: 'text/plain', size: 10, storedSize: 10, chunkCount: 1,
  status: 'ready' as const, createdBy: 'user-1', createdAt: '',
}

describe('AttachmentBlock file preview', () => {
  afterEach(() => vi.clearAllMocks())

  it('opens a downloaded text file inside the app without a popup', async () => {
    attachmentMocks.getManifest.mockResolvedValue(manifest)
    attachmentMocks.load.mockResolvedValue({ manifest, blob: { size: 10, text: vi.fn().mockResolvedValue('preview me') } })
    const popup = vi.spyOn(window, 'open')

    const view = render(<AttachmentBlock tripId="trip-1" block={{ id: 'block-1', type: 'file', content: '', attachmentId: 'attachment-1', attachmentKind: 'file' }} onPick={() => {}} />)
    await screen.findByText('mobile-note.txt')
    fireEvent.click(screen.getByRole('button', { name: '미리보기' }))

    const dialog = await screen.findByRole('dialog', { name: 'mobile-note.txt 미리보기' })
    expect(dialog.textContent).toContain('preview me')
    expect(popup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog', { name: 'mobile-note.txt 미리보기' })).toBeNull()

    view.unmount()
    await waitFor(() => expect(attachmentMocks.revokeUrl.mock.calls[0]?.[0]).toBe('blob:tlog-preview'))
    popup.mockRestore()
  })
})
