import { useEffect, useMemo, useRef, useState } from "react"
import { getLatest, submitReport, registerFranchise } from "../dataClient"
import StatusCard from "./StatusCard"
import SubmitButtons from "./SubmitButtons"

const COOLDOWN_MS = 5 * 60 * 1000
const DEFAULT_LOCATIONS = ["Main Street Starbucks", "Mall Starbucks"]

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.value = 880
    gain.gain.value = 0.25
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch {}
}

function playAlarm() {
  playBeep()
  setTimeout(playBeep, 250)
  setTimeout(playBeep, 500)
}

function showNotify() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Update seat availability", {
        body: "Please update the website so customers see the latest.",
      })
    }
  } catch {}
}

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

export default function BaristaView() {
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
  const [message, setMessage] = useState("")
  const [isAnimating, setIsAnimating] = useState(false)
  const [cooldownMs, setCooldownMs] = useState(0)
  const [chargingPorts, setChargingPorts] = useState(0)
  const [chargingDraft, setChargingDraft] = useState(0)
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
  const [showReminder, setShowReminder] = useState(false)
  const [reminderIntervalMs, setReminderIntervalMs] = useState(
    Number(localStorage.getItem("bucksseat_reminder_interval_ms")) || 60000
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState("00:00")
  const lastAlertedRef = useRef(null)
  const [showBaristaLogin, setShowBaristaLogin] = useState(true)
  const [baristaStep, setBaristaStep] = useState("browse")
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const stored = localStorage.getItem("bucksseat_barista_branch")
    return stored || ""
  })
  const [branchNameInput, setBranchNameInput] = useState("")
  const [branchLocationInput, setBranchLocationInput] = useState("")
  const [branchSeatsInput, setBranchSeatsInput] = useState(20)
  const [branchChargingInput, setBranchChargingInput] = useState(10)
  const [branchOpenTimesInput, setBranchOpenTimesInput] = useState("")
  const [baristaLoginStatus, setBaristaLoginStatus] = useState("")
  const [baristaSearchTerm, setBaristaSearchTerm] = useState("")

  const lastUpdatedLabel = useMemo(
    () => formatTimeAgo(lastUpdated),
    [lastUpdated]
  )

  const reminderFrequencyLabel = useMemo(() => {
    if (reminderIntervalMs <= 30000) return "every 30 seconds"
    if (reminderIntervalMs <= 60000) return "every 1 minute"
    if (reminderIntervalMs <= 120000) return "every 2 minutes"
    return "every 5 minutes"
  }, [reminderIntervalMs])

  const filteredBranches = useMemo(() => {
    const term = baristaSearchTerm.trim().toLowerCase()
    if (!term) return locations
    return locations.filter((loc) => loc.toLowerCase().includes(term))
  }, [locations, baristaSearchTerm])

  useEffect(() => {
    const updateCountdown = () => {
      if (!lastUpdated || reminderIntervalMs <= 0) {
        setNextUpdateCountdown("00:00")
        return
      }

      const target = lastUpdated.getTime() + reminderIntervalMs
      const remaining = target - Date.now()

      if (remaining <= 0) {
        setNextUpdateCountdown("00:00")

        if (lastAlertedRef.current !== lastUpdated.getTime()) {
          lastAlertedRef.current = lastUpdated.getTime()
          setShowReminder(true)
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate([200, 100, 200])
            } catch {}
          }
          playAlarm()
          showNotify()
        }

        return
      }

      const totalSeconds = Math.floor(remaining / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      const mm = String(minutes).padStart(2, "0")
      const ss = String(seconds).padStart(2, "0")
      setNextUpdateCountdown(`${mm}:${ss}`)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [lastUpdated, reminderIntervalMs])

  useEffect(() => {
    let ignore = false

    const loadLatest = async () => {
      const { data, error } = await getLatest(location)

      if (!ignore) {
        if (error) {
          setMessage("Unable to load latest report.")
          return
        }
        if (data) {
          setStatus(data.status)
          setLastUpdated(new Date(data.created_at))
          if (typeof data.chargingPorts === "number") {
            setChargingPorts(data.chargingPorts)
            setChargingDraft(data.chargingPorts)
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
          setChargingDraft(data.chargingPorts)
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

  useEffect(() => {
    const updateCooldown = () => {
      const last = Number(localStorage.getItem("lastSubmissionTime") || 0)
      const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - last))
      setCooldownMs(remaining)
    }

    updateCooldown()
    const timer = setInterval(updateCooldown, 10000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        Notification.requestPermission()
      } catch {}
    }
  }, [])

  const handleSubmit = async (nextStatus) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setMessage("Sending update…")

    const res = await submitReport(nextStatus, chargingDraft, location)

    if (res && res.error) {
      console.error("Submission failed with error:", res.error)
      setMessage(`Submission failed: ${res.error.message || "Please try again."}`)
      setIsSubmitting(false)
      return
    }

    localStorage.setItem("lastSubmissionTime", String(Date.now()))

    const targetStatus = nextStatus
    const targetPorts = chargingDraft
    const deadline = Date.now() + 15000
    let confirmed = false

    while (Date.now() < deadline) {
      try {
        const { data } = await getLatest(location)
        if (
          data &&
          data.status === targetStatus &&
          (typeof data.chargingPorts !== "number" ||
            data.chargingPorts === targetPorts)
        ) {
          setStatus(data.status)
          setLastUpdated(new Date(data.created_at))
          if (typeof data.chargingPorts === "number") {
            setChargingPorts(data.chargingPorts)
            setChargingDraft(data.chargingPorts)
          }
          setMessage("Update saved and visible to customers.")
          confirmed = true
          break
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    if (!confirmed) {
      setStatus(nextStatus)
      setLastUpdated(new Date())
      setChargingPorts(chargingDraft)
      setMessage("Update sent. Customers should see it shortly.")
    }

    setIsSubmitting(false)
  }

  const handleContinueAsExistingBranch = () => {
    const branch = selectedBranch || location
    if (!branch) {
      setBaristaLoginStatus("Please select a branch.")
      return
    }
    setLocation(branch)
    localStorage.setItem("bucksseat_location", branch)
    localStorage.setItem("bucksseat_barista_branch", branch)
    setBaristaLoginStatus("")
    setShowBaristaLogin(false)
  }

  const handleCreateBranchFromLogin = (event) => {
    event.preventDefault()
    const name = branchNameInput.trim()
    const loc = branchLocationInput.trim()
    if (!name || !loc) {
      setBaristaLoginStatus("Please enter branch name and location.")
      return
    }
    const seats = Math.max(1, Math.min(200, Number(branchSeatsInput) || 0))
    const charging = Math.max(0, Math.min(50, Number(branchChargingInput) || 0))
    setBaristaLoginStatus("Setting up this branch…")
    registerFranchise({
      name,
      location: loc,
      seats,
      chargingStations: charging,
      openTimes: branchOpenTimesInput.trim(),
    }).then((res) => {
      if (res && res.error) {
        setBaristaLoginStatus("Could not save branch. Please try again.")
        return
      }
      const label = loc
      const exists = locations.includes(label)
      const nextLocations = exists ? locations : [...locations, label]
      setLocations(nextLocations)
      localStorage.setItem("bucksseat_locations", JSON.stringify(nextLocations))
      setLocation(label)
      localStorage.setItem("bucksseat_location", label)
      localStorage.setItem("bucksseat_barista_branch", label)
      setBaristaLoginStatus("Branch ready. Loading Seat Checker…")
      setShowBaristaLogin(false)
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
            Update what you see so customers have an accurate view.
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
          nextUpdateCountdown={nextUpdateCountdown}
        />

        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-[#cbe7dd]">
          <h2 className="font-display text-lg font-semibold text-[#1e3932]">
            Submit a quick update
          </h2>
          <p className="mt-2 text-sm text-[#4b5563]">
            Tap the option that best matches what you see right now.
          </p>
          {isSubmitting ? (
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#1e3932]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1e3932]/30 border-t-[#1e3932]" />
              <span>Waiting for customer view to update…</span>
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Reminder frequency
              </p>
              <p className="mt-1 text-xs text-[#6b7280]">
                Choose how often to get a popup and alarm.
              </p>
            </div>
            <select
              value={reminderIntervalMs}
              onChange={(e) => {
                const value = Number(e.target.value)
                setReminderIntervalMs(value)
                localStorage.setItem("bucksseat_reminder_interval_ms", String(value))
              }}
              className="rounded-xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm font-semibold text-[#111827] shadow-sm"
            >
              <option value={30000}>Every 30 seconds</option>
              <option value={60000}>Every 1 minute</option>
              <option value={120000}>Every 2 minutes</option>
              <option value={300000}>Every 5 minutes</option>
            </select>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Charging ports free
              </p>
              <p className="mt-1 text-xs text-[#6b7280]">
                Enter how many power outlets are currently available.
              </p>
            </div>
            <input
              type="number"
              min={0}
              max={50}
              value={chargingDraft}
              onChange={(event) => {
                const value = Number(event.target.value.replace(/\D/g, "")) || 0
                const clamped = Math.max(0, Math.min(50, value))
                setChargingDraft(clamped)
              }}
              className="w-20 rounded-xl border border-[#cbe7dd] bg-white px-3 py-2 text-center text-sm font-semibold text-[#111827] shadow-sm"
            />
          </div>
          <SubmitButtons onSubmit={handleSubmit} disabled={isSubmitting} />
          {message ? (
            <p className="mt-4 text-sm font-semibold text-[#374151]">
              {message}
            </p>
          ) : null}
        </section>

        <footer className="text-center text-xs text-slate-400">
          Made for Starbucks baristas
        </footer>
      </main>
      {showBaristaLogin ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft ring-1 ring-[#cbe7dd]">
            <h2 className="font-display text-xl font-semibold text-[#1e3932]">
              {baristaStep === "browse"
                ? "Find your Starbucks"
                : "Set up your Starbucks"}
            </h2>
            <p className="mt-1 text-sm text-[#4b5563]">
              {baristaStep === "browse"
                ? "Browse for your store before deciding if you need to sign it up."
                : "Add details for this Starbucks so you can keep seats updated."}
            </p>
            <div className="mt-4 space-y-4">
              {baristaStep === "browse" ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                      Choose your Starbucks
                    </p>
                    <input
                      type="text"
                      value={baristaSearchTerm}
                      onChange={(event) =>
                        setBaristaSearchTerm(event.target.value)
                      }
                      placeholder="Search by store name or area"
                      className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs text-[#111827] shadow-sm"
                    />
                    <select
                      value={selectedBranch || location}
                      onChange={(event) => setSelectedBranch(event.target.value)}
                      className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm font-semibold text-[#111827] shadow-sm"
                    >
                      {filteredBranches.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    {filteredBranches.length === 0 ? (
                      <p className="text-[11px] text-[#9ca3af]">
                        No Starbucks found. Try another search or sign yours up below.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-[#00754a] px-4 py-2 text-sm font-semibold text-emerald-50 shadow-soft hover:bg-[#006241]"
                      onClick={handleContinueAsExistingBranch}
                    >
                      Continue as barista for this Starbucks
                    </button>
                  </div>
                  <button
                    type="button"
                    className="w-full text-center text-xs font-semibold text-[#00754a] underline"
                    onClick={() => {
                      setBaristaStep("signup")
                      setBaristaLoginStatus("")
                    }}
                  >
                    My Starbucks is not listed
                  </button>
                </>
              ) : (
                <>
                  <form
                    className="space-y-3"
                    onSubmit={handleCreateBranchFromLogin}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                      Sign up your Starbucks
                    </p>
                    <input
                      type="text"
                      value={branchNameInput}
                      onChange={(event) =>
                        setBranchNameInput(event.target.value)
                      }
                      placeholder="Branch name (e.g. Main Street Starbucks)"
                      className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
                    />
                    <input
                      type="text"
                      value={branchLocationInput}
                      onChange={(event) =>
                        setBranchLocationInput(event.target.value)
                      }
                      placeholder="Location / area"
                      className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
                    />
                    <input
                      type="text"
                      value={branchOpenTimesInput}
                      onChange={(event) =>
                        setBranchOpenTimesInput(event.target.value)
                      }
                      placeholder="Open times (e.g. Mon–Fri 7am–8pm)"
                      className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={branchSeatsInput}
                        onChange={(event) => {
                          const value =
                            Number(event.target.value.replace(/\D/g, "")) || 0
                          const clamped = Math.max(1, Math.min(200, value))
                          setBranchSeatsInput(clamped)
                        }}
                        placeholder="Total seats"
                        className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={branchChargingInput}
                        onChange={(event) => {
                          const value =
                            Number(event.target.value.replace(/\D/g, "")) || 0
                          const clamped = Math.max(0, Math.min(50, value))
                          setBranchChargingInput(clamped)
                        }}
                        placeholder="Charging stations"
                        className="w-full rounded-2xl border border-[#cbe7dd] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#00754a] shadow-soft ring-1 ring-[#cbe7dd] hover:bg-[#f5f0e8]"
                    >
                      Create branch and continue
                    </button>
                  </form>
                  <button
                    type="button"
                    className="w-full text-center text-xs font-semibold text-[#6b7280] underline"
                    onClick={() => {
                      setBaristaStep("browse")
                      setBaristaLoginStatus("")
                    }}
                  >
                    Back to search
                  </button>
                </>
              )}
              {baristaLoginStatus ? (
                <p className="text-xs font-semibold text-[#00754a]">
                  {baristaLoginStatus}
                </p>
              ) : null}
              <button
                type="button"
                className="mt-1 w-full text-center text-xs font-semibold text-[#6b7280] underline"
                onClick={() => {
                  setShowBaristaLogin(false)
                  setBaristaLoginStatus("")
                  setBaristaStep("browse")
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showReminder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Reminder
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">
              Please update seat availability
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Tap the option that best matches what you see right now.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setShowReminder(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
