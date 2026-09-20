import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useCompletionToast } from './lib/completionToastContext'
import { Sidebar, type ViewKey } from './components/Sidebar'
import { CaptureBar } from './components/CaptureBar'
import { HorizonsIntakeWizard } from './components/HorizonsIntakeWizard'
import { MindSweepWizard } from './components/MindSweepWizard'
import { CompletionToastProvider } from './components/CompletionToastProvider'
import { ReminderPrompt } from './components/ReminderPrompt'
import { seedDefaultsIfEmpty } from './db/db'
import { generateDueOccurrences } from './db/recurring'
import { DashboardView } from './views/DashboardView'
import { RecentlyCompletedView } from './views/RecentlyCompletedView'
import { InboxView } from './views/InboxView'
import { StartDayView } from './views/StartDayView'
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
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [goalReturnProjectId, setGoalReturnProjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocusTick, setSearchFocusTick] = useState(0)
  // Set when Start My Day sends you to the Inbox to sort things right away; any other navigation clears it.
  const [processInboxOnOpen, setProcessInboxOnOpen] = useState(false)
  // Bumped on every request so the Inbox restarts even when you're already looking at it.
  const [inboxRun, setInboxRun] = useState(0)

  useEffect(() => {
    void seedDefaultsIfEmpty().then(() => generateDueOccurrences())
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
    setView(v)
  }

  /** Go to the Inbox and start working through it right away. */
  const startInboxProcessing = () => {
    selectView('inbox')
    setProcessInboxOnOpen(true)
    setInboxRun((n) => n + 1)
  }

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
      case 'startday':
        content = (
          <StartDayView
            onOpenProject={openProject}
            onProcessInbox={startInboxProcessing}
            onViewNextActions={() => selectView('next')}
            onViewWaitingFor={() => selectView('waiting')}
            onViewWhatNow={() => selectView('whatnow')}
            onViewCalendar={() => selectView('calendar')}
          />
        )
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
        content = <NextActionsView onOpenProject={openProject} />
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
        content = <WeeklyReviewView onNavigate={selectView} />
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
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
        <Sidebar
          current={view}
          onSelect={selectView}
          onStartIntake={() => setShowIntake(true)}
          onStartMindSweep={() => setShowMindSweep(true)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <CaptureBar />
          <ContentArea>{content}</ContentArea>
        </div>
        {showIntake && <HorizonsIntakeWizard onClose={() => setShowIntake(false)} />}
        {showMindSweep && <MindSweepWizard onClose={() => setShowMindSweep(false)} />}
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
