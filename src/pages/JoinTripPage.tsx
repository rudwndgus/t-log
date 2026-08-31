import { ChevronLeft, TicketCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { useApp } from '../context/AppContext'
import { formatTripDates } from '../lib/utils'

export function JoinTripPage() {
  const { inviteCode: routeCode } = useParams(); const navigate = useNavigate(); const { joinTrip, joinCloudTrip, cloudMode, signedIn } = useApp()
  const [code, setCode] = useState((routeCode || '').toUpperCase()); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const matched = joinTrip(code)
  const submit = async (event: FormEvent) => { event.preventDefault(); const trip = joinTrip(code); if (trip) { navigate(`/trip/${trip.id}/note`); return } if (cloudMode && !signedIn) { navigate('/auth'); return } if (cloudMode) { setLoading(true); try { const tripId = await joinCloudTrip(code); navigate(`/trip/${tripId}/note`) } catch { setError('유효하지 않거나 만료된 초대 코드예요.') } finally { setLoading(false) } } else setError('이 기기에서 찾을 수 없는 코드예요. Firebase 연결 후 다른 사람의 초대에 참여할 수 있어요.') }
  return <div className="app-shell form-shell"><header className="simple-header"><Link to="/" className="icon-button"><ChevronLeft size={24} /></Link><h1>여행 참여</h1><span /></header><form className="screen-form join-form" onSubmit={submit}><div className="intro-copy"><span className="outline-icon"><TicketCheck size={30} /></span><h2>{matched ? `${matched.name}에 참여할까요?` : '초대 코드를 입력하세요'}</h2><p>{matched ? `${matched.destination} · ${formatTripDates(matched.startDate, matched.endDate)}` : '친구에게 받은 6자리 코드를 입력하면 돼요.'}</p></div><label className="field code-field"><span>초대 코드</span><input required autoCapitalize="characters" autoCorrect="off" maxLength={6} placeholder="7X92KD" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError('') }} /></label>{error && <p className="form-error">{error}</p>}<Button full type="submit" loading={loading} disabled={code.length !== 6}>여행 참여하기</Button></form></div>
}
