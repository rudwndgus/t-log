import type { BlockType, NoteBlock } from '../../types'

export const createNoteBlock = (id: string, type: BlockType = 'paragraph', content = ''): NoteBlock => ({ id, type, content, ...(type === 'toggle' ? { children: [], collapsed: true } : {}) })

export const markdownBlockType = (value: string): BlockType | null => {
  const shortcuts: Record<string, BlockType> = { '# ': 'heading1', '## ': 'heading2', '### ': 'heading3', '- ': 'bullet', '* ': 'bullet', '1. ': 'numbered', '[] ': 'todo', '[ ] ': 'todo', '> ': 'quote', '--- ': 'divider' }
  return shortcuts[value] || null
}

export const continuationType = (block: NoteBlock): BlockType => ['bullet', 'numbered', 'todo'].includes(block.type) ? block.type : 'paragraph'

export const consecutiveNumber = (blocks: NoteBlock[], index: number) => {
  let number = 1
  for (let cursor = index - 1; cursor >= 0 && blocks[cursor]?.type === 'numbered'; cursor -= 1) number += 1
  return number
}

export const slashQuery = (block: NoteBlock) => block.type === 'paragraph' && block.content.startsWith('/') && !block.content.includes('\n') ? block.content.slice(1) : null

export const normalizeNoteBlocks = (blocks: NoteBlock[], makeId: () => string) => blocks.length ? blocks : [createNoteBlock(makeId())]

export const replaceNoteBlock = (blocks: NoteBlock[], blockId: string, replacements: NoteBlock[]): NoteBlock[] => {
  let changed = false
  const next = blocks.flatMap((block) => {
    if (block.id === blockId) { changed = true; return replacements }
    if (!block.children?.length) return [block]
    const children = replaceNoteBlock(block.children, blockId, replacements)
    if (children !== block.children) { changed = true; return [{ ...block, children }] }
    return [block]
  })
  return changed ? next : blocks
}

export const isTextBlock = (block: NoteBlock) => block.type !== 'divider'
