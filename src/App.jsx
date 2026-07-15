import { Routes, Route } from "react-router-dom"
import BaristaView from "./components/BaristaView"
import CustomerView from "./components/CustomerView"
import SensorSimulator from "./components/SensorSimulator"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerView />} />
      <Route path="/barista" element={<BaristaView />} />
      <Route path="/simulator" element={<SensorSimulator />} />
    </Routes>
  )
}
