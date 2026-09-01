import type { BlockType } from '../../types'

export interface NoteCommand { type: BlockType; label: string; hint: string; aliases: string[] }

export const noteCommands: NoteCommand[] = [
  { type: 'paragraph', label: '텍스트', hint: '기본 텍스트 블록', aliases: ['text', 'paragraph', '본문'] },
  { type: 'heading1', label: '제목 1', hint: '큰 섹션 제목', aliases: ['h1', 'heading1', '제목'] },
  { type: 'heading2', label: '제목 2', hint: '중간 섹션 제목', aliases: ['h2', 'heading2', '제목'] },
  { type: 'heading3', label: '제목 3', hint: '작은 섹션 제목', aliases: ['h3', 'heading3', '제목'] },
  { type: 'bullet', label: '글머리 목록', hint: '순서 없는 목록', aliases: ['bullet', 'bulleted', '목록'] },
  { type: 'numbered', label: '번호 목록', hint: '순서가 있는 목록', aliases: ['number', 'numbered', '목록'] },
  { type: 'todo', label: '할 일', hint: '체크 가능한 항목', aliases: ['todo', 'task', '체크'] },
  { type: 'toggle', label: '토글', hint: '접을 수 있는 내용', aliases: ['toggle', '접기'] },
  { type: 'quote', label: '인용', hint: '강조할 메모', aliases: ['quote', 'callout', '콜아웃'] },
  { type: 'divider', label: '구분선', hint: '내용 나누기', aliases: ['divider', 'line', '선'] },
  { type: 'link', label: '링크', hint: '클릭할 수 있는 주소', aliases: ['link', 'url'] },
  { type: 'location', label: '장소', hint: '지도에 추가할 후보', aliases: ['place', 'location', '지도'] }
]

export const filterNoteCommands = (query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return noteCommands
  return noteCommands.filter((command) => [command.label, command.hint, ...command.aliases].some((value) => value.toLowerCase().includes(normalized)))
}
