import { ChevronLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { useApp } from '../context/AppContext'

const emojis = ['✈️', '🌿', '🏕️', '🌊', '🏙️', '🚆']
export function CreateTripPage() {
  const navigate = useNavigate(); const { createTrip } = useApp()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ name: '', destination: '', startDate: today, endDate: today, emoji: '✈️' }); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { const trip = await createTrip(form); navigate(`/trip/${trip.id}/note`) } catch { setError('여행을 저장하지 못했어요. Firebase 권한 또는 네트워크 연결을 확인해 주세요.') } finally { setLoading(false) } }
  return <div className="app-shell form-shell"><header className="simple-header"><Link to="/" className="icon-button"><ChevronLeft size={24} /></Link><h1>새 여행</h1><span /></header><form className="screen-form" onSubmit={submit}><div className="intro-copy"><span className="big-emoji">{form.emoji}</span><h2>어디로 떠나나요?</h2><p>여행방을 만들면 노트, 지도, 채팅이 한곳에 모여요.</p></div><div className="emoji-picker" aria-label="커버 아이콘">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => setForm({ ...form, emoji })} className={form.emoji === emoji ? 'is-selected' : ''}>{emoji}</button>)}</div><label className="field"><span>여행 이름</span><input required placeholder="예: 여름 토론토" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>목적지</span><input required placeholder="도시 또는 지역" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} /></label><div className="field-grid"><label className="field"><span>시작일</span><input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: event.target.value > form.endDate ? event.target.value : form.endDate })} /></label><label className="field"><span>종료일</span><input required type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>{error && <p className="form-error">{error}</p>}<Button full type="submit" loading={loading}>여행 만들기</Button></form></div>
}
