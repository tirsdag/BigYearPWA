export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    let refreshing = false

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        function notifyUpdateAvailable() {
          try {
            window.dispatchEvent(new CustomEvent('pwa:updateAvailable', { detail: { registration } }))
          } catch {
            // Ignore
          }
        }

        // If an update is already waiting (e.g., user opened a second tab), notify.
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable()
        }

        // Best-effort update checks.
        registration.update().catch(() => {})
        const intervalId = setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)

        window.addEventListener(
          'online',
          () => {
            registration.update().catch(() => {})
          },
          { passive: true },
        )

        document.addEventListener(
          'visibilitychange',
          () => {
            if (document.visibilityState === 'visible') registration.update().catch(() => {})
          },
          { passive: true },
        )

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdateAvailable()
            }
          })
        })

        // Avoid leaking the interval if the page is being unloaded.
        window.addEventListener(
          'beforeunload',
          () => {
            clearInterval(intervalId)
          },
          { passive: true },
        )
      })
      .catch(() => {
        // Keep silent; offline-first is best-effort.
      })
  })
}
