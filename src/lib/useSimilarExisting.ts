import { useEffect, useState } from 'react'
import type { Candidate } from './similar'
import { findExistingMatch } from './sweepDuplicates'

/** What's already in the system that looks like this title, checked a moment after you stop typing. */
export function useSimilarExisting(title: string, excludeId?: string): Candidate | undefined {
  const [match, setMatch] = useState<Candidate | undefined>()

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      findExistingMatch(title, excludeId)
        .then((m) => {
          if (!cancelled) setMatch(m)
        })
        .catch(() => {})
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [title, excludeId])

  return title.trim() ? match : undefined
}
