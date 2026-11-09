import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { suivreEchelle } from './utils/echelle'
import './styles/index.css'
import './styles/academy.css'
import './styles/portal.css'
import './styles/delivery.css'
import './styles/bulletin.css'
import './styles/motion.css'
import './styles/medacap.css'
import './styles/sheet.css'
import './styles/costkey.css'

suivreEchelle()

suivreEchelle()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
