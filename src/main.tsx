import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import 'mapbox-gl/dist/mapbox-gl.css'
import './styles.css'
import App from './App'
import { AppProvider } from './context/AppContext'

registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><AppProvider><App /></AppProvider></HashRouter></StrictMode>)
