// DEBUG: minimal db.js — returns different status codes to trace crash
function prepare(queryStr) {
  return {
    async get() { return null },
    async all() { return [] },
    async run() { return { lastID: 1, changes: 1 } }
  }
}

export default { prepare }
