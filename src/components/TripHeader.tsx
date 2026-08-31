import { ChevronLeft, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatTripDates, initials } from '../lib/utils'
import type { Trip } from '../types'
import { Button } from './Button'
import { Sheet } from './Sheet'

export function TripHeader({ trip }: { trip: Trip }) {
  const [membersOpen, setMembersOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { cloudMode } = useApp()
  const copyInvite = async () => { const url = `${location.origin}${location.pathname}#/join/${trip.inviteCode}`; await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const share = async () => { const url = `${location.origin}${location.pathname}#/join/${trip.inviteCode}`; if (navigator.share) await navigator.share({ title: `${trip.name} · T Log`, text: `${trip.name} 여행에 함께해요`, url }); else await copyInvite() }
  return <>
    <header className="trip-header"><Link className="icon-button" to="/" aria-label="여행 목록"><ChevronLeft size={24} /></Link><div className="trip-header__title"><strong>{trip.name}</strong><span>{formatTripDates(trip.startDate, trip.endDate)}</span></div><button className="member-button" onClick={() => setMembersOpen(true)}><Users size={19} /><span>{trip.members.length}</span></button></header>
    <Sheet open={membersOpen} title="멤버" onClose={() => setMembersOpen(false)}>
      <div className="member-list">{trip.members.map((member) => <div className="member-row" key={member.id}><span className="avatar">{initials(member.profile.name)}</span><div><strong>{member.profile.name}</strong><small>{member.role === 'OWNER' ? '방장' : '멤버'}</small></div></div>)}</div>
      <div className="invite-panel"><span>초대 코드</span><strong>{trip.inviteCode}</strong><p>{cloudMode ? '링크를 받은 친구가 바로 참여할 수 있어요.' : 'Supabase를 연결하면 다른 기기에서도 초대가 작동해요.'}</p><div className="button-row"><Button variant="secondary" onClick={copyInvite}>{copied ? '복사됨' : '복사'}</Button><Button onClick={share}>공유</Button></div></div>
    </Sheet>
  </>
}
