import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { DemoStoreProvider } from './context/DemoStoreContext'
import { SettingsProvider } from './context/SettingsContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <DemoStoreProvider>
          <App />
        </DemoStoreProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
