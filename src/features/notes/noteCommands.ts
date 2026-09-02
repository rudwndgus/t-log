import type { BlockType } from '../../types'

export interface NoteCommand { id: string; type: BlockType; label: string; hint: string; aliases: string[]; group: '기본' | '미디어' | 'T Log'; picker?: 'image' | 'file' | 'pdf' | 'folder' }

export const noteCommands: NoteCommand[] = [
  { id: 'paragraph', type: 'paragraph', label: '텍스트', hint: '기본 텍스트 블록', aliases: ['text', 'paragraph', '본문'], group: '기본' },
  { id: 'heading1', type: 'heading1', label: '제목 1', hint: '큰 섹션 제목', aliases: ['h1', 'heading1', '제목'], group: '기본' },
  { id: 'heading2', type: 'heading2', label: '제목 2', hint: '중간 섹션 제목', aliases: ['h2', 'heading2', '제목'], group: '기본' },
  { id: 'heading3', type: 'heading3', label: '제목 3', hint: '작은 섹션 제목', aliases: ['h3', 'heading3', '제목'], group: '기본' },
  { id: 'bullet', type: 'bullet', label: '글머리 목록', hint: '순서 없는 목록', aliases: ['bullet', 'bulleted', '목록'], group: '기본' },
  { id: 'numbered', type: 'numbered', label: '번호 목록', hint: '순서가 있는 목록', aliases: ['number', 'numbered', '목록'], group: '기본' },
  { id: 'todo', type: 'todo', label: '할 일', hint: '체크 가능한 항목', aliases: ['todo', 'task', '체크'], group: '기본' },
  { id: 'toggle', type: 'toggle', label: '토글', hint: '접을 수 있는 내용', aliases: ['toggle', '접기'], group: '기본' },
  { id: 'quote', type: 'quote', label: '인용', hint: '강조할 메모', aliases: ['quote', 'callout', '콜아웃'], group: '기본' },
  { id: 'divider', type: 'divider', label: '구분선', hint: '내용 나누기', aliases: ['divider', 'line', '선'], group: '기본' },
  { id: 'image', type: 'image', label: '사진', hint: '사진 또는 스크린샷', aliases: ['image', 'photo', '이미지'], group: '미디어', picker: 'image' },
  { id: 'file', type: 'file', label: '파일', hint: '여행 문서 첨부', aliases: ['file', 'document', '문서'], group: '미디어', picker: 'file' },
  { id: 'folder', type: 'file', label: '폴더', hint: '폴더 안의 파일을 한꺼번에 첨부', aliases: ['folder', 'directory', '폴더'], group: '미디어', picker: 'folder' },
  { id: 'pdf', type: 'file', label: 'PDF', hint: 'PDF 여행 문서', aliases: ['pdf'], group: '미디어', picker: 'pdf' },
  { id: 'embed', type: 'embed', label: '임베드', hint: '외부 콘텐츠 URL', aliases: ['embed', 'iframe', 'url'], group: '미디어' },
  { id: 'link', type: 'link', label: '링크', hint: '클릭할 수 있는 주소', aliases: ['link', 'url'], group: '미디어' },
  { id: 'location', type: 'location', label: '장소', hint: '지도에 추가할 후보', aliases: ['place', 'location', '지도'], group: 'T Log' }
]

export const filterNoteCommands = (query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return noteCommands
  return noteCommands.filter((command) => [command.label, command.hint, ...command.aliases].some((value) => value.toLowerCase().includes(normalized)))
}
