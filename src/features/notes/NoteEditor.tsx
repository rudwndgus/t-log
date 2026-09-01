import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react'
import type { BlockType, NoteBlock } from '../../types'
import { uid } from '../../lib/utils'
import { db } from '../../lib/firebase'
import { uploadAttachment } from '../../services/noteAttachments'
import { AttachmentBlock, type AttachmentUploadState } from './AttachmentBlock'
import { BlockEditor } from './BlockEditor'
import { filterNoteCommands, type NoteCommand } from './noteCommands'
import { SlashCommandMenu } from './SlashCommandMenu'
import { consecutiveNumber, continuationType, createNoteBlock, isTextBlock, markdownBlockType, normalizeNoteBlocks, slashQuery } from './noteEditorUtils'

interface ActionTarget { block: NoteBlock; remove: () => void }
interface SlashState { blockId: string; query: string; selected: number }
interface PendingPick { blockId: string; attachmentId: string; kind: 'image' | 'pdf' | 'file' }

export function NoteEditor({ tripId, pageId, userId, blocks, onBlocksChange, onAction, onDeleteAttachment }: { tripId: string; pageId: string; userId: string; blocks: NoteBlock[]; onBlocksChange: (blocks: NoteBlock[]) => void; onAction: (target: ActionTarget) => void; onDeleteAttachment: (block: NoteBlock) => void }) {
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>()); const pageRef = useRef(''); const [activeId, setActiveId] = useState<string | null>(null); const [slash, setSlash] = useState<SlashState | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null); const fileInputRef = useRef<HTMLInputElement>(null); const pdfInputRef = useRef<HTMLInputElement>(null); const pendingPickRef = useRef<PendingPick | null>(null); const uploadControllersRef = useRef(new Map<string, AbortController>()); const [uploads, setUploads] = useState<Record<string, AttachmentUploadState>>({})
  const uploadsRef = useRef(uploads); uploadsRef.current = uploads
  const focusBlock = useCallback((id: string, caret?: number) => { requestAnimationFrame(() => { const input = inputRefs.current.get(id); if (!input) return; input.focus(); const position = caret ?? input.value.length; input.setSelectionRange(position, position) }) }, [])
  useEffect(() => {
    if (pageRef.current === pageId) return
    pageRef.current = pageId
    const normalized = normalizeNoteBlocks(blocks, uid); if (normalized !== blocks) onBlocksChange(normalized)
    focusBlock(normalized[0].id)
  }, [blocks, focusBlock, onBlocksChange, pageId])
  useEffect(() => () => { uploadControllersRef.current.forEach((controller) => controller.abort()); Object.values(uploadsRef.current).forEach((upload) => { if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl) }) }, [])
  const registerInput = useCallback((id: string, node: HTMLTextAreaElement | null) => { if (node) inputRefs.current.set(id, node); else inputRefs.current.delete(id) }, [])
  const requestPick = useCallback((pending: PendingPick) => { pendingPickRef.current = pending; requestAnimationFrame(() => (pending.kind === 'image' ? imageInputRef : pending.kind === 'pdf' ? pdfInputRef : fileInputRef).current?.click()) }, [])
  const chooseCommand = useCallback((command: NoteCommand, currentBlocks: NoteBlock[], index: number, commit: (next: NoteBlock[]) => void) => {
    const current = currentBlocks[index]; if (!current) return
    const attachmentId = command.picker ? uid() : undefined
    const converted: NoteBlock = { ...current, type: command.type, content: '', checked: command.type === 'todo' ? false : undefined, children: command.type === 'toggle' ? [createNoteBlock(uid())] : undefined, collapsed: command.type === 'toggle' ? true : undefined, attachmentId, attachmentKind: command.picker, embedUrl: command.type === 'embed' ? '' : undefined }
    if (command.type === 'divider') { const paragraph = createNoteBlock(uid()); commit([...currentBlocks.slice(0, index), converted, paragraph, ...currentBlocks.slice(index + 1)]); setSlash(null); focusBlock(paragraph.id); return }
    commit(currentBlocks.map((block, blockIndex) => blockIndex === index ? converted : block)); setSlash(null)
    if (command.picker && attachmentId) { setUploads((current) => ({ ...current, [converted.id]: { state: 'selecting', progress: 0 } })); requestPick({ blockId: converted.id, attachmentId, kind: command.picker }) } else focusBlock(converted.id)
  }, [focusBlock, requestPick])
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; const pending = pendingPickRef.current; pendingPickRef.current = null; if (!file || !pending) return
    const previewUrl = pending.kind === 'image' ? URL.createObjectURL(file) : undefined; setUploads((current) => ({ ...current, [pending.blockId]: { state: 'uploading', progress: 0, previewUrl } }))
    if (!db) { setUploads((current) => ({ ...current, [pending.blockId]: { state: 'error', progress: 0, previewUrl, error: 'Firebase 로그인이 필요해요.' } })); return }
    const controller = new AbortController(); uploadControllersRef.current.set(pending.attachmentId, controller)
    try { await uploadAttachment(db, { tripId, notePageId: pageId, blockId: pending.blockId, attachmentId: pending.attachmentId, kind: pending.kind, file, createdBy: userId, signal: controller.signal, onProgress: (progress) => setUploads((current) => ({ ...current, [pending.blockId]: { ...current[pending.blockId], state: 'uploading', progress } })) }); setUploads((current) => ({ ...current, [pending.blockId]: { ...current[pending.blockId], state: 'ready', progress: 1 } })) }
    catch (error) { const code = error instanceof Error ? error.message : ''; const message = code === 'FILE_TOO_LARGE' ? '파일이 너무 커요. 15MB 이하의 파일을 사용해 주세요.' : code === 'VIDEO_NOT_SUPPORTED' ? '동영상은 아직 첨부할 수 없어요.' : code === 'UNSUPPORTED_IMAGE' ? '이 이미지 형식은 브라우저에서 변환할 수 없어요.' : '업로드하지 못했어요. 다시 시도해 주세요.'; setUploads((current) => ({ ...current, [pending.blockId]: { ...current[pending.blockId], state: 'error', progress: 0, error: message } })) }
    finally { uploadControllersRef.current.delete(pending.attachmentId) }
  }
  const removeBlock = useCallback((block: NoteBlock) => { if (block.attachmentId) { uploadControllersRef.current.get(block.attachmentId)?.abort(); const previewUrl = uploads[block.id]?.previewUrl; if (previewUrl) URL.revokeObjectURL(previewUrl); setUploads((current) => { const next = { ...current }; delete next[block.id]; return next }); onDeleteAttachment(block) } }, [onDeleteAttachment, uploads])
  const media = useCallback((block: NoteBlock): ReactNode => ['image', 'file'].includes(block.type) ? <AttachmentBlock tripId={tripId} block={block} upload={uploads[block.id]} onPick={() => { const attachmentId = block.attachmentId || uid(); requestPick({ blockId: block.id, attachmentId, kind: block.attachmentKind || (block.type === 'image' ? 'image' : 'file') }) }} /> : undefined, [requestPick, tripId, uploads])
  return <div className="notion-editor"><EditorList blocks={blocks} level={0} onBlocksChange={onBlocksChange} onAction={onAction} onRemoveBlock={removeBlock} renderMedia={media} activeId={activeId} setActiveId={setActiveId} slash={slash} setSlash={setSlash} registerInput={registerInput} focusBlock={focusBlock} chooseCommand={chooseCommand} /><button type="button" className="note-inline-add" onClick={() => { const block = createNoteBlock(uid(), 'paragraph', '/'); onBlocksChange([...blocks, block]); setSlash({ blockId: block.id, query: '', selected: 0 }); focusBlock(block.id) }}><Plus size={16} /> 블록 추가</button><input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*,.heic,.heif" onChange={(event) => void chooseFile(event)} /><input ref={pdfInputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event)} /><input ref={fileInputRef} className="visually-hidden" type="file" onChange={(event) => void chooseFile(event)} /></div>
}

