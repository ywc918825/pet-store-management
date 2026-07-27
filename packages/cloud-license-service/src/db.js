// DEBUG: minimal db.js with ZERO imports to test if any import causes nft crash
function prepare(queryStr) {
  console.log('[db-debug] prepare called:', queryStr?.substring(0, 60))
  return {
    async get() { return null },
    async all() { return [] },
    async run() { return { lastID: 1, changes: 1 } }
  }
}

export default { prepare }
