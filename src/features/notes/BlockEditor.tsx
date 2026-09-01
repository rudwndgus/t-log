import { ChevronDown, ChevronRight, GripVertical, MapPin } from 'lucide-react'
import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type RefCallback } from 'react'
import type { NoteBlock } from '../../types'

export function BlockEditor({ block, number, active, inputRef, handleRef, dragHandleProps, onFocus, onBlur, onChange, onKeyDown, onCheckedChange, onToggle, onAction }: { block: NoteBlock; number?: number; active: boolean; inputRef: RefCallback<HTMLTextAreaElement>; handleRef: RefCallback<HTMLButtonElement>; dragHandleProps: ButtonHTMLAttributes<HTMLButtonElement>; onFocus: () => void; onBlur: () => void; onChange: (value: string, textarea: HTMLTextAreaElement) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void; onCheckedChange: (checked: boolean) => void; onToggle: () => void; onAction: () => void }) {
  const ownInputRef = useRef<HTMLTextAreaElement | null>(null)
  const setInputRef: RefCallback<HTMLTextAreaElement> = (node) => { ownInputRef.current = node; inputRef(node) }
  useLayoutEffect(() => { const textarea = ownInputRef.current; if (!textarea) return; textarea.style.height = 'auto'; textarea.style.height = `${Math.max(textarea.scrollHeight, 28)}px` }, [block.content])
  if (block.type === 'divider') return <div className="editable-block divider-block"><button ref={handleRef} className="block-grip" onClick={onAction} aria-label="블록 옵션" {...dragHandleProps}><GripVertical size={16} /></button><hr /></div>
  const prefix = block.type === 'bullet' ? '•' : block.type === 'numbered' ? `${number || 1}.` : null
  const isLink = block.type === 'link' && /^https?:\/\/\S+$/i.test(block.content.trim())
  return <div className={`editable-block block--${block.type} ${active ? 'is-active' : ''} ${block.checked ? 'is-checked' : ''}`}>
    <button ref={handleRef} className="block-grip" onClick={onAction} aria-label="블록 옵션" {...dragHandleProps}><GripVertical size={16} /></button>
    {block.type === 'toggle' && <button type="button" className="toggle-arrow" onClick={onToggle} aria-label={block.collapsed ? '토글 펼치기' : '토글 접기'}>{block.collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}</button>}
    {block.type === 'todo' && <input className="todo-checkbox" type="checkbox" checked={Boolean(block.checked)} onChange={(event) => onCheckedChange(event.target.checked)} />}
    {prefix && <span className="block-prefix">{prefix}</span>}
    <div className="block-input-wrap"><textarea ref={setInputRef} rows={1} value={block.content} placeholder={block.type === 'location' ? '장소 이름 입력' : block.type === 'toggle' ? '토글 제목' : '내용 입력'} onFocus={onFocus} onBlur={onBlur} onChange={(event) => onChange(event.target.value, event.target)} onKeyDown={onKeyDown} />{isLink && !active && <a href={block.content.trim()} target="_blank" rel="noreferrer">링크 열기</a>}</div>
    {block.type === 'location' && <MapPin className="location-mark" size={17} />}
  </div>
}
