// Unified API response helper
export function success(data = null, message = 'success') {
  return { code: 0, message, data }
}

export function error(message = 'error', code = 500, data = null) {
  return { code, message, data }
}

export function paginate(list, page, pageSize) {
  const total = list.length
  const start = (page - 1) * pageSize
  const data = list.slice(start, start + pageSize)
  return { list: data, total, page, pageSize }
}
