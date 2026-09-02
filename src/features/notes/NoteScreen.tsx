import { ArrowDown, ArrowUp, ChevronLeft, Copy, FileText, MapPin, MoreHorizontal, Plus, Send, Trash2, Vote } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../context/AppContext'
import { db } from '../../lib/firebase'
import { uid } from '../../lib/utils'
import { collectAttachmentIds, deleteAttachment } from '../../services/noteAttachments'
import type { NoteBlock, NotePage, Trip } from '../../types'
import { NoteEditor, type NoteActionTarget } from './NoteEditor'

const proposalOptions = () => [
  { id: uid(), label: '좋아요', voterIds: [] },
  { id: uid(), label: '건너뛰기', voterIds: [] },
  { id: uid(), label: '상관없어요', voterIds: [] }
]

export function NoteScreen() {
  const { trip } = useOutletContext<{ trip: Trip }>(); const { pageId } = useParams(); const navigate = useNavigate()
  const { data, profile, signedIn, addNotePage, ensureInitialNotePage, updateNotePage, deleteNotePage, duplicateNotePage, sendMessage, createProposal } = useApp()
  const pages = useMemo(() => data.notes.filter((page) => page.tripId === trip.id), [data.notes, trip.id])
  const activePage = pages.find((page) => page.id === pageId)
  const [menuPage, setMenuPage] = useState<NotePage | null>(null); const [actionTarget, setActionTarget] = useState<NoteActionTarget | null>(null)
  const initializingRef = useRef<string | null>(null)

  useEffect(() => {
    if (pageId || pages.length || initializingRef.current === trip.id) return
    initializingRef.current = trip.id
    void ensureInitialNotePage(trip.id).then((page) => navigate(`/trip/${trip.id}/note/${page.id}`, { replace: true })).catch(() => { initializingRef.current = null })
  }, [ensureInitialNotePage, navigate, pageId, pages.length, trip.id])
  useEffect(() => { if (pageId && !activePage && pages.length) navigate(`/trip/${trip.id}/note`, { replace: true }) }, [pageId, activePage, navigate, pages.length, trip.id])

  const createPage = async () => { try { const page = await addNotePage(trip.id); navigate(`/trip/${trip.id}/note/${page.id}`) } catch { return } }
  const deleteBlockAttachment = useCallback((block: NoteBlock) => {
    if (!db || !signedIn) return
    const database = db
    const removedBlockIds = new Set<string>(); const visit = (blocks: NoteBlock[]) => blocks.forEach((candidate) => { removedBlockIds.add(candidate.id); visit(candidate.children || []) }); visit([block])
    const collectRemaining = (blocks: NoteBlock[]): string[] => blocks.flatMap((candidate) => removedBlockIds.has(candidate.id) ? [] : [candidate.attachmentId, ...collectRemaining(candidate.children || [])]).filter((id): id is string => Boolean(id))
    const referencedElsewhere = new Set(data.notes.flatMap((page) => collectRemaining(page.blocks)))
    collectAttachmentIds([block]).filter((attachmentId) => !referencedElsewhere.has(attachmentId)).forEach((attachmentId) => { void deleteAttachment(database, trip.id, attachmentId).catch((error) => console.error('[T Log attachment delete]', error)) })
  }, [data.notes, signedIn, trip.id])

  const pageMenu = menuPage && <div className="action-list">
    <button onClick={() => { void duplicateNotePage(menuPage.id).catch(() => {}); setMenuPage(null) }}><Copy size={18} /> 복제</button>
    <button onClick={() => { void sendMessage(trip.id, menuPage.title, 'NOTE_SHARE', { referencedNotePageId: menuPage.id }).catch(() => {}); setMenuPage(null) }}><Send size={18} /> 채팅에 공유</button>
    <button onClick={() => { void createProposal({ tripId: trip.id, title: menuPage.title, description: '이 아이디어를 여행 계획에 반영할까요?', referencedNotePageId: menuPage.id, options: proposalOptions() }).catch(() => {}); setMenuPage(null) }}><Vote size={18} /> 제안하기</button>
    <button className="danger" onClick={() => { void deleteNotePage(menuPage.id).then(() => navigate(`/trip/${trip.id}/note`)).catch(() => {}); setMenuPage(null) }}><Trash2 size={18} /> 삭제</button>
  </div>

  if (!activePage && pages.length === 0) return <section className="note-home note-initializing" aria-busy="true" aria-label="노트 준비 중" />
  if (!activePage) return <section className="note-home">
    <div className="tab-heading"><span>NOTE</span><h2>여행 노트</h2><p>아이디어와 정보를 자유롭게 모아보세요.</p></div>
    <div className="page-list">{pages.map((page) => <button key={page.id} onClick={() => navigate(`/trip/${trip.id}/note/${page.id}`)} className="page-row"><FileText size={19} /><span><strong>{page.title || '제목 없음'}</strong><small>{page.blocks.filter((block) => block.content).length}개 블록</small></span><button className="icon-button" onClick={(event) => { event.stopPropagation(); setMenuPage(page) }}><MoreHorizontal size={20} /></button></button>)}</div>
    <button className="new-page-button" onClick={createPage}><Plus size={18} /> 새 페이지</button>
    <Sheet open={Boolean(menuPage)} title="페이지 옵션" onClose={() => setMenuPage(null)}>{pageMenu}</Sheet>
  </section>

  return <section className="note-editor">
    <div className="editor-topbar"><button className="icon-button" onClick={() => navigate(`/trip/${trip.id}/note`)}><ChevronLeft size={22} /></button><span>NOTE</span><button className="icon-button" onClick={() => setMenuPage(activePage)}><MoreHorizontal size={21} /></button></div>
    <input className="page-title-input" aria-label="페이지 제목" value={activePage.title} onChange={(event) => updateNotePage(activePage.id, { title: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); document.querySelector<HTMLTextAreaElement>('.editor-blocks textarea')?.focus() } }} placeholder="제목 없음" />
    <NoteEditor tripId={trip.id} pageId={activePage.id} userId={profile.id} blocks={activePage.blocks} onBlocksChange={(blocks) => updateNotePage(activePage.id, { blocks })} onAction={setActionTarget} onDeleteAttachment={deleteBlockAttachment} />
    <Sheet open={Boolean(actionTarget)} title="블록 옵션" onClose={() => setActionTarget(null)} tall>{actionTarget && <div className="action-list">
      <button disabled={!actionTarget.canMoveUp} onClick={() => { actionTarget.moveUp(); setActionTarget(null) }}><ArrowUp size={18} /> 위로 이동</button>
      <button disabled={!actionTarget.canMoveDown} onClick={() => { actionTarget.moveDown(); setActionTarget(null) }}><ArrowDown size={18} /> 아래로 이동</button>
      <button onClick={() => { void sendMessage(trip.id, actionTarget.block.content, 'NOTE_SHARE', { referencedNotePageId: activePage.id }).catch(() => {}); setActionTarget(null) }}><Send size={18} /> 채팅에 공유</button>
      <button onClick={() => { void createProposal({ tripId: trip.id, title: actionTarget.block.content || activePage.title, description: '이 아이디어를 여행 계획에 반영할까요?', referencedNotePageId: activePage.id, proposedPlace: actionTarget.block.type === 'location' ? { name: actionTarget.block.content } : undefined, options: proposalOptions() }).catch(() => {}); setActionTarget(null) }}><Vote size={18} /> 제안하기</button>
      {actionTarget.block.type === 'location' && <button onClick={() => navigate(`/trip/${trip.id}/map`, { state: { placeName: actionTarget.block.content } })}><MapPin size={18} /> 지도에 추가</button>}
      <button className="danger" onClick={() => { actionTarget.remove(); setActionTarget(null) }}><Trash2 size={18} /> 삭제</button>
    </div>}</Sheet>
    <Sheet open={Boolean(menuPage)} title="페이지 옵션" onClose={() => setMenuPage(null)}>{pageMenu}</Sheet>
  </section>
}
