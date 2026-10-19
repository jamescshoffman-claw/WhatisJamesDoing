import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import HomePage from './HomePage'
import AnimalGame from './AnimalGame'
import BalanceGame from './BalanceGame'
import Balloween from './balloween/BalloweenApp'

function GeoStudyRedirect() {
  useEffect(() => {
    window.location.replace('https://geostudy.org')
  }, [])
  return null
}

/** Site-wide AdSense auto ads, except on the Balloween tournament app where the vignette ad steals the first tap. */
function AdSense() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (/^\/balloween/i.test(pathname)) return
    if (document.querySelector('script[src*="adsbygoogle.js"]')) return
    const s = document.createElement('script')
    s.async = true
    s.crossOrigin = 'anonymous'
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7665194311315691'
    document.head.appendChild(s)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AdSense />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/geostudy" element={<GeoStudyRedirect />} />
        <Route path="/animals" element={<AnimalGame />} />
        <Route path="/balance" element={<BalanceGame />} />
        <Route path="/Balloween/Test/*" element={<Balloween t="test" />} />
        <Route path="/Balloween/*" element={<Balloween t="live" />} />
      </Routes>
    </BrowserRouter>
  )
}
