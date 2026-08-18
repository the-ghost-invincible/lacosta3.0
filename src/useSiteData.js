import { useSyncExternalStore } from 'react'
import * as fallback from './data'

const POLL_MS = 5000

let cache = fallback
let loading = true
let started = false
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return cache
}

async function load() {
  try {
    const res = await fetch('/api/data')
    const json = await res.json()
    cache = { ...fallback, ...json }
  } catch {
    // keep last known data when offline
  }
  loading = false
  emit()
}

// Single poller shared by every component: keeps the storefront
// in sync with admin changes without manual page refreshes.
function ensurePolling() {
  if (started) return
  started = true
  load()
  setInterval(load, POLL_MS)
  window.addEventListener('focus', load)
}

export function useSiteData() {
  ensurePolling()
  return { ...useSyncExternalStore(subscribe, getSnapshot), loading }
}
