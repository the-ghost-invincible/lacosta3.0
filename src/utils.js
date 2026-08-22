export const parsePrice = (price) => Number(String(price ?? '').replace(/[^\d]/g, '')) || 0

export const normalize = (value) => (value ?? '').trim().toLowerCase()
