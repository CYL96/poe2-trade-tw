(() => {
  const cacheKeys = {
    items: 'lscache-trade2items',
    stats: 'lscache-trade2stats',
    static: 'lscache-trade2data',
    filters: 'lscache-trade2filters',
  }
  const originalFetch = window.fetch
  window.fetch = function (input, init) {
    const url = new URL(input instanceof Request ? input.url : input, location.href)
    const method = init?.method || (input instanceof Request ? input.method : 'GET')
    const match = url.pathname.match(/^\/api\/trade2\/data\/(items|stats|static|filters)$/)
    if (url.origin === location.origin && method.toUpperCase() === 'GET' && match) {
      try {
        const cached = localStorage.getItem(cacheKeys[match[1]])
        if (cached) {
          const result = JSON.parse(cached)
          if (Array.isArray(result)) {
            const signal = init?.signal || (input instanceof Request ? input.signal : null)
            if (signal?.aborted) return Promise.reject(signal.reason)
            return Promise.resolve(new Response(JSON.stringify({ result }), {
              headers: { 'Content-Type': 'application/json' },
            }))
          }
        }
      } catch {
        // Unavailable or corrupt extension data must not prevent native trade loading.
      }
    }
    return Reflect.apply(originalFetch, this, arguments)
  }
})()
