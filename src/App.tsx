import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useCompletionToast } from './lib/completionToastContext'
import { Sidebar, type ViewKey } from './components/Sidebar'
import { CaptureBar } from './components/CaptureBar'
import { MobileMoreSheet } from './components/MobileMoreSheet'
import { MobileTabBar } from './components/MobileTabBar'
import { ReturnBar } from './components/ReturnBar'
import { UndoSnackbar } from './components/UndoSnackbar'
import { HorizonsIntakeWizard } from './components/HorizonsIntakeWizard'
import { MindSweepWizard } from './components/MindSweepWizard'
import { CompletionToastProvider } from './components/CompletionToastProvider'
import { ReminderPrompt } from './components/ReminderPrompt'
import { WeeklyReviewPrompt } from './components/WeeklyReviewPrompt'
import { cloudEnabled } from './db/cloudConfig'
import { db, seedDefaultsIfEmpty } from './db/db'
import { mergeDuplicateDefaults } from './db/dedupe'
import { captureToInbox } from './db/operations'
import { takeCaptureParam } from './lib/urlCapture'
import { DashboardView } from './views/DashboardView'
import { RecentlyCompletedView } from './views/RecentlyCompletedView'
import { ReportView } from './views/ReportView'
import { InboxView } from './views/InboxView'
import { StartDayView } from './views/StartDayView'
import { EndDayView } from './views/EndDayView'
import { TodayHomeView } from './views/TodayHomeView'
import { FocusView } from './views/FocusView'
import { NO_FILTERS, type NextFilters } from './lib/nextFilters'
import { SearchView } from './views/SearchView'
import { NextActionsView } from './views/NextActionsView'
import { WhatNowView } from './views/WhatNowView'
import { ProjectsView } from './views/ProjectsView'
import { ProjectDetailView } from './views/ProjectDetailView'
import { WaitingForView } from './views/WaitingForView'
import { SomedayMaybeView } from './views/SomedayMaybeView'
import { CalendarView } from './views/CalendarView'
import { ReferenceView } from './views/ReferenceView'
import { PurposeView } from './views/PurposeView'
import { VisionView } from './views/VisionView'
import { GoalsView } from './views/GoalsView'
import { AreasOfFocusView } from './views/AreasOfFocusView'
import { WeeklyReviewView } from './views/WeeklyReviewView'
import { SettingsView } from './views/SettingsView'

