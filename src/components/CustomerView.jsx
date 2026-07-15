import { useEffect, useMemo, useState } from "react"
import { getLatest, validateTableCode, placeOrder } from "../dataClient"
import StatusCard from "./StatusCard"

const DEFAULT_LOCATIONS = ["Main Street Starbucks", "Mall Starbucks"]

function formatTimeAgo(date) {
  if (!date) return "No reports yet"
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return "Last updated: just now"
  if (minutes === 1) return "Last updated: 1 minute ago"
  if (minutes < 60) return `Last updated: ${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  return hours === 1
    ? "Last updated: 1 hour ago"
    : `Last updated: ${hours} hours ago`
}

const statusPercentages = {
  empty: 10,
  few: 40,
  busy: 70,
  full: 95,
}

export default function CustomerView() {
  const [locations, setLocations] = useState(() => {
    try {
      const raw = localStorage.getItem("bucksseat_locations")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) return parsed
      }
    } catch {}
    return DEFAULT_LOCATIONS
  })
  const [status, setStatus] = useState("empty")
  const [lastUpdated, setLastUpdated] = useState(null)
  const [chargingPorts, setChargingPorts] = useState(0)
  const [location, setLocation] = useState(() => {
    const stored = localStorage.getItem("bucksseat_location")
    if (stored) return stored
    try {
      const raw = localStorage.getItem("bucksseat_locations")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) return parsed[0]
      }
    } catch {}
    return DEFAULT_LOCATIONS[0]
  })
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")
  const [tableCode, setTableCode] = useState("")
  const [orderText, setOrderText] = useState("")
  const [orderStatus, setOrderStatus] = useState("")
  const [isAnimating, setIsAnimating] = useState(false)

  const lastUpdatedLabel = useMemo(
    () => formatTimeAgo(lastUpdated),
    [lastUpdated]
  )

  const seatFillPct = statusPercentages[status] ?? 0
  const seatFillCount = Math.round((seatFillPct / 100) * 20)
  const chargingFillCount = Math.max(0, chargingPorts || 0)

  useEffect(() => {
    let ignore = false

    const loadLatest = async () => {
      const { data, error } = await getLatest(location)

      if (!ignore) {
        if (error) {
          return
        }
        if (data) {
          setStatus(data.status)
          setLastUpdated(new Date(data.created_at))
          if (typeof data.chargingPorts === "number") {
            setChargingPorts(data.chargingPorts)
          }
        }
      }
    }

    loadLatest()

    const poll = setInterval(async () => {
      const { data } = await getLatest(location)
      if (data && !ignore) {
        setStatus(data.status)
        setLastUpdated(new Date(data.created_at))
        if (typeof data.chargingPorts === "number") {
          setChargingPorts(data.chargingPorts)
        }
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 450)
      }
    }, 3000)

    const handleStorage = (e) => {
      if (e.key === "bucksseat_latest_report_by_location") {
        loadLatest()
      }
    }
    window.addEventListener("storage", handleStorage)

    return () => {
      ignore = true
      clearInterval(poll)
      window.removeEventListener("storage", handleStorage)
    }
  }, [location])

  const handlePlaceOrder = (event) => {
    event.preventDefault()
    if (!tableCode || !orderText) {
      setOrderStatus("Please enter your table code and order.")
      return
    }
    setOrderStatus("Checking table code…")
    Promise.resolve()
      .then(() => validateTableCode(tableCode.trim(), location))
      .then((res) => {
        if (!res?.valid) {
          setOrderStatus("Invalid table code. Please check the code on your table.")
          return null
        }
        return placeOrder(tableCode.trim(), orderText.trim(), location)
      })
      .then((res) => {
        if (!res) return
        if (res.error) {
          setOrderStatus("Could not send order. Please tell the barista.")
          return
        }
        setOrderStatus(
          "Order placed from your table. A barista will come over shortly."
        )
        setOrderText("")
      })
      .catch(() => {
        setOrderStatus("Could not send order. Please tell the barista.")
      })
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <main className="mx-auto flex w-full max-w-[500px] flex-col gap-6">
        <header className="text-center">
          <div className="inline-flex items-center rounded-full bg-[#1e3932] px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-50">
            <span className="relative inline-block pr-16 pt-1">
              <span>STARBUCKS SEAT CHECKER</span>
              <span className="absolute -top-2 right-0 text-[0.55em] tracking-[0.25em]">
                POWERED BY SEATMASTER
              </span>
            </span>
          </div>
          <div className="mt-3 flex flex-col items-center justify-center gap-3">
            <h1 className="font-display text-3xl font-semibold text-[#1e3932]">
              Live Starbucks seat availability
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Location
              </span>
              <select
                value={location}
                onChange={(event) => {
                  const next = event.target.value
                  setLocation(next)
                  localStorage.setItem("bucksseat_location", next)
                }}
                className="rounded-2xl border border-[#cbe7dd] bg-white px-3 py-1 text-xs font-semibold text-[#111827] shadow-sm"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <button
                className="text-xs font-semibold text-[#00754a] underline"
                onClick={() => setShowAddLocation(true)}
              >
                Add
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-[#4b5563]">
            Check how full your store feels, updated by people inside.
          </p>
          <p className="mt-1 text-xs font-semibold text-[#00754a]">
            Free Wi-Fi available for customers.
          </p>
        </header>
        {showAddLocation ? (
          <section className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-[#cbe7dd]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="New Starbucks location name"
                className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
              <button
                className="rounded-2xl bg-[#00754a] px-3 py-2 text-sm font-semibold text-emerald-50 shadow-soft hover:bg-[#006241]"
                onClick={() => {
                  const name = newLocationName.trim()
                  if (!name) return
                  if (!locations.includes(name)) {
                    const next = [...locations, name]
                    setLocations(next)
                    localStorage.setItem("bucksseat_locations", JSON.stringify(next))
                  }
                  setLocation(name)
                  localStorage.setItem("bucksseat_location", name)
                  setNewLocationName("")
                  setShowAddLocation(false)
                }}
              >
                Save
              </button>
              <button
                className="rounded-2xl border border-[#cbe7dd] px-3 py-2 text-sm font-semibold text-[#374151] shadow-sm hover:bg-[#f5f0e8]"
                onClick={() => {
                  setNewLocationName("")
                  setShowAddLocation(false)
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <StatusCard
          status={status}
          lastUpdatedLabel={lastUpdatedLabel}
          isAnimating={isAnimating}
          nextUpdateCountdown="00:00"
        />

        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-[#cbe7dd]">
          <h2 className="font-display text-lg font-semibold text-[#1e3932]">
            How full is this store?
          </h2>
          <p className="mt-2 text-sm text-[#4b5563]">
            Based on the latest update from baristas and customers.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-semibold text-[#1f2937]">
                {seatFillPct}
                <span className="text-xl text-[#6b7280]">%</span>
              </p>
              <p className="text-sm text-[#6b7280]">approximate fullness</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 20 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-3 w-3 rounded-sm border ${
                    index < seatFillCount
                      ? "bg-black border-black"
                      : "bg-white border-[#d1d5db]"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-[#1f2937]">
                {chargingPorts}
              </p>
              <p className="text-sm text-[#6b7280]">
                charging ports currently available
              </p>
            </div>
            {chargingFillCount <= 10 && (
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-3 w-3 rounded-full border ${
                      index < chargingFillCount
                        ? "bg-black border-black"
                        : "bg-white border-[#d1d5db]"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <form onSubmit={handlePlaceOrder} className="mt-6 space-y-3">
            <h3 className="font-display text-base font-semibold text-[#1e3932]">
              Order from your table
            </h3>
            <p className="text-xs text-[#6b7280]">
              Enter the code or scan from the QR on your table so staff know
              where to bring your order.
            </p>
            <div className="grid gap-3">
              <input
                type="text"
                placeholder="Table code or QR code text"
                value={tableCode}
                onChange={(event) => setTableCode(event.target.value)}
                className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
              />
              <textarea
                placeholder="What would you like to order?"
                rows={3}
                value={orderText}
                onChange={(event) => setOrderText(event.target.value)}
                className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-[#00754a] px-4 py-2 text-sm font-semibold text-emerald-50 shadow-soft hover:bg-[#006241]"
              >
                Place order from this table
              </button>
              {orderStatus ? (
                <p className="text-xs font-semibold text-[#00754a]">
                  {orderStatus}
                </p>
              ) : null}
            </div>
          </form>
        </section>

        <footer className="text-center text-xs text-slate-400">
          Made for Starbucks customers
        </footer>
      </main>
    </div>
  )
}
