import { Link } from 'react-router-dom'
import { env } from '@/shared/env'

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Chess Coach</h1>
      <p>Welcome! This is a Vite + React + TS scaffold.</p>

      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/health">Health</Link>
      </nav>

      <section style={{ marginTop: 16, fontSize: 14, opacity: 0.9 }}>
        <div>
          <strong>Env:</strong> APP_NAME = {env.VITE_APP_NAME}
        </div>
        <div>
          <strong>Mode:</strong> {import.meta.env.MODE}
        </div>
      </section>
    </div>
  )
}

