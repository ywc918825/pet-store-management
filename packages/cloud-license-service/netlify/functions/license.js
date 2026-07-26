import serverless from 'serverless-http'
import app from '../../src/app.js'

// serverless-http wraps the Express app as a Netlify Function. The redirect in
// netlify.toml forwards "/api/*" to "/.netlify/functions/license/api/:splat",
// so we strip the function prefix here to restore the original "/api/..." path
// that the Express routers (licenseRoutes / adminRoutes) expect.
const base = '/.netlify/functions/license'

export const handler = serverless(app, {
  request(request, event) {
    if (event.path && event.path.startsWith(base)) {
      event.path = event.path.slice(base.length) || '/'
    }
  }
})
