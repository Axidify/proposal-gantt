import { createRoot } from 'react-dom/client'
import App from './App'
import { installDevApiShim } from './lib/devApi'
import './styles/global.css'

installDevApiShim()

createRoot(document.getElementById('root')!).render(<App />)
