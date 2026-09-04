// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteEditor } from './NoteEditor'

describe('NoteEditor toggle', () => {
  it('expands and collapses locally without saving or remounting the note', () => {
    const onBlocksChange = vi.fn()
    render(<NoteEditor
      tripId="trip"
      pageId="page"
      userId="user"
      blocks={[{ id: 'toggle', type: 'toggle', content: '준비물', collapsed: true, children: [{ id: 'child', type: 'paragraph', content: '여권' }] }]}
      onBlocksChange={onBlocksChange}
      onAction={() => undefined}
      onDeleteAttachment={() => undefined}
    />)

    fireEvent.click(screen.getByRole('button', { name: '토글 펼치기' }))
    expect(screen.getByRole('button', { name: '토글 접기' })).toBeTruthy()
    expect(screen.getByDisplayValue('여권')).toBeTruthy()
    expect(onBlocksChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '토글 접기' }))
    expect(screen.getByRole('button', { name: '토글 펼치기' })).toBeTruthy()
    expect(screen.queryByDisplayValue('여권')).toBeNull()
    expect(onBlocksChange).not.toHaveBeenCalled()
  })
})
