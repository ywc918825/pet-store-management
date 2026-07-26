import dotenv from 'dotenv'
import app from './app.js'

dotenv.config()

const PORT = process.env.PORT || 3002

// Local development only. On Netlify this file is never executed — the
// serverless function (netlify/functions/license.js) imports app.js directly.
if (process.env.NODE_ENV !== 'lambda') {
  app.listen(PORT, () => {
    console.log(`Cloud license service running on http://localhost:${PORT}`)
  })
}
