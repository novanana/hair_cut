interface HomeScreenProps {
  onCreateNew: () => void
}

export function HomeScreen({ onCreateNew }: HomeScreenProps) {
  return (
    <div className="relative flex h-full flex-col">
      <header className="border-b border-zinc-800 px-4 py-4">
        <h1 className="text-lg font-semibold">헤어 도해도 노트</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-zinc-400">
        <p className="text-4xl">✂️</p>
        <p>아직 저장된 도해도가 없어요.</p>
        <p className="text-sm text-zinc-500">
          우측 하단 버튼으로 첫 도해도를 만들어보세요.
        </p>
      </div>

      <button
        onClick={onCreateNew}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl text-zinc-900 shadow-lg"
        aria-label="새로 만들기"
      >
        +
      </button>
    </div>
  )
}
