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

export interface NoteBlockLocation { block: NoteBlock; parentId: string | null; index: number }

export const findNoteBlockLocation = (blocks: NoteBlock[], blockId: string, parentId: string | null = null): NoteBlockLocation | null => {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (block.id === blockId) return { block, parentId, index }
    const nested = block.children?.length ? findNoteBlockLocation(block.children, blockId, block.id) : null
    if (nested) return nested
  }
  return null
}

const removeNoteBlock = (blocks: NoteBlock[], blockId: string): { blocks: NoteBlock[]; removed?: NoteBlock } => {
  const directIndex = blocks.findIndex((block) => block.id === blockId)
  if (directIndex >= 0) return { blocks: blocks.filter((_, index) => index !== directIndex), removed: blocks[directIndex] }
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (!block.children?.length) continue
    const result = removeNoteBlock(block.children, blockId)
    if (result.removed) return { blocks: blocks.map((item, itemIndex) => itemIndex === index ? { ...item, children: result.blocks } : item), removed: result.removed }
  }
  return { blocks }
}

const insertNoteBlock = (blocks: NoteBlock[], block: NoteBlock, parentId: string | null, index: number): NoteBlock[] | null => {
  if (parentId === null) { const next = [...blocks]; next.splice(Math.max(0, Math.min(index, next.length)), 0, block); return next }
  for (let cursor = 0; cursor < blocks.length; cursor += 1) {
    const item = blocks[cursor]
    if (item.id === parentId && item.type === 'toggle') {
      const children = [...(item.children || [])]; children.splice(Math.max(0, Math.min(index, children.length)), 0, block)
      return blocks.map((candidate, candidateIndex) => candidateIndex === cursor ? { ...candidate, children } : candidate)
    }
    if (item.children?.length) {
      const children = insertNoteBlock(item.children, block, parentId, index)
      if (children) return blocks.map((candidate, candidateIndex) => candidateIndex === cursor ? { ...candidate, children } : candidate)
    }
  }
  return null
}

export const moveNoteBlock = (blocks: NoteBlock[], blockId: string, targetParentId: string | null, targetIndex: number): NoteBlock[] => {
  const source = findNoteBlockLocation(blocks, blockId)
  if (!source || targetParentId === blockId) return blocks
  if (targetParentId && findNoteBlockLocation(source.block.children || [], targetParentId)) return blocks
  const removed = removeNoteBlock(blocks, blockId)
  if (!removed.removed) return blocks
  const adjustedIndex = source.parentId === targetParentId && source.index < targetIndex ? targetIndex - 1 : targetIndex
  return insertNoteBlock(removed.blocks, removed.removed, targetParentId, adjustedIndex) || blocks
}

export const isTextBlock = (block: NoteBlock) => block.type !== 'divider'
