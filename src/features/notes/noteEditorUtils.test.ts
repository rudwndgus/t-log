import { describe, expect, it } from 'vitest'
import type { NoteBlock } from '../../types'
import { consecutiveNumber, continuationType, markdownBlockType, normalizeNoteBlocks, slashQuery } from './noteEditorUtils'

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
})
