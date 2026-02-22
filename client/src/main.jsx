import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './components/theme-provider'
import './index.css'
import App from './App'
import Display from './components/Display'

const root = ReactDOM.createRoot(document.getElementById('root'))

function Root() {
  const isDisplay = typeof window !== 'undefined' && window.location.pathname === '/display'
  return isDisplay ? <Display /> : (
    <ThemeProvider defaultTheme="system" storageKey="spotiqueue-theme">
      <App />
    </ThemeProvider>
  )
}

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
