import serverless from 'serverless-http'
import appModule from '../../src/app.js'

// Netlify's nft bundler may wrap ESM default exports as { default: X }.
const app = appModule.default || appModule

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
