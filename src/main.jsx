import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

window.addEventListener('error', (e) => {
  document.body.innerHTML =
    '<pre style="color:#ff5555;background:#0a0f1e;padding:1rem;font-size:14px;white-space:pre-wrap;word-break:break-word;">'
    + 'RUNTIME ERROR:\n\n' + (e.error?.stack || e.message) + '</pre>'
})
window.addEventListener('unhandledrejection', (e) => {
  document.body.innerHTML =
    '<pre style="color:#ffaa00;background:#0a0f1e;padding:1rem;font-size:14px;white-space:pre-wrap;word-break:break-word;">'
    + 'PROMISE REJECTION:\n\n' + (e.reason?.stack || e.reason) + '</pre>'
})

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (err) {
  document.body.innerHTML =
    '<pre style="color:#ff5555;background:#0a0f1e;padding:1rem;font-size:14px;white-space:pre-wrap;word-break:break-word;">'
    + 'MOUNT ERROR:\n\n' + (err.stack || err.message) + '</pre>'
}
