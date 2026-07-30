import { useState } from 'react'
import { HomeScreen } from './screens/HomeScreen'
import { TemplateSelectScreen } from './screens/TemplateSelectScreen'
import { EditorScreen } from './screens/EditorScreen'

type Screen = { name: 'home' } | { name: 'select' } | { name: 'editor'; templateId: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  return (
    <div className="mx-auto h-full max-w-md bg-zinc-950 text-zinc-50">
      {screen.name === 'home' && (
        <HomeScreen onCreateNew={() => setScreen({ name: 'select' })} />
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
          onBack={() => setScreen({ name: 'select' })}
        />
      )}
    </div>
  )
}