function EditorList({ blocks, level, onBlocksChange, onAction, onRemoveBlock, renderMedia, activeId, setActiveId, slash, setSlash, registerInput, focusBlock, chooseCommand }: { blocks: NoteBlock[]; level: number; onBlocksChange: (blocks: NoteBlock[]) => void; onAction: (target: ActionTarget) => void; onRemoveBlock: (block: NoteBlock) => void; renderMedia: (block: NoteBlock) => ReactNode; activeId: string | null; setActiveId: Dispatch<SetStateAction<string | null>>; slash: SlashState | null; setSlash: (state: SlashState | null) => void; registerInput: (id: string, node: HTMLTextAreaElement | null) => void; focusBlock: (id: string, caret?: number) => void; chooseCommand: (command: NoteCommand, blocks: NoteBlock[], index: number, commit: (next: NoteBlock[]) => void) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 7 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const commit = (next: NoteBlock[]) => onBlocksChange(normalizeNoteBlocks(next, uid))
  const removeAt = (index: number) => {
    const removed = blocks[index]; if (removed) onRemoveBlock(removed)
    if (blocks.length === 1) { const replacement = createNoteBlock(uid()); commit([replacement]); focusBlock(replacement.id); return }
    const next = blocks.filter((_, blockIndex) => blockIndex !== index); const focus = index > 0 ? blocks[index - 1]?.id : next[0]?.id
    commit(next); if (focus) focusBlock(focus)
  }
  const updateAt = (index: number, changes: Partial<NoteBlock>) => commit(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...changes } : block))
  const handleDragEnd = ({ active, over }: DragEndEvent) => { if (!over || active.id === over.id) return; const oldIndex = blocks.findIndex((block) => block.id === active.id); const newIndex = blocks.findIndex((block) => block.id === over.id); if (oldIndex >= 0 && newIndex >= 0) commit(arrayMove(blocks, oldIndex, newIndex)) }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}><div className={`editor-blocks ${level ? 'editor-blocks--nested' : ''}`}>{blocks.map((block, index) => <SortableBlock key={block.id} block={block} index={index} number={block.type === 'numbered' ? consecutiveNumber(blocks, index) : undefined} level={level} blocks={blocks} commit={commit} updateAt={updateAt} removeAt={removeAt} onAction={onAction} onRemoveBlock={onRemoveBlock} renderMedia={renderMedia} activeId={activeId} setActiveId={setActiveId} slash={slash} setSlash={setSlash} registerInput={registerInput} focusBlock={focusBlock} chooseCommand={chooseCommand} />)}</div></SortableContext></DndContext>
}

