import { ArrowRight, Cloud, Copy, ExternalLink, LogOut, MapPin, Plus, Settings2, Share2, Trash2, UserPlus } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { OfflineBanner } from '../components/OfflineBanner'
import { Sheet } from '../components/Sheet'
import { useApp } from '../context/AppContext'
import { formatTripDates } from '../lib/utils'
import type { Trip } from '../types'

export function HomePage() {
  const { data, profile, setProfileName, cloudMode, signedIn, signOut, deleteTrip, shareTrip } = useApp()
  const [settings, setSettings] = useState(false); const [name, setName] = useState(profile.name)
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null); const [shareTarget, setShareTarget] = useState<Trip | null>(null)
  const [shareUrl, setShareUrl] = useState(''); const [working, setWorking] = useState(false); const [copied, setCopied] = useState(false); const [actionError, setActionError] = useState('')
  const saveName = () => { setProfileName(name); setSettings(false) }
  const logout = async () => { setWorking(true); try { await signOut(); setSettings(false) } finally { setWorking(false) } }
  const openShare = async (trip: Trip) => { setShareTarget(trip); setShareUrl(''); setActionError(''); setWorking(true); try { setShareUrl(await shareTrip(trip.id)) } catch { setActionError('공개 일정 링크를 만들지 못했어요. Firebase 규칙과 연결을 확인해 주세요.') } finally { setWorking(false) } }
  const copyShare = async () => { if (!shareUrl) return; await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const systemShare = async () => { if (!shareUrl) return; if (navigator.share) await navigator.share({ title: `${shareTarget?.name || '여행'} · T Log`, text: 'T Log 여행 일정을 구경해 보세요.', url: shareUrl }); else await copyShare() }
  const confirmDelete = async () => { if (!deleteTarget) return; setWorking(true); setActionError(''); try { await deleteTrip(deleteTarget.id); setDeleteTarget(null) } catch { setActionError('여행을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.') } finally { setWorking(false) } }
  return <div className="app-shell home-shell"><OfflineBanner /><header className="home-header"><div><span className="eyebrow">WRITE · DISCUSS · DECIDE · TRAVEL</span><h1>T Log</h1></div><button className="avatar avatar--button" onClick={() => { setName(profile.name); setSettings(true) }} aria-label="프로필">{profile.name.slice(0, 1)}</button></header>
    <main className="home-content"><div className="section-title"><div><h2>나의 여행</h2><p>{data.trips.length ? `${data.trips.length}개의 여행` : '함께 떠날 여행을 시작해보세요'}</p></div><Link className="circle-action" to="/create" aria-label="새 여행"><Plus size={22} /></Link></div>
      {data.trips.length === 0 ? <EmptyState icon={MapPin} title="아직 여행이 없어요" description="첫 여행을 만들고, 친구와 함께 계획해보세요." action={<Link className="button button--primary" to="/create"><Plus size={17} /> 새 여행</Link>} /> : <div className="trip-list">{data.trips.map((trip) => <TripSwipeCard key={trip.id} trip={trip} canManage={trip.createdBy === profile.id} onShare={() => void openShare(trip)} onDelete={() => { setDeleteTarget(trip); setActionError('') }} />)}</div>}
      <Link className="join-link" to="/join"><UserPlus size={18} /><span><strong>초대 코드가 있나요?</strong><small>친구의 여행에 참여하기</small></span><ArrowRight size={18} /></Link>
      {!cloudMode && <div className="local-notice"><Cloud size={17} /><p><strong>로컬 모드</strong>지금 만든 내용은 이 기기의 IndexedDB에 저장돼요. 실시간 협업은 Firebase 연결 후 활성화됩니다.</p></div>}
      {cloudMode && !signedIn && <Link className="cloud-login" to="/auth"><Cloud size={17} /><span><strong>클라우드에 연결하기</strong><small>로그인하고 여행을 친구와 실시간으로 공유하세요.</small></span><ArrowRight size={17} /></Link>}
    </main>
    <Sheet open={settings} title="내 프로필" onClose={() => setSettings(false)}><label className="field profile-field"><span>이름</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} /></label><div className="setting-hint"><Settings2 size={17} />이 이름은 여행 멤버와 채팅에 표시됩니다.</div><Button full onClick={saveName}>저장</Button>{signedIn && <div className="profile-signout"><Button full variant="secondary" loading={working} onClick={() => void logout()}><LogOut size={17} /> 로그아웃</Button></div>}</Sheet>
    <Sheet open={Boolean(deleteTarget)} title="여행 삭제" onClose={() => setDeleteTarget(null)}>{deleteTarget && <div className="destructive-confirm"><span><Trash2 size={22} /></span><h3>{deleteTarget.name}을(를) 삭제할까요?</h3><p>여행방의 노트, 일정, 채팅, 투표와 공개 링크가 함께 삭제되며 되돌릴 수 없어요.</p>{actionError && <p className="form-error">{actionError}</p>}<Button full variant="danger" loading={working} onClick={() => void confirmDelete()}>여행 삭제</Button><Button full variant="ghost" onClick={() => setDeleteTarget(null)}>취소</Button></div>}</Sheet>
    <Sheet open={Boolean(shareTarget)} title="일정 공유" onClose={() => setShareTarget(null)}>{shareTarget && <div className="public-share"><span className="public-share__icon"><Share2 size={22} /></span><h3>{shareTarget.name}</h3><p>이 링크에서는 지도, 웨이포인트와 일정 목록만 볼 수 있어요. 멤버, 노트, 채팅과 투표는 공개되지 않습니다.</p>{working ? <div className="share-loading"><span className="tiny-loader" /> 공개 링크 만드는 중…</div> : shareUrl ? <><label className="field"><span>읽기 전용 공개 링크</span><input readOnly value={shareUrl} /></label><div className="button-row"><Button variant="secondary" onClick={() => void copyShare()}><Copy size={16} /> {copied ? '복사됨' : '복사'}</Button><Button onClick={() => void systemShare()}><Share2 size={16} /> 공유</Button></div><a className="button button--ghost button--full" href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> 공개 화면 열기</a></> : <>{actionError && <p className="form-error">{actionError}</p>}<Button full onClick={() => void openShare(shareTarget)}>다시 시도</Button></>}</div>}</Sheet>
  </div>
}

