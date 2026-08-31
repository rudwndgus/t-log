import { Navigate, Outlet, useParams } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { OfflineBanner } from '../components/OfflineBanner'
import { TripHeader } from '../components/TripHeader'
import { useApp } from '../context/AppContext'

export function TripLayout() { const { tripId } = useParams(); const { data } = useApp(); const trip = data.trips.find((item) => item.id === tripId); if (!trip) return <Navigate to="/" replace />; return <div className="app-shell trip-shell"><OfflineBanner /><TripHeader trip={trip} /><main className="trip-content"><Outlet context={{ trip }} /></main><BottomNav /></div> }
