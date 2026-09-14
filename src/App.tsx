import { useEffect, useState, type ReactNode } from 'react'
import { Sidebar, type ViewKey } from './components/Sidebar'
import { CaptureBar } from './components/CaptureBar'
import { seedDefaultsIfEmpty } from './db/db'
import { InboxView } from './views/InboxView'
import { NextActionsView } from './views/NextActionsView'
import { ProjectsView } from './views/ProjectsView'
import { ProjectDetailView } from './views/ProjectDetailView'
import { WaitingForView } from './views/WaitingForView'
import { SomedayMaybeView } from './views/SomedayMaybeView'
import { CalendarView } from './views/CalendarView'
import { AreasOfFocusView } from './views/AreasOfFocusView'
import { WeeklyReviewView } from './views/WeeklyReviewView'

function App() {
  const [view, setView] = useState<ViewKey>('inbox')
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)

  useEffect(() => {
    void seedDefaultsIfEmpty()
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
      case 'inbox':
        content = <InboxView />
        break
      case 'next':
        content = <NextActionsView />
        break
      case 'projects':
        content = <ProjectsView onOpen={openProject} />
        break
      case 'waiting':
        content = <WaitingForView />
        break
      case 'someday':
        content = <SomedayMaybeView />
        break
      case 'calendar':
        content = <CalendarView />
        break
      case 'areas':
        content = <AreasOfFocusView onOpenProject={openProject} />
        break
      case 'review':
        content = <WeeklyReviewView />
        break
    }
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar current={view} onSelect={selectView} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <CaptureBar />
        <div className="flex-1 overflow-y-auto">{content}</div>
      </div>
    </div>
  )
}

export default App
