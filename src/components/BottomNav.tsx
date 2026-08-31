import { Map, MessageCircle, NotebookPen } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'

const tabs = [{ key: 'note', label: '노트', icon: NotebookPen }, { key: 'map', label: '지도', icon: Map }, { key: 'chat', label: '채팅', icon: MessageCircle }]
export function BottomNav() { const { tripId } = useParams(); return <nav className="bottom-nav" aria-label="여행 메뉴">{tabs.map(({ key, label, icon: Icon }) => <NavLink key={key} to={`/trip/${tripId}/${key}`} className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}><Icon size={21} strokeWidth={isFinite(2) ? 1.9 : 2} /><span>{label}</span></NavLink>)}</nav> }
