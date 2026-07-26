import dayjs from 'dayjs'

export function formatDate(date, fmt = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return ''
  return dayjs(date).format(fmt)
}

export function formatMoney(amount) {
  return Number(amount || 0).toFixed(2)
}

export function safeJsonParse(str, fallback = []) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return fallback
  }
}
