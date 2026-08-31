import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useApp } from './context/AppContext'
import { ChatScreen } from './features/chat/ChatScreen'
import { MapScreen } from './features/map/MapScreen'
import { NoteScreen } from './features/notes/NoteScreen'
import { AuthPage } from './pages/AuthPage'
import { CreateTripPage } from './pages/CreateTripPage'
import { HomePage } from './pages/HomePage'
import { JoinTripPage } from './pages/JoinTripPage'
import { TripLayout } from './pages/TripLayout'

export default function App() {
  return <Routes><Route path="/" element={<HomePage />} /><Route path="/auth" element={<AuthPage />} /><Route path="/create" element={<CloudAuthGate><CreateTripPage /></CloudAuthGate>} /><Route path="/join" element={<JoinTripPage />} /><Route path="/join/:inviteCode" element={<JoinTripPage />} /><Route path="/trip/:tripId" element={<CloudAuthGate><TripLayout /></CloudAuthGate>}><Route index element={<Navigate to="note" replace />} /><Route path="note" element={<NoteScreen />} /><Route path="note/:pageId" element={<NoteScreen />} /><Route path="map" element={<MapScreen />} /><Route path="chat" element={<ChatScreen />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>
}

function CloudAuthGate({ children }: { children: ReactNode }) { const { cloudMode, signedIn, ready } = useApp(); if (!ready) return <div className="app-shell gate-loading"><span className="tiny-loader" /></div>; if (cloudMode && !signedIn) return <Navigate to="/auth" replace />; return children }