function SortableBlock({ block, index, number, level, blocks, commit, updateAt, removeAt, onAction, onRemoveBlock, renderMedia, activeId, setActiveId, slash, setSlash, registerInput, focusBlock, chooseCommand }: { block: NoteBlock; index: number; number?: number; level: number; blocks: NoteBlock[]; commit: (blocks: NoteBlock[]) => void; updateAt: (index: number, changes: Partial<NoteBlock>) => void; removeAt: (index: number) => void; onAction: (target: ActionTarget) => void; onRemoveBlock: (block: NoteBlock) => void; renderMedia: (block: NoteBlock) => ReactNode; activeId: string | null; setActiveId: Dispatch<SetStateAction<string | null>>; slash: SlashState | null; setSlash: (state: SlashState | null) => void; registerInput: (id: string, node: HTMLTextAreaElement | null) => void; focusBlock: (id: string, caret?: number) => void; chooseCommand: (command: NoteCommand, blocks: NoteBlock[], index: number, commit: (next: NoteBlock[]) => void) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition }; const dragHandleProps = { ...attributes, ...listeners } as ButtonHTMLAttributes<HTMLButtonElement>
  const applyDivider = () => { const paragraph = createNoteBlock(uid()); commit([...blocks.slice(0, index), { ...block, type: 'divider' as BlockType, content: '' }, paragraph, ...blocks.slice(index + 1)]); setSlash(null); focusBlock(paragraph.id) }
  const handleChange = (value: string, textarea: HTMLTextAreaElement) => {
    const shortcut = block.type === 'paragraph' ? markdownBlockType(value) : null
    if (shortcut === 'divider') { applyDivider(); return }
    if (shortcut) { updateAt(index, { type: shortcut, content: '', checked: shortcut === 'todo' ? false : undefined }); setSlash(null); focusBlock(block.id); return }
    updateAt(index, { content: value, embedUrl: block.type === 'embed' ? value : block.embedUrl }); const query = slashQuery({ ...block, content: value }); setSlash(query === null ? slash?.blockId === block.id ? null : slash : { blockId: block.id, query, selected: 0 })
    textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slash?.blockId === block.id) {
      const commands = filterNoteCommands(slash.query)
      if (event.key === 'ArrowDown') { event.preventDefault(); setSlash({ ...slash, selected: commands.length ? (slash.selected + 1) % commands.length : 0 }); return }
      if (event.key === 'ArrowUp') { event.preventDefault(); setSlash({ ...slash, selected: commands.length ? (slash.selected - 1 + commands.length) % commands.length : 0 }); return }
      if (event.key === 'Escape') { event.preventDefault(); setSlash(null); return }
      if (event.key === 'Enter' && !event.shiftKey && commands.length) { event.preventDefault(); chooseCommand(commands[Math.min(slash.selected, commands.length - 1)], blocks, index, commit); return }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); if (block.content === '---' && block.type === 'paragraph') { applyDivider(); return }
      if (['bullet', 'numbered', 'todo'].includes(block.type) && !block.content) { updateAt(index, { type: 'paragraph', checked: undefined }); focusBlock(block.id); return }
      const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd; const next = createNoteBlock(uid(), continuationType(block), block.content.slice(end))
      commit([...blocks.slice(0, index), { ...block, content: block.content.slice(0, start) }, next, ...blocks.slice(index + 1)]); focusBlock(next.id); return
    }
    if (event.key === 'Backspace' && !event.shiftKey) {
      const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd
      if (!block.content) { event.preventDefault(); removeAt(index); return }
      const previous = blocks[index - 1]
      if (start === 0 && end === 0 && previous && isTextBlock(previous)) { event.preventDefault(); const caret = previous.content.length; commit([...blocks.slice(0, index - 1), { ...previous, content: previous.content + block.content }, ...blocks.slice(index + 1)]); focusBlock(previous.id, caret) }
    }
  }
  const toggle = () => {
    const opening = Boolean(block.collapsed); const children = block.children?.length ? block.children : [createNoteBlock(uid())]
    updateAt(index, { collapsed: !block.collapsed, children }); if (opening) focusBlock(children[0].id)
  }
  return <div ref={setNodeRef} className={`sortable-note-block ${isDragging ? 'is-dragging' : ''}`} style={style}><BlockEditor block={block} number={number} active={activeId === block.id} inputRef={(node) => registerInput(block.id, node)} handleRef={setActivatorNodeRef} dragHandleProps={dragHandleProps} customContent={renderMedia(block)} onFocus={() => setActiveId(block.id)} onBlur={() => setTimeout(() => setActiveId((current) => current === block.id ? null : current), 0)} onChange={handleChange} onKeyDown={handleKeyDown} onCheckedChange={(checked) => updateAt(index, { checked })} onToggle={toggle} onAction={() => onAction({ block, remove: () => removeAt(index) })} />
    {slash?.blockId === block.id && <SlashCommandMenu query={slash.query} selected={slash.selected} onChoose={(command) => chooseCommand(command, blocks, index, commit)} onClose={() => setSlash(null)} />}
    {block.type === 'toggle' && !block.collapsed && <EditorList blocks={block.children?.length ? block.children : [createNoteBlock(uid())]} level={level + 1} onBlocksChange={(children) => updateAt(index, { children })} onAction={onAction} onRemoveBlock={onRemoveBlock} renderMedia={renderMedia} activeId={activeId} setActiveId={setActiveId} slash={slash} setSlash={setSlash} registerInput={registerInput} focusBlock={focusBlock} chooseCommand={chooseCommand} />}
  </div>
}
