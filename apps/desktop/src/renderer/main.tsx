import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@md/core/style.css'
import './styles/app.css'

const host = document.getElementById('root')
if (!host) throw new Error('#root missing')

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>
)
