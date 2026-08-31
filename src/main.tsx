import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { AppProvider } from './context/AppContext'

createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><AppProvider><App /><PwaUpdatePrompt /></AppProvider></HashRouter></StrictMode>)
