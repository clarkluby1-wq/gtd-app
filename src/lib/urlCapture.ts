/**
 * Lets something outside the app — an iOS Shortcut triggered by "Hey Siri", a bookmarklet, another script —
 * drop something straight into the Inbox by opening `?capture=<text>`. No server involved: the app reads the
 * text once on load and captures it itself, the same as typing into the capture bar.
 */

/**
 * Reads the `capture` query param from `location`, if there is one, and strips it from the address bar
 * immediately — before the caller does anything async — so a page reload (or React StrictMode's double
 * effect in dev) can't capture the same text twice. Returns the decoded, trimmed text, or undefined if
 * there wasn't a usable one.
 */
export function takeCaptureParam(location: Location = window.location): string | undefined {
  const params = new URLSearchParams(location.search)
  const raw = params.get('capture')
  if (raw === null) return undefined

  params.delete('capture')
  const newSearch = params.toString()
  const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '') + location.hash
  window.history.replaceState({}, '', newUrl)

  const trimmed = raw.trim()
  return trimmed || undefined
}
