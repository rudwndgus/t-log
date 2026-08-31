import { ArrowRight, Cloud, MapPin, Plus, Settings2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { OfflineBanner } from '../components/OfflineBanner'
import { Sheet } from '../components/Sheet'
import { useApp } from '../context/AppContext'
import { formatTripDates } from '../lib/utils'

export function HomePage() {
  const { data, profile, setProfileName, cloudMode, signedIn } = useApp()
  const [settings, setSettings] = useState(false)
  const [name, setName] = useState(profile.name)
  const saveName = () => { setProfileName(name); setSettings(false) }
  return <div className="app-shell home-shell"><OfflineBanner /><header className="home-header"><div><span className="eyebrow">WRITE · DISCUSS · DECIDE · TRAVEL</span><h1>T Log</h1></div><button className="avatar avatar--button" onClick={() => setSettings(true)}>{profile.name.slice(0, 1)}</button></header>
    <main className="home-content"><div className="section-title"><div><h2>나의 여행</h2><p>{data.trips.length ? `${data.trips.length}개의 여행` : '함께 떠날 여행을 시작해보세요'}</p></div><Link className="circle-action" to="/create" aria-label="새 여행"><Plus size={22} /></Link></div>
      {data.trips.length === 0 ? <EmptyState icon={MapPin} title="아직 여행이 없어요" description="첫 여행을 만들고, 친구와 함께 계획해보세요." action={<Link className="button button--primary" to="/create"><Plus size={17} /> 새 여행</Link>} /> : <div className="trip-list">{data.trips.map((trip) => <Link to={`/trip/${trip.id}/note`} className="trip-card" key={trip.id}><span className="trip-card__emoji">{trip.emoji}</span><div className="trip-card__body"><h3>{trip.name}</h3><p>{trip.destination}</p><small>{formatTripDates(trip.startDate, trip.endDate)} · {trip.members.length}명</small></div><ArrowRight size={19} /></Link>)}</div>}
      <Link className="join-link" to="/join"><UserPlus size={18} /><span><strong>초대 코드가 있나요?</strong><small>친구의 여행에 참여하기</small></span><ArrowRight size={18} /></Link>
      {!cloudMode && <div className="local-notice"><Cloud size={17} /><p><strong>로컬 모드</strong>지금 만든 내용은 이 기기의 IndexedDB에 저장돼요. 실시간 협업은 Firebase 연결 후 활성화됩니다.</p></div>}
      {cloudMode && !signedIn && <Link className="cloud-login" to="/auth"><Cloud size={17} /><span><strong>클라우드에 연결하기</strong><small>로그인하고 여행을 친구와 실시간으로 공유하세요.</small></span><ArrowRight size={17} /></Link>}
    </main>
    <Sheet open={settings} title="내 프로필" onClose={() => setSettings(false)}><label className="field"><span>이름</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} /></label><div className="setting-hint"><Settings2 size={17} />이 이름은 여행 멤버와 채팅에 표시됩니다.</div><Button full onClick={saveName}>저장</Button></Sheet>
  </div>
}
