import { useEffect, useState, type ReactNode } from 'react'
import { Sidebar, type ViewKey } from './components/Sidebar'
import { CaptureBar } from './components/CaptureBar'
import { HorizonsIntakeWizard } from './components/HorizonsIntakeWizard'
import { MindSweepWizard } from './components/MindSweepWizard'
import { CompletionToastProvider } from './components/CompletionToastProvider'
import { seedDefaultsIfEmpty } from './db/db'
import { generateDueOccurrences } from './db/recurring'
import { DashboardView } from './views/DashboardView'
import { RecentlyCompletedView } from './views/RecentlyCompletedView'
import { InboxView } from './views/InboxView'
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

  useEffect(() => {
    void seedDefaultsIfEmpty().then(() => generateDueOccurrences())
  }, [])

  const openProject = (id: string) => {
    setOpenProjectId(id)
    setView('projects')
  }

  const selectView = (v: ViewKey) => {
    setOpenProjectId(null)
    setView(v)
  }

  let content: ReactNode
  if (view === 'projects' && openProjectId) {
    content = <ProjectDetailView projectId={openProjectId} onBack={() => setOpenProjectId(null)} />
  } else {
    switch (view) {
      case 'dashboard':
        content = (
          <DashboardView
            onOpenProject={openProject}
            onViewWaitingFor={() => selectView('waiting')}
            onViewNextActions={() => selectView('next')}
          />
        )
        break
      case 'completed':
        content = <RecentlyCompletedView onOpenProject={openProject} />
        break
      case 'inbox':
        content = <InboxView />
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
        content = <GoalsView />
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
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
        <Sidebar
          current={view}
          onSelect={selectView}
          onStartIntake={() => setShowIntake(true)}
          onStartMindSweep={() => setShowMindSweep(true)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <CaptureBar />
          <div className="flex-1 overflow-y-auto">{content}</div>
        </div>
        {showIntake && <HorizonsIntakeWizard onClose={() => setShowIntake(false)} />}
        {showMindSweep && <MindSweepWizard onClose={() => setShowMindSweep(false)} />}
      </div>
    </CompletionToastProvider>
  )
}

export default App
