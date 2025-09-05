import React from 'react'

import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { SoundProvider } from './contexts/SoundContext'
import { GameProvider } from './contexts/GameContext'
import App from './pages/App'
import Health from './pages/Health'
import DBDemo from './pages/DBDemo'
import './styles/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/health',
    element: <Health />,
  },
  {
    path: '/db-demo',
    element: <DBDemo />,
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SoundProvider>
      <GameProvider>
        <RouterProvider router={router} />
      </GameProvider>
    </SoundProvider>
  </React.StrictMode>
)
