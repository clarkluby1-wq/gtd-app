import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { startOfToday } from '../lib/date'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import type { EnergyLevel } from '../db/types'

type Step = 'context' | 'time' | 'energy' | 'results'

const STEPS: Step[] = ['context', 'time', 'energy', 'results']

const TIME_OPTIONS: { label: string; value: number }[] = [
  { label: '≤ 15 min', value: 15 },
  { label: '≤ 30 min', value: 30 },
  { label: '≤ 1 hour', value: 60 },
]

const ENERGY_OPTIONS: { label: string; value: EnergyLevel }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
]

export function WhatNowView({
  onOpenProject,
  onViewNextActions,
}: {
  onOpenProject: (projectId: string) => void
  onViewNextActions: () => void
}) {
  const [step, setStep] = useState<Step>('context')
  const [contextId, setContextId] = useState<string | 'any'>('any')
  const [maxTime, setMaxTime] = useState<number | 'any'>('any')
  const [energy, setEnergy] = useState<EnergyLevel | 'any'>('any')

  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const actions = useLiveQuery(() => db.actions.where('status').equals('next').sortBy('order'))
  const somedayProjectIds = useSomedayProjectIds()
  const today = startOfToday()
  const pinnedTodayCount = (actions ?? []).filter((a) => a.bigThreeDate === today).length

  const stepIndex = STEPS.indexOf(step)

  const goNext = () => setStep(STEPS[stepIndex + 1] ?? 'results')
  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
  }
  const startOver = () => {
    setContextId('any')
    setMaxTime('any')
    setEnergy('any')
    setStep('context')
  }

  // The first three criteria narrow what's possible; priority — the fourth — is never
  // computed here. It's the judgment you apply to whatever's left, so this only filters
  // and surfaces the signals (project, staleness, Big Three) that inform that call.
  const results = useMemo(() => {
    if (!actions) return []
    return actions
      .filter((a) => {
        if (a.projectId && somedayProjectIds.has(a.projectId)) return false
        if (contextId !== 'any' && a.contextId !== contextId) return false
        if (energy !== 'any' && a.energy !== energy) return false
        if (maxTime !== 'any' && (a.timeEstimateMin == null || a.timeEstimateMin > maxTime)) return false
        return true
      })
      .sort((a, b) => Number(b.bigThreeDate === today) - Number(a.bigThreeDate === today))
  }, [actions, contextId, energy, maxTime, somedayProjectIds, today])

  const contextLabel = contextId === 'any' ? 'Anywhere' : (contexts?.find((c) => c.id === contextId)?.name ?? '…')
  const timeLabel = maxTime === 'any' ? 'Any time' : `≤ ${maxTime}m`
  const energyLabel = energy === 'any' ? 'Any energy' : energy

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">What Now?</h1>
      <p className="mb-4 text-sm text-neutral-500">
        The four-criteria model, one question at a time: context, time, energy — then you decide the priority.
      </p>

      <div className="mb-6 flex gap-1.5 text-xs">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= stepIndex ? 'text-emerald-400' : 'text-neutral-600'}>
            {s === 'context' ? 'Context' : s === 'time' ? 'Time' : s === 'energy' ? 'Energy' : 'Results'}
            {i < STEPS.length - 1 && <span className="mx-1.5 text-neutral-700">→</span>}
          </span>
        ))}
      </div>

      {step === 'context' && (
        <StepScreen question="Where are you right now?">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {contexts?.map((c) => (
              <OptionButton
                key={c.id}
                onClick={() => {
                  setContextId(c.id)
                  goNext()
                }}
              >
                {c.name}
              </OptionButton>
            ))}
          </div>
          <SkipButton
            onClick={() => {
              setContextId('any')
              goNext()
            }}
          />
        </StepScreen>
      )}

      {step === 'time' && (
        <StepScreen question="How much time do you have?">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {TIME_OPTIONS.map((t) => (
              <OptionButton
                key={t.value}
                onClick={() => {
                  setMaxTime(t.value)
                  goNext()
                }}
              >
                {t.label}
              </OptionButton>
            ))}
          </div>
          <SkipButton
            onClick={() => {
              setMaxTime('any')
              goNext()
            }}
          />
        </StepScreen>
      )}

      {step === 'energy' && (
        <StepScreen question="What's your energy like?">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {ENERGY_OPTIONS.map((e) => (
              <OptionButton
                key={e.value}
                onClick={() => {
                  setEnergy(e.value)
                  goNext()
                }}
              >
                {e.label}
              </OptionButton>
            ))}
          </div>
          <SkipButton
            onClick={() => {
              setEnergy('any')
              goNext()
            }}
          />
        </StepScreen>
      )}

      {step === 'results' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-neutral-100">Here's what fits — you decide the priority</h2>
            <button onClick={startOver} className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300">
              Start over
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <RecapPill onClick={() => setStep('context')}>📍 {contextLabel}</RecapPill>
            <RecapPill onClick={() => setStep('time')}>⏱ {timeLabel}</RecapPill>
            <RecapPill onClick={() => setStep('energy')}>⚡ {energyLabel}</RecapPill>
          </div>

          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
              Nothing fits that combination.
              <div className="mt-3 flex justify-center gap-3">
                <button onClick={startOver} className="text-emerald-400 hover:text-emerald-300">
                  Start over
                </button>
                <span className="text-neutral-700">·</span>
                <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
                  Browse all Next Actions
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-900">
              {results.map((a) => (
                <TaskRow
                  key={a.id}
                  action={a}
                  showProject
                  showBigThreePin
                  pinnedTodayCount={pinnedTodayCount}
                  onOpenProject={onOpenProject}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {step !== 'context' && (
        <button onClick={goBack} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">
          ← Back
        </button>
      )}
    </div>
  )
}

function StepScreen({ question, children }: { question: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-neutral-100">{question}</h2>
      {children}
    </div>
  )
}

function OptionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-neutral-800 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-emerald-600 hover:text-white"
    >
      {children}
    </button>
  )
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
    >
      Doesn't matter →
    </button>
  )
}

function RecapPill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-neutral-800 px-3 py-1 text-neutral-300 hover:bg-neutral-700"
      title="Change this"
    >
      {children}
    </button>
  )
}
