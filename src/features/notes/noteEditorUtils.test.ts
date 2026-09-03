import { describe, expect, it } from 'vitest'
import type { NoteBlock } from '../../types'
import { consecutiveNumber, continuationType, markdownBlockType, moveNoteBlock, normalizeNoteBlocks, replaceNoteBlock, slashQuery } from './noteEditorUtils'

const block = (id: string, type: NoteBlock['type'], content = ''): NoteBlock => ({ id, type, content })

describe('note editor utilities', () => {
  it('recognizes supported markdown shortcuts only as complete prefixes', () => {
    expect(markdownBlockType('# ')).toBe('heading1'); expect(markdownBlockType('### ')).toBe('heading3'); expect(markdownBlockType('- ')).toBe('bullet'); expect(markdownBlockType('[ ] ')).toBe('todo'); expect(markdownBlockType('text # ')).toBeNull()
  })
  it('continues lists and exits other block types to paragraphs', () => {
    expect(continuationType(block('1', 'numbered'))).toBe('numbered'); expect(continuationType(block('2', 'heading1'))).toBe('paragraph')
  })
  it('numbers only consecutive numbered blocks', () => {
    const blocks = [block('1', 'paragraph'), block('2', 'numbered'), block('3', 'numbered'), block('4', 'paragraph'), block('5', 'numbered')]
    expect(consecutiveNumber(blocks, 2)).toBe(2); expect(consecutiveNumber(blocks, 4)).toBe(1)
  })
  it('detects slash queries only in paragraph blocks', () => {
    expect(slashQuery(block('1', 'paragraph', '/토글'))).toBe('토글'); expect(slashQuery(block('2', 'heading1', '/토글'))).toBeNull()
  })
  it('keeps one paragraph in an empty document', () => expect(normalizeNoteBlocks([], () => 'new')).toEqual([{ id: 'new', type: 'paragraph', content: '' }]))
  it('replaces a nested picker block with all selected folder files', () => {
    const original = [block('before', 'paragraph'), { ...block('toggle', 'toggle'), children: [block('picker', 'file')] }]
    const replacements = [block('file-1', 'file'), block('file-2', 'file')]
    expect(replaceNoteBlock(original, 'picker', replacements)[1].children).toEqual(replacements)
  })
  it('moves blocks between different toggles without losing their content', () => {
    const original: NoteBlock[] = [
      { ...block('toggle-a', 'toggle'), children: [block('move-me', 'paragraph', '옮길 내용')] },
      { ...block('toggle-b', 'toggle'), children: [block('stay', 'paragraph', '기존 내용')] },
    ]
    const moved = moveNoteBlock(original, 'move-me', 'toggle-b', 1)
    expect(moved[0].children).toEqual([])
    expect(moved[1].children?.map((item) => item.id)).toEqual(['stay', 'move-me'])
    expect(moved[1].children?.[1].content).toBe('옮길 내용')
  })
  it('does not allow a toggle to be moved inside itself', () => {
    const original: NoteBlock[] = [{ ...block('toggle', 'toggle'), children: [block('child', 'paragraph')] }]
    expect(moveNoteBlock(original, 'toggle', 'toggle', 0)).toBe(original)
  })
})
