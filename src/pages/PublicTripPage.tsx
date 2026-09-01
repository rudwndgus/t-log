import { ChevronLeft, ChevronRight, List, Map as MapIcon, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { MapCanvas } from '../features/map/MapCanvas'
import { db } from '../lib/firebase'
import { dayLabel, formatTripDates, tripDayCount } from '../lib/utils'
import { getPublicTrip, type PublicTrip } from '../services/firestore'
import type { ItineraryPlace } from '../types'

export function PublicTripPage() {
  const { shareId = '' } = useParams(); const [trip, setTrip] = useState<PublicTrip | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [day, setDay] = useState(0); const [view, setView] = useState<'map' | 'list'>('map'); const [selected, setSelected] = useState<ItineraryPlace | null>(null)
  useEffect(() => { let active = true; if (!db || !shareId) { setError('공개 여행을 불러올 수 없어요.'); setLoading(false); return }; void getPublicTrip(db, shareId).then((result) => { if (!active) return; if (!result) setError('공개 여행을 찾을 수 없어요.'); else setTrip(result) }).catch(() => { if (active) setError('공개 여행을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [shareId])
  const places = useMemo(() => (trip?.places || []).filter((place) => place.day === day).sort((a, b) => a.sortOrder - b.sortOrder), [trip, day])
  if (loading) return <div className="app-shell public-trip-state"><span className="tiny-loader" /><p>여행 일정을 불러오는 중…</p></div>
  if (!trip || error) return <div className="app-shell public-trip-state"><MapPin size={34} /><h1>일정을 열 수 없어요</h1><p>{error}</p></div>
  const days = tripDayCount(trip.startDate, trip.endDate)
  return <div className="app-shell public-trip-shell"><header className="public-trip-header"><span className="big-emoji">{trip.emoji}</span><div><small>SHARED T LOG</small><h1>{trip.name}</h1><p>{trip.destination} · {formatTripDates(trip.startDate, trip.endDate)}</p></div></header><main className="public-trip-main"><div className="map-controls"><div className="day-switcher"><button disabled={day === 0} onClick={() => setDay(day - 1)}><ChevronLeft size={20} /></button><strong>{dayLabel(trip.startDate, day)}</strong><button disabled={day === days - 1} onClick={() => setDay(day + 1)}><ChevronRight size={20} /></button></div><div className="view-toggle"><button className={view === 'map' ? 'is-active' : ''} onClick={() => setView('map')}><MapIcon size={15} /> MAP</button><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><List size={15} /> LIST</button></div></div>{view === 'map' ? <div className="public-map-stage"><MapCanvas places={places} focusedId={selected?.id} resetKey={day} onSelect={setSelected} /></div> : <div className="public-list">{places.length ? places.map((place, index) => <button key={place.id} onClick={() => setSelected(place)}><span>{index + 1}</span><div>{place.startTime && <time>{place.startTime}</time>}<strong>{place.name}</strong><small>{place.address || '위치 정보'}</small></div><ChevronRight size={18} /></button>) : <div className="public-empty"><MapPin size={25} /><strong>이 날짜에는 공개된 일정이 없어요.</strong></div>}</div>}</main><footer className="public-trip-footer"><strong>T Log</strong><span>여행의 순간과 동선을 공유했어요.</span></footer><Sheet open={Boolean(selected)} title="일정 장소" onClose={() => setSelected(null)}>{selected && <div className="place-detail"><span className="place-detail__icon"><MapPin size={22} /></span><h3>{selected.name}</h3><p>{selected.address || '주소 없음'}</p>{selected.startTime && <time>{selected.startTime}</time>}</div>}</Sheet></div>
}
