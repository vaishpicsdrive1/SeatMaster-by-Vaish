import { Routes, Route } from "react-router-dom"
import BaristaView from "./components/BaristaView"
import CustomerView from "./components/CustomerView"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerView />} />
      <Route path="/barista" element={<BaristaView />} />
    </Routes>
  )
}
