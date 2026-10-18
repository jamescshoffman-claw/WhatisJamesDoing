import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

export default function App() {
  return (
    <BrowserRouter>
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