function TripSwipeCard({ trip, canManage, onShare, onDelete }: { trip: Trip; canManage: boolean; onShare: () => void; onDelete: () => void }) {
  const [side, setSide] = useState<'share' | 'delete' | null>(null); const [dragX, setDragX] = useState(0); const startX = useRef<number | null>(null); const currentDrag = useRef(0); const suppressClick = useRef(false)
  const offset = dragX || (side === 'share' ? 82 : side === 'delete' ? -82 : 0)
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => { if (!canManage) return; startX.current = event.clientX; currentDrag.current = 0; setDragX(0) }
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (startX.current === null || !canManage) return; const next = Math.max(-96, Math.min(96, event.clientX - startX.current)); if (Math.abs(next) > 6) event.currentTarget.setPointerCapture(event.pointerId); currentDrag.current = next; setDragX(next) }
  const pointerUp = () => { if (startX.current === null) return; suppressClick.current = Math.abs(currentDrag.current) > 6; if (currentDrag.current > 46) setSide('share'); else if (currentDrag.current < -46) setSide('delete'); else setSide(null); startX.current = null; currentDrag.current = 0; setDragX(0) }
  return <div className={`trip-swipe ${side ? `is-${side}` : ''}`}><button className="trip-swipe__action trip-swipe__action--share" onClick={() => { setSide(null); onShare() }} aria-label={`${trip.name} 일정 공유`}><Share2 size={19} /><span>공유</span></button><button className="trip-swipe__action trip-swipe__action--delete" onClick={() => { setSide(null); onDelete() }} aria-label={`${trip.name} 삭제`}><Trash2 size={19} /><span>삭제</span></button><div className="trip-swipe__content" style={{ transform: `translateX(${offset}px)` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}><Link draggable={false} to={`/trip/${trip.id}/note`} className="trip-card" onClick={(event) => { if (suppressClick.current) { event.preventDefault(); suppressClick.current = false; return } if (side) { event.preventDefault(); setSide(null) } }}><span className="trip-card__emoji">{trip.emoji}</span><div className="trip-card__body"><h3>{trip.name}</h3><p>{trip.destination}</p><small>{formatTripDates(trip.startDate, trip.endDate)} · {trip.members.length}명</small></div><ArrowRight size={19} /></Link></div></div>
}
