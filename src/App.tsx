import { useState } from 'react'
import type { Diagram } from './db'
import { HomeScreen } from './screens/HomeScreen'
import { TemplateSelectScreen } from './screens/TemplateSelectScreen'
import { EditorScreen } from './screens/EditorScreen'

type Screen =
  | { name: 'home' }
  | { name: 'select' }
  | { name: 'editor'; templateId: string; diagramId?: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  // lifted out of HomeScreen so it survives HomeScreen unmounting while the
  // editor/select screen is open — leaving a folder to view a diagram and
  // coming back should land back inside that same folder, not at the root
  const [homeGroupId, setHomeGroupId] = useState<string | null>(null)

  return (
    <div className="mx-auto h-full max-w-md bg-zinc-950 text-zinc-50">
      {screen.name === 'home' && (
        <HomeScreen
          openGroupId={homeGroupId}
          onOpenGroupIdChange={setHomeGroupId}
          onCreateNew={() => setScreen({ name: 'select' })}
          onOpenDiagram={(diagram: Diagram) =>
            setScreen({ name: 'editor', templateId: diagram.templateId, diagramId: diagram.id })
          }
        />
      )}
      {screen.name === 'select' && (
        <TemplateSelectScreen
          onBack={() => setScreen({ name: 'home' })}
          onSelect={(templateId) => setScreen({ name: 'editor', templateId })}
        />
      )}
      {screen.name === 'editor' && (
        <EditorScreen
          templateId={screen.templateId}
          diagramId={screen.diagramId}
          onBack={() => setScreen({ name: 'home' })}
        />
      )}
    </div>
  )
}
