const BUTTONS = [
  {
    status: "empty",
    label: "I see many empty seats",
    color: "bg-[#00754a] hover:bg-[#006241]",
  },
  {
    status: "few",
    label: "I see a few seats",
    color: "bg-[#1e3932] hover:bg-[#12221d]",
  },
  {
    status: "busy",
    label: "It is busy",
    color: "bg-[#cba258] hover:bg-[#b38a3f]",
  },
  {
    status: "full",
    label: "It is full",
    color: "bg-[#8e3b46] hover:bg-[#762b36]",
  },
]

export default function SubmitButtons({ onSubmit, disabled }) {
  return (
    <div className="mt-6 grid gap-3">
      {BUTTONS.map((button) => (
        <button
          key={button.status}
          className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-emerald-50 shadow-sm transition-transform duration-200 ${button.color} ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5"
          }`}
          onClick={() => onSubmit(button.status)}
          disabled={disabled}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}