function App() {
  // Opens on Today — the calm home base. Sorting the Inbox is something you choose to do, not the first thing the
  // app asks of you (the Inbox count still shows in the menu; capturing is always available in the bar above).
  const [view, setView] = useState<ViewKey>('today')
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [showIntake, setShowIntake] = useState(false)
  const [showMindSweep, setShowMindSweep] = useState(false)
  const [showMoreSheet, setShowMoreSheet] = useState(false)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [goalReturnProjectId, setGoalReturnProjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocusTick, setSearchFocusTick] = useState(0)
  // Set when Start My Day sends you to the Inbox to sort things right away; any other navigation clears it.
  const [processInboxOnOpen, setProcessInboxOnOpen] = useState(false)
  // Bumped on every request so the Inbox restarts even when you're already looking at it.
  const [inboxRun, setInboxRun] = useState(0)
  // Set when Today's "untouched for over a week" line sends you to Next Actions already narrowed to those.
  const [nextStaleOnly, setNextStaleOnly] = useState(false)
  // The guided flow you stepped out of by following one of its links (to the Inbox, Calendar…), so a slim bar can
  // take you straight back to the same place. Cleared when you return, dismiss it, or finish the flow.
  const [returnTo, setReturnTo] = useState<'startday' | 'endday' | null>(null)
  // Set when the Weekly Review pop-up or Start My Day sends you straight into the guided review.
  const [reviewAutoStart, setReviewAutoStart] = useState(false)
  const [reviewRun, setReviewRun] = useState(0)
  // Focus mode is entered from Next Actions or Start My Day, carrying that screen's filters, and returns there.
  const [focusFilters, setFocusFilters] = useState<NextFilters>(NO_FILTERS)
  const [focusReturn, setFocusReturn] = useState<ViewKey>('next')
  // Set when the app was opened with ?capture=... (e.g. a Siri Shortcut) and that text just got captured.
  const [captureConfirmation, setCaptureConfirmation] = useState<string | null>(null)

  useEffect(() => {
    void seedDefaultsIfEmpty().then(() => mergeDuplicateDefaults())
  }, [])

  // Lets something outside the app — a Siri Shortcut, a bookmarklet — capture straight to the Inbox by
  // opening ?capture=<text>. The param is stripped from the URL synchronously inside takeCaptureParam,
  // before this capture even starts, so a reload can't repeat it.
  useEffect(() => {
    const text = takeCaptureParam()
    if (!text) return
    void captureToInbox(text).then(() => {
      setCaptureConfirmation(text)
      setTimeout(() => setCaptureConfirmation(null), 4000)
    })
  }, [])

  // Two devices can each set up the starter contexts and areas before they've met; tidy the doubles after every sync.
  useEffect(() => {
    if (!cloudEnabled) return
    const subscription = db.cloud.events.syncComplete.subscribe(() => void mergeDuplicateDefaults())
    return () => subscription.unsubscribe()
  }, [])

  const openSearch = useCallback(() => {
    setOpenProjectId(null)
    setView('search')
    setSearchFocusTick((t) => t + 1)
  }, [])

  const openProject = (id: string) => {
    setOpenProjectId(id)
    setEditGoalId(null)
    setGoalReturnProjectId(null)
    setView('projects')
  }

  const openGoal = (goalId: string, fromProjectId: string) => {
    setOpenProjectId(null)
    setEditGoalId(goalId)
    setGoalReturnProjectId(fromProjectId)
    setView('goals')
  }

  const selectView = (v: ViewKey) => {
    setOpenProjectId(null)
    setEditGoalId(null)
    setGoalReturnProjectId(null)
    setProcessInboxOnOpen(false)
    setReviewAutoStart(false)
    setNextStaleOnly(false)
    setReturnTo((cur) => (cur === v ? null : cur))
    setView(v)
  }

  /** Follow a link out of a guided flow, remembering which one so the way back stays one tap away. */
  const fromFlow = (flow: 'startday' | 'endday', go: () => void) => () => {
    setReturnTo(flow)
    go()
  }

  const RETURN_LABEL = { startday: 'Start My Day', endday: 'End My Day' } as const
  const goBackToFlow = () => {
    if (returnTo) selectView(returnTo)
  }

  const startFocus = (filters: NextFilters = NO_FILTERS) => {
    setFocusFilters(filters)
    setFocusReturn(view === 'startday' ? 'startday' : 'next')
    selectView('focus')
  }

  /** Go to the Weekly Review and open the guided walkthrough right away. */
  const startReview = () => {
    selectView('review')
    setReviewAutoStart(true)
    setReviewRun((n) => n + 1)
  }

  /** Go to the Inbox and start working through it right away. */
  const startInboxProcessing = () => {
    selectView('inbox')
    setProcessInboxOnOpen(true)
    setInboxRun((n) => n + 1)
  }

  // Focus and What Now? borrow another screen's place in the nav while they're open, so that screen still shows active.
  const effectiveView = view === 'focus' ? focusReturn : view === 'whatnow' ? 'next' : view

  let content: ReactNode
  if (view === 'projects' && openProjectId) {
    content = (
      <ProjectDetailView
        projectId={openProjectId}
        onBack={() => setOpenProjectId(null)}
        onOpenGoal={(goalId) => openGoal(goalId, openProjectId)}
      />
    )
  } else {
    switch (view) {
      case 'search':
        content = (
          <SearchView
            query={searchQuery}
            onQueryChange={setSearchQuery}
            focusTick={searchFocusTick}
            onOpenProject={openProject}
            onNavigate={selectView}
          />
        )
        break
      case 'today':
        content = (
          <TodayHomeView
            onOpenProject={openProject}
            onStartDay={() => selectView('startday')}
            onEndDay={() => selectView('endday')}
            onViewNextActions={() => selectView('next')}
            onViewStale={() => {
              selectView('next')
              setNextStaleOnly(true)
            }}
            onViewCalendar={() => selectView('calendar')}
            onViewWeeklyReview={startReview}
          />
        )
        break
      case 'startday':
        content = (
          <StartDayView
            onOpenProject={(id) => fromFlow('startday', () => openProject(id))()}
            onProcessInbox={fromFlow('startday', startInboxProcessing)}
            onViewInbox={fromFlow('startday', () => selectView('inbox'))}
            onFocus={() => startFocus()}
            onViewToday={() => selectView('today')}
            onViewNextActions={fromFlow('startday', () => selectView('next'))}
            onViewWaitingFor={fromFlow('startday', () => selectView('waiting'))}
            onViewWhatNow={fromFlow('startday', () => selectView('whatnow'))}
            onViewCalendar={fromFlow('startday', () => selectView('calendar'))}
            onViewWeeklyReview={fromFlow('startday', startReview)}
          />
        )
        break
      case 'endday':
        content = (
          <EndDayView
            onOpenProject={(id) => fromFlow('endday', () => openProject(id))()}
            onProcessInbox={fromFlow('endday', startInboxProcessing)}
            onViewInbox={fromFlow('endday', () => selectView('inbox'))}
            onViewToday={() => selectView('today')}
            onViewNextActions={fromFlow('endday', () => selectView('next'))}
            onViewCalendar={fromFlow('endday', () => selectView('calendar'))}
          />
        )
        break
      case 'report':
        content = <ReportView onOpenProject={openProject} onViewNextActions={() => selectView('next')} />
        break
      case 'dashboard':
        content = (
          <DashboardView
            onOpenProject={openProject}
            onViewWaitingFor={() => selectView('waiting')}
            onViewNextActions={() => selectView('next')}
            onViewProjects={() => selectView('projects')}
          />
        )
        break
      case 'completed':
        content = <RecentlyCompletedView onOpenProject={openProject} />
        break
      case 'inbox':
        content = (
          <InboxView
            key={inboxRun}
            autoStart={processInboxOnOpen}
            returnTo={returnTo ? { label: RETURN_LABEL[returnTo], go: goBackToFlow } : undefined}
          />
        )
        break
      case 'next':
        content = (
          <NextActionsView
            key={nextStaleOnly ? 'stale' : 'all'}
            startStaleOnly={nextStaleOnly}
            onOpenProject={openProject}
            onFocus={startFocus}
            onAskWhatNow={() => selectView('whatnow')}
          />
        )
        break
      case 'focus':
        content = (
          <FocusView
            filters={focusFilters}
            onStop={() => selectView(focusReturn)}
            onOpenNextActions={() => selectView('next')}
          />
        )
        break
      case 'whatnow':
        content = <WhatNowView onOpenProject={openProject} onViewNextActions={() => selectView('next')} />
        break
      case 'projects':
        content = <ProjectsView onOpen={openProject} />
        break
      case 'waiting':
        content = <WaitingForView onOpenProject={openProject} />
        break
      case 'someday':
        content = <SomedayMaybeView onOpenProject={openProject} />
        break
      case 'calendar':
        content = <CalendarView onOpenProject={openProject} />
        break
      case 'reference':
        content = <ReferenceView />
        break
      case 'purpose':
        content = <PurposeView />
        break
      case 'vision':
        content = <VisionView />
        break
      case 'goals':
        content = (
          <GoalsView
            editGoalId={editGoalId}
            onBackToProject={goalReturnProjectId ? () => openProject(goalReturnProjectId) : undefined}
          />
        )
        break
      case 'areas':
        content = <AreasOfFocusView onOpenProject={openProject} />
        break
      case 'review':
        content = (
          <WeeklyReviewView
            key={reviewRun}
            onNavigate={selectView}
            autoStart={reviewAutoStart}
            onStartMindSweep={() => setShowMindSweep(true)}
          />
        )
        break
      case 'settings':
        content = <SettingsView />
        break
    }
  }

  return (
    <CompletionToastProvider>
      <SearchHotkey onTrigger={openSearch} />
      <ReminderPrompt />
      <UndoSnackbar />
      <WeeklyReviewPrompt onStart={startReview} />
      {captureConfirmation && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-emerald-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 shadow-xl"
        >
          <span className="text-emerald-400" aria-hidden>
            ✓
          </span>
          <span className="truncate">
            Captured: <span className="text-neutral-300">"{captureConfirmation}"</span>
          </span>
        </div>
      )}
      <div className="app-height flex bg-neutral-950 text-neutral-100">
        <Sidebar
          current={effectiveView}
          onSelect={selectView}
          onStartIntake={() => setShowIntake(true)}
          onStartMindSweep={() => setShowMindSweep(true)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <CaptureBar />
          {returnTo && view !== 'focus' && (
            <ReturnBar label={RETURN_LABEL[returnTo]} onReturn={goBackToFlow} onDismiss={() => setReturnTo(null)} />
          )}
          <ContentArea>{content}</ContentArea>
          <MobileTabBar
            current={effectiveView}
            onSelect={selectView}
            onMore={() => setShowMoreSheet(true)}
            moreActive={!['today', 'inbox', 'next', 'projects'].includes(effectiveView)}
          />
        </div>
        {showIntake && <HorizonsIntakeWizard onClose={() => setShowIntake(false)} />}
        {showMindSweep && <MindSweepWizard onClose={() => setShowMindSweep(false)} />}
        {showMoreSheet && (
          <MobileMoreSheet
            current={effectiveView}
            onSelect={selectView}
            onClose={() => setShowMoreSheet(false)}
            onStartIntake={() => setShowIntake(true)}
            onStartMindSweep={() => setShowMindSweep(true)}
          />
        )}
      </div>
    </CompletionToastProvider>
  )
}

/** Ctrl/Cmd+K jumps to Search — except while a "what's next?" card is waiting, when only capture is allowed. */
function SearchHotkey({ onTrigger }: { onTrigger: () => void }) {
  const { blocked } = useCompletionToast()
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!blocked) onTrigger()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocked, onTrigger])
  return null
}

/** `inert` while a card is waiting: no clicks, and no keyboard route in either. */
function ContentArea({ children }: { children: ReactNode }) {
  const { blocked } = useCompletionToast()
  return (
    <div inert={blocked} className="flex-1 overflow-y-auto">
      {children}
    </div>
  )
}

export default App
