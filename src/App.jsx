import { Routes, Route } from "react-router-dom";
import BaristaView from "./components/BaristaView";
import CustomerView from "./components/CustomerView";
import SensorSimulator from "./components/SensorSimulator";
import CameraDetector from "./components/CameraDetector";
import PhoneCamera from "./components/PhoneCamera";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerView />} />
      <Route path="/barista" element={<BaristaView />} />
      <Route path="/simulator" element={<SensorSimulator />} />
      <Route path="/camera-detect" element={<CameraDetector />} />
      <Route path="/phone-camera" element={<PhoneCamera />} />
    </Routes>
  );
}
