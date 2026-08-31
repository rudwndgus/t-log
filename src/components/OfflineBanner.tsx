import { WifiOff } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function OfflineBanner() { const { online } = useApp(); if (online) return null; return <div className="offline-banner"><WifiOff size={14} /> 오프라인 · 변경사항은 이 기기에 저장됩니다</div> }
