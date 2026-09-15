import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { db } from '../db/db'
import {
  clarifyAsNextAction,
  clarifyAsProject,
  clarifyAsReference,
  clarifyAsScheduled,
  clarifyAsWaitingFor,
  doItNow,
  sendToSomeday,
  trashItem,
} from '../db/operations'
import type { Action, EnergyLevel } from '../db/types'
import { parseLocalDate } from '../lib/date'

type Step =
  | 'actionable'
  | 'notActionable'
  | 'twoMinute'
  | 'delegate'
  | 'singleOrProject'
  | 'dateSpecific'
  | 'assignNextAction'
  | 'defineProject'

const STEP_QUESTION: Record<Step, string> = {
  actionable: 'Is it actionable — does it require you to do something?',
  notActionable: "It's not actionable. What should happen to it?",
  twoMinute: 'Will doing it take less than two minutes?',
  delegate: 'Are you the right person to do this?',
  singleOrProject: 'Can it be done in one step, or does it need more than one action?',
  dateSpecific: 'Does this need to happen on a specific day, or is it just the next time you get to it?',
  assignNextAction: 'What context and details for this next action?',
  defineProject: 'Define the project.',
}

export function ClarifyModal({ item, onClose }: { item: Action; onClose: () => void }) {
  const [step, setStep] = useState<Step>('actionable')
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray())

  const [contextId, setContextId] = useState<string | undefined>()
  const [energy, setEnergy] = useState<EnergyLevel | undefined>()
  const [timeEstimateMin, setTimeEstimateMin] = useState<number | undefined>()
  const [dueDate, setDueDate] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [projectTitle, setProjectTitle] = useState(item.title)
  const [outcome, setOutcome] = useState('')
  const [areaOfFocusId, setAreaOfFocusId] = useState<string | undefined>()
  const [goalId, setGoalId] = useState<string | undefined>()
  const [firstActionTitle, setFirstActionTitle] = useState('')

  const finish = async (action: () => Promise<unknown>) => {
    await action()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-neutral-100 shadow-xl">
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Clarify</div>
        <div className="mb-4 text-lg font-medium">{item.title}</div>
        <div className="mb-4 text-sm text-neutral-400">{STEP_QUESTION[step]}</div>

        {step === 'actionable' && (
          <div className="flex gap-2">
            <Btn onClick={() => setStep('notActionable')}>No</Btn>
            <Btn primary onClick={() => setStep('twoMinute')}>
              Yes
            </Btn>
          </div>
        )}

        {step === 'notActionable' && (
          <div className="flex flex-col gap-2">
            <Btn onClick={() => finish(() => trashItem(item.id))}>🗑 Trash it</Btn>
            <Btn onClick={() => finish(() => sendToSomeday(item.id))}>🌙 Someday / Maybe</Btn>
            <Btn onClick={() => finish(() => clarifyAsReference(item.id, { title: item.title }))}>
              📎 File as Reference
            </Btn>
            <div className="my-1 text-center text-xs text-neutral-600">
              — or already waiting on someone for this? —
            </div>
            <input
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value)}
              placeholder="Who is it waiting on?"
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <Btn
              disabled={!waitingOn.trim()}
              onClick={() => finish(() => clarifyAsWaitingFor(item.id, waitingOn.trim()))}
            >
              ⏳ Confirm — Waiting For {waitingOn.trim() || '…'}
            </Btn>
          </div>
        )}

        {step === 'twoMinute' && (
          <div className="flex gap-2">
            <Btn primary onClick={() => finish(() => doItNow(item.id))}>
              Yes — do it now
            </Btn>
            <Btn onClick={() => setStep('delegate')}>No</Btn>
          </div>
        )}

        {step === 'delegate' && (
          <div className="flex flex-col gap-3">
            <Btn onClick={() => setStep('singleOrProject')}>Yes, I'll do it myself</Btn>
            <div className="my-1 text-center text-xs text-neutral-600">— or delegate it —</div>
            <input
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value)}
              placeholder="Who is it delegated to?"
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <Btn
              primary
              disabled={!waitingOn.trim()}
              onClick={() => finish(() => clarifyAsWaitingFor(item.id, waitingOn.trim()))}
            >
              Confirm — Waiting For {waitingOn.trim() || '…'}
            </Btn>
          </div>
        )}

        {step === 'singleOrProject' && (
          <div className="flex gap-2">
            <Btn primary onClick={() => setStep('dateSpecific')}>
              One step
            </Btn>
            <Btn onClick={() => setStep('defineProject')}>Multiple steps (project)</Btn>
          </div>
        )}

        {step === 'dateSpecific' && (
          <div className="flex flex-col gap-3">
            <Btn onClick={() => setStep('assignNextAction')}>Next time I get to it</Btn>
            <div className="my-1 text-center text-xs text-neutral-600">— or schedule it —</div>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <Btn
              primary
              disabled={!scheduledDate}
              onClick={() =>
                finish(() => clarifyAsScheduled(item.id, parseLocalDate(scheduledDate)))
              }
            >
              Confirm — schedule for {scheduledDate || '…'}
            </Btn>
          </div>
        )}

        {step === 'assignNextAction' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-neutral-500">Context</label>
            <select
              value={contextId ?? ''}
              onChange={(e) => setContextId(e.target.value || undefined)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">No context</option>
              {contexts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="text-xs text-neutral-500">Energy required</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as EnergyLevel[]).map((e) => (
                <Btn key={e} primary={energy === e} onClick={() => setEnergy(e)}>
                  {e}
                </Btn>
              ))}
            </div>

            <label className="text-xs text-neutral-500">Time estimate (minutes)</label>
            <input
              type="number"
              min={0}
              value={timeEstimateMin ?? ''}
              onChange={(e) => setTimeEstimateMin(e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />

            <label className="text-xs text-neutral-500">Due date (optional — a real deadline)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />

            <Btn
              primary
              onClick={() =>
                finish(() =>
                  clarifyAsNextAction(item.id, {
                    contextId,
                    energy,
                    timeEstimateMin,
                    dueDate: dueDate ? parseLocalDate(dueDate) : undefined,
                  }),
                )
              }
            >
              Add to Next Actions
            </Btn>
          </div>
        )}

        {step === 'defineProject' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-neutral-500">Project title</label>
            <input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <label className="text-xs text-neutral-500">
              Outcome — what does "done" look like when this is successfully complete?
            </label>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={2}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <label className="text-xs text-neutral-500">Area of Focus (optional)</label>
            <select
              value={areaOfFocusId ?? ''}
              onChange={(e) => {
                setAreaOfFocusId(e.target.value || undefined)
                setGoalId(undefined)
              }}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">None</option>
              {areas?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {areaOfFocusId && (
              <>
                <label className="text-xs text-neutral-500">Which Goal does this serve? (optional)</label>
                <select
                  value={goalId ?? ''}
                  onChange={(e) => setGoalId(e.target.value || undefined)}
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="">None</option>
                  {goals
                    ?.filter((g) => g.areaOfFocusId === areaOfFocusId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                </select>
              </>
            )}
            <label className="text-xs text-neutral-500">
              What's the very next physical action to move this forward?
            </label>
            <input
              value={firstActionTitle}
              onChange={(e) => setFirstActionTitle(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <Btn
              primary
              disabled={!projectTitle.trim() || !firstActionTitle.trim()}
              onClick={() =>
                finish(() =>
                  clarifyAsProject(item.id, {
                    title: projectTitle.trim(),
                    outcome: outcome.trim(),
                    areaOfFocusId,
                    goalId,
                    firstActionTitle: firstActionTitle.trim(),
                  }),
                )
              }
            >
              Create Project
            </Btn>
          </div>
        )}

        <div className="mt-5 flex justify-between border-t border-neutral-800 pt-3">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Cancel
          </button>
          {step !== 'actionable' && (
            <button onClick={() => setStep('actionable')} className="text-xs text-neutral-500 hover:text-neutral-300">
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Btn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
