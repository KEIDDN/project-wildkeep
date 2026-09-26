import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startGamepad } from './game/input/gamepad'
import './ui/nav/padNav'

// Controllers are polled from the first frame, title screen included.
startGamepad()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
