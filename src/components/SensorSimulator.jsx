import { useEffect, useState } from "react"
import { getSeats, updateSeatStatus } from "../dataClient"

const TOTAL_SEATS = 10

export default function SensorSimulator() {
  const [seats, setSeats] = useState([])
  const [pendingSeats, setPendingSeats] = useState(new Set()) // Track seats being updated

  useEffect(() => {
    loadSeats()
    const poll = setInterval(loadSeats, 3000)
    return () => clearInterval(poll)
  }, [])

  async function loadSeats() {
    const { data } = await getSeats()
    // Initialize seats 1-10 if not present
    const initialSeats = []
    for (let i = 1; i <= TOTAL_SEATS; i++) {
      const existing = data.find(s => String(s.seatId) === String(i))
      initialSeats.push(existing || { seatId: i, status: "free" })
    }
    
    // Merge with local state, but don't overwrite pending seats
    setSeats(prevSeats => {
      const newSeats = [...initialSeats]
      prevSeats.forEach(prevSeat => {
        if (pendingSeats.has(prevSeat.seatId)) {
          // Keep the local state for pending seats
          const index = newSeats.findIndex(s => String(s.seatId) === String(prevSeat.seatId))
          if (index !== -1) {
            newSeats[index] = prevSeat
          }
        }
      })
      return newSeats
    })
    
    // If there are seats not in the data, initialize them
    const seatsToUpdate = initialSeats.filter(seat => 
      !data.find(s => String(s.seatId) === String(seat.seatId))
    )
    for (const seat of seatsToUpdate) {
      await updateSeatStatus(seat.seatId, seat.status)
    }
  }

  async function handleSeatClick(seatId, currentStatus) {
    // Optimistic update: change UI immediately
    const newStatus = currentStatus === "occupied" ? "free" : "occupied"
    setSeats(prevSeats => 
      prevSeats.map(seat => 
        seat.seatId === seatId ? { ...seat, status: newStatus } : seat
      )
    )
    setPendingSeats(prev => new Set(prev).add(seatId)) // Mark as pending
    
    // Update backend in the background
    try {
      await updateSeatStatus(seatId, newStatus)
    } catch (error) {
      console.error("Failed to update seat status:", error)
      // Revert if there's an error
      await loadSeats()
    } finally {
      setPendingSeats(prev => {
        const newSet = new Set(prev)
        newSet.delete(seatId)
        return newSet
      }) // Clear pending state
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <main className="mx-auto flex w-full max-w-[600px] flex-col gap-6">
        <header className="text-center">
          <div className="inline-flex items-center rounded-full bg-[#1e3932] px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-50">
            <span className="relative inline-block pr-16 pt-1">
              <span>SEATMASTER SENSOR SIMULATOR</span>
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[#1e3932]">
            Sensor Simulator
          </h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            Toggle seats to simulate real sensor updates
          </p>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-[#cbe7dd]">
          <div className="grid grid-cols-5 gap-4">
            {seats.map((seat) => (
              <button
                key={seat.seatId}
                onClick={() => handleSeatClick(seat.seatId, seat.status)}
                disabled={isLoading}
                className={`aspect-square rounded-2xl text-white font-bold text-lg shadow-soft transition-all ${
                  seat.status === "occupied"
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {seat.seatId}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-green-600"></div>
              <span className="text-sm text-[#4b5563]">Free</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-yellow-500"></div>
              <span className="text-sm text-[#4b5563]">Occupied</span>
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400">
          Simulates ESP32 sensor behavior
        </footer>
      </main>
    </div>
  )
}
