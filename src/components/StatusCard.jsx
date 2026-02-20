const STATUS_MAP = {
  empty: {
    label: "Empty",
    detail: "Many seats available",
    color: "bg-[#00754a]",
    text: "text-emerald-50",
    ring: "ring-[#cbe7dd]",
  },
  few: {
    label: "Few Seats",
    detail: "Some seats available",
    color: "bg-[#1e3932]",
    text: "text-emerald-50",
    ring: "ring-[#cbe7dd]",
  },
  busy: {
    label: "Busy",
    detail: "Almost full",
    color: "bg-[#cba258]",
    text: "text-emerald-50",
    ring: "ring-[#f3e6c8]",
  },
  full: {
    label: "Full",
    detail: "No seats available",
    color: "bg-[#8e3b46]",
    text: "text-rose-50",
    ring: "ring-[#f3c9d1]",
  },
}

export default function StatusCard({
  status,
  lastUpdatedLabel,
  isAnimating,
  nextUpdateCountdown,
}) {
  const payload = STATUS_MAP[status] || STATUS_MAP.empty

  return (
    <section
      className={`rounded-3xl p-6 shadow-soft ring-1 ${payload.ring} ${payload.color} animate-pulse transition-opacity duration-500 ${
        isAnimating ? "opacity-70" : "opacity-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-50/90">
            Current status
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-emerald-50">
            {payload.label}
          </h2>
          <p className={`mt-2 text-sm font-semibold ${payload.text}`}>{payload.detail}</p>
        </div>
        <div className="h-16 w-16 rounded-2xl bg-emerald-50/10 shadow-inner" aria-hidden="true" />
      </div>
      <p className="mt-6 text-sm text-emerald-50/90">{lastUpdatedLabel}</p>
      <p className="mt-1 text-xs text-emerald-50/80">
        Next update in: {nextUpdateCountdown}
      </p>
    </section>
  )
}
