const base = import.meta.env.VITE_SHEETS_API_BASE || ""
const isProd = import.meta.env.PROD === true

const STORAGE_KEY = "bucksseat_latest_report_by_location"
const FRANCHISES_KEY = "bucksseat_franchises"

function getLatestFromLocal(location) {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { data: null, error: null }
  try {
    const obj = JSON.parse(raw)
    const entry = obj && location ? obj[location] : null
    if (!entry) return { data: null, error: null }
    return { data: entry, error: null }
  } catch {
    return { data: null, error: new Error("parse") }
  }
}

async function getLatestFromSheets(location) {
  if (!base) {
    return { data: null, error: new Error("missing-base-url") }
  }
  try {
    const url = location
      ? `${base}?route=latest&location=${encodeURIComponent(location)}&t=${Date.now()}`
      : `${base}?route=latest&t=${Date.now()}`
    const res = await fetch(url, { 
      headers: { Accept: "application/json" },
      cache: "no-store" 
    })
    if (!res.ok) {
      return { data: null, error: new Error("network-error") }
    }
    const json = await res.json()
    if (!json) {
      return { data: null, error: new Error("invalid-response") }
    }
    const status =
      json.status ||
      json.seatStatus ||
      json.availability ||
      json.state ||
      "unknown"
    const created_at =
      json.created_at ||
      json.createdAt ||
      json.timestamp ||
      new Date().toISOString()
    const chargingPorts =
      typeof json.chargingPorts === "number"
        ? json.chargingPorts
        : typeof json.charging_ports === "number"
        ? json.charging_ports
        : undefined
    const locationLabel = json.location || location || "Unknown store"
    return {
      data: {
        status,
        created_at,
        chargingPorts,
        location: locationLabel,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

async function postToSheets(route, payload) {
  const res = await fetch(`${base}?route=${encodeURIComponent(route)}`, {
    method: "POST",
    headers: {
      // Apps Script accepts the raw body, and this content type avoids CORS preflight.
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  })

  let json = null
  try {
    json = await res.json()
  } catch {}

  return { res, json }
}

function submitToLocal(status, chargingPorts, location) {
  const created_at = new Date().toISOString()
  const raw = localStorage.getItem(STORAGE_KEY)
  const current = raw ? JSON.parse(raw) : {}
  const key = location || "Default store"
  current[key] = { status, chargingPorts, created_at, location: key }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  return { error: null, created_at, chargingPorts, location: key }
}

async function submitToSheets(status, chargingPorts, location) {
  if (!base) {
    return {
      error: new Error("missing-base-url"),
      created_at: null,
      chargingPorts,
      location,
    }
  }
  try {
    const { res, json } = await postToSheets("report", {
      status,
      chargingPorts,
      location,
    })
    if (!res.ok || json?.error) {
      return {
        error: new Error(json?.error || "submit-failed"),
        created_at: null,
        chargingPorts,
        location,
      }
    }
    const created_at = new Date().toISOString()
    return { error: null, created_at, chargingPorts, location }
  } catch (error) {
    return { error, created_at: null, chargingPorts, location }
  }
}

function registerFranchiseToLocal(payload) {
  const raw = localStorage.getItem(FRANCHISES_KEY)
  const current = raw ? JSON.parse(raw) : []
  const created_at = new Date().toISOString()
  const entry = { ...payload, created_at }
  current.push(entry)
  localStorage.setItem(FRANCHISES_KEY, JSON.stringify(current))
  return { error: null }
}

async function registerFranchiseToSheets(payload) {
  if (!base) {
    return { error: new Error("missing-base-url") }
  }
  try {
    const { res, json } = await postToSheets("register-franchise", payload)
    if (!res.ok || json?.error) {
      return { error: new Error(json?.error || "register-failed") }
    }
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function getLatest(location) {
  if (base) {
    return getLatestFromSheets(location)
  }
  if (isProd) {
    return { data: null, error: new Error("missing-base-url") }
  }
  return getLatestFromLocal(location)
}

export async function submitReport(status, chargingPorts, location) {
  if (base) {
    return submitToSheets(status, chargingPorts, location)
  }
  if (isProd) {
    return {
      error: new Error("missing-base-url"),
      created_at: null,
      chargingPorts,
      location,
    }
  }
  return submitToLocal(status, chargingPorts, location)
}

export async function registerFranchise(payload) {
  if (base) {
    return registerFranchiseToSheets(payload)
  }
  return registerFranchiseToLocal(payload)
}

function getLocalTableCodes() {
  const raw = localStorage.getItem("bucksseat_valid_table_codes_by_location")
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  const seed = {
    "Main Street Starbucks": ["A1", "A2", "B1", "B2"],
    "Mall Starbucks": ["C1", "C2", "D1", "D2"],
  }
  localStorage.setItem(
    "bucksseat_valid_table_codes_by_location",
    JSON.stringify(seed)
  )
  return seed
}

export async function validateTableCode(code, location) {
  if (!code) return { valid: false }
  if (base) {
    try {
      const url = location
        ? `${base}?route=validate-table&code=${encodeURIComponent(
            code
          )}&location=${encodeURIComponent(location)}&t=${Date.now()}`
        : `${base}?route=validate-table&code=${encodeURIComponent(code)}&t=${Date.now()}`
      const res = await fetch(url, { 
        headers: { Accept: "application/json" },
        cache: "no-store" 
      })
      if (res.ok) {
        const json = await res.json()
        return { valid: !!json?.valid }
      }
    } catch {}
  }
  const map = getLocalTableCodes()
  const list = map && location ? map[location] : null
  if (Array.isArray(list)) {
    return { valid: list.includes(String(code).trim()) }
  }
  return { valid: false }
}

export async function placeOrder(tableCode, orderText, location) {
  if (base) {
    try {
      const { res, json } = await postToSheets("order", {
        tableCode,
        orderText,
        location,
      })
      if (res.ok && !json?.error) return { error: null }
    } catch {}
  }
  const raw = localStorage.getItem("bucksseat_orders_by_location")
  const current = raw ? JSON.parse(raw) : {}
  const key = location || "Default store"
  const list = Array.isArray(current[key]) ? current[key] : []
  list.push({
    tableCode,
    orderText,
    created_at: new Date().toISOString(),
  })
  current[key] = list
  localStorage.setItem("bucksseat_orders_by_location", JSON.stringify(current))
  return { error: null }
}
