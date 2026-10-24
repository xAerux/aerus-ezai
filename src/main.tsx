import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if (new URLSearchParams(window.location.search).has('desktop')) {
  document.documentElement.classList.add('ez-ai-desktop')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)

import './workspaces.css'
