import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useCompletionToast } from './lib/completionToastContext'
import { Sidebar, type ViewKey } from './components/Sidebar'
import { CaptureBar } from './components/CaptureBar'
import { MobileMoreSheet } from './components/MobileMoreSheet'
import { MobileTabBar } from './components/MobileTabBar'
import { HorizonsIntakeWizard } from './components/HorizonsIntakeWizard'
import { MindSweepWizard } from './components/MindSweepWizard'
import { CompletionToastProvider } from './components/CompletionToastProvider'
import { ReminderPrompt } from './components/ReminderPrompt'
import { WeeklyReviewPrompt } from './components/WeeklyReviewPrompt'
import { cloudEnabled } from './db/cloudConfig'
import { db, seedDefaultsIfEmpty } from './db/db'
import { mergeDuplicateDefaults } from './db/dedupe'
import { generateDueOccurrences } from './db/recurring'
import { DashboardView } from './views/DashboardView'
import { RecentlyCompletedView } from './views/RecentlyCompletedView'
import { ReportView } from './views/ReportView'
import { InboxView } from './views/InboxView'
import { StartDayView } from './views/StartDayView'
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
import { RecurringView } from './views/RecurringView'
import { WeeklyReviewView } from './views/WeeklyReviewView'
import { SettingsView } from './views/SettingsView'

function App() {
  const [view, setView] = useState<ViewKey>('inbox')
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
  // Set when the Weekly Review pop-up or Start My Day sends you straight into the guided review.
  const [reviewAutoStart, setReviewAutoStart] = useState(false)
  const [reviewRun, setReviewRun] = useState(0)
  // Focus mode is entered from Next Actions or Start My Day, carrying that screen's filters, and returns there.
  const [focusFilters, setFocusFilters] = useState<NextFilters>(NO_FILTERS)
  const [focusReturn, setFocusReturn] = useState<ViewKey>('next')

  useEffect(() => {
    void seedDefaultsIfEmpty()
      .then(() => mergeDuplicateDefaults())
      .then(() => generateDueOccurrences())
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
    setView(v)
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
            onViewNextActions={() => selectView('next')}
            onViewCalendar={() => selectView('calendar')}
            onViewReport={() => selectView('report')}
            onViewWeeklyReview={startReview}
          />
        )
        break
      case 'startday':
        content = (
          <StartDayView
            onOpenProject={openProject}
            onProcessInbox={startInboxProcessing}
            onFocus={() => startFocus()}
            onViewNextActions={() => selectView('next')}
            onViewWaitingFor={() => selectView('waiting')}
            onViewWhatNow={() => selectView('whatnow')}
            onViewCalendar={() => selectView('calendar')}
            onViewWeeklyReview={startReview}
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
        content = <InboxView key={inboxRun} autoStart={processInboxOnOpen} />
        break
      case 'next':
        content = (
          <NextActionsView
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
      case 'recurring':
        content = <RecurringView />
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
      <WeeklyReviewPrompt onStart={startReview} />
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
        <Sidebar
          current={effectiveView}
          onSelect={selectView}
          onStartIntake={() => setShowIntake(true)}
          onStartMindSweep={() => setShowMindSweep(true)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <CaptureBar />
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
