import { MapPin } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { filterNoteCommands, type NoteCommand } from './noteCommands'

export function SlashCommandMenu({ query, selected, onChoose, onClose }: { query: string; selected: number; onChoose: (command: NoteCommand) => void; onClose: () => void }) {
  const commands = filterNoteCommands(query); const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => { menuRef.current?.querySelector(`[data-command-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' }) }, [selected])
  if (!commands.length) return <div className="slash-menu slash-menu--empty">일치하는 블록이 없어요</div>
  return <div ref={menuRef} className="slash-menu" role="listbox" aria-label="블록 명령"><small>기본 블록</small>{commands.map((command, index) => <button type="button" role="option" aria-selected={index === selected} data-command-index={index} className={index === selected ? 'is-selected' : ''} key={command.type} onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(command)}><span>{command.type === 'location' ? <MapPin size={16} /> : command.label.slice(0, 1)}</span><div><strong>{command.label}</strong><em>{command.hint}</em></div></button>)}<button className="slash-menu__close" type="button" onClick={onClose}>닫기</button></div>
}
