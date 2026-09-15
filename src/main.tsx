import { createRoot } from 'react-dom/client'
import App from './components/DashboardApp'
// React Flow base styles are imported at the app entry (not inside NodeView)
// so the Nodes components stay importable from tooling that cannot load CSS.
import '@xyflow/react/dist/style.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
