// frontend/src/components/SymbolSelector.jsx
import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Bookmap from './components/Bookmap'
import Dashboard from './components/Dashboard'
import './App.css'

// API base URL - replace with your actual backend URL
// if not running locally, use the public IP address of your server
//const API_BASE_URL = 'http://server_ip_address:8080';
const API_BASE_URL = 'http://localhost:8080';

function App() {
  const [symbols, setSymbols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log("Fetching symbols from", API_BASE_URL);
    fetch(`${API_BASE_URL}/symbols`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch symbols: ${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => {
        console.log("Symbols received:", data); // Debug
        setSymbols(data.symbols || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching symbols:", err);
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <Router>
      <div className="min-h-screen bg-gradient-radial from-dark-primary to-dark-secondary">
        <header  className="mt-auto bg-transparent">    
          <nav className="container mx-auto px-3 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-blue-400 select-none">
                Market Depth
              </h1>
            </div>
          </nav>
        </header>        
        <main className="container mx-auto px-3 py-8">
          <Routes>
            <Route 
              path="/" 
              element={
                loading ? (
                  <div className="flex flex-col items-center justify-center h-96 space-y-4">
                    <div className="w-16 h-16 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"/>
                    <p className="text-xl text-text-secondary animate-pulse">Loading symbols...</p>
                  </div>
                ) : error ? (
                  <div className="glass p-8 rounded-xl max-w-lg mx-auto space-y-4">
                    <div className="flex items-center space-x-3 text-red-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                      <h3 className="text-xl font-semibold">Connection Error</h3>
                    </div>
                    <p className="text-text-secondary">{error}</p>
                    <p className="text-sm text-text-secondary">Make sure the API server is running at {API_BASE_URL}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="btn hover:bg-accent-secondary w-full"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <Dashboard symbols={symbols} apiBaseUrl={API_BASE_URL} />
                )
              } 
            />

            <Route path="/bookmap/:symbol" element={<Bookmap apiBaseUrl={API_BASE_URL} />} />
          </Routes>
        </main>          
        <footer className="mt-auto bg-transparent">
          <div className="container mx-auto px-3 py-4">
            <div className="text-center">
              <a href="https://github.com/2187Nick" target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                <img src="/github-mark-white.svg" alt="GitHub" className="w-6 h-6" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App