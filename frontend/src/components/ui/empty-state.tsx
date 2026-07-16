// Reusable empty state component for consistent empty state UI across pages

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon = '📭', title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="text-5xl mb-4 opacity-40 select-none">{icon}</div>
      <h3 className="text-base font-semibold text-slate-300 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary text-sm px-5 py-2.5"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function NoSearchResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-3 opacity-30">🔍</div>
      <p className="text-sm font-medium text-slate-400 mb-1">
        ไม่พบผลลัพธ์สำหรับ "{query}"
      </p>
      <p className="text-xs text-slate-600 mb-4">ลองค้นหาด้วยคำอื่น หรือ</p>
      <button onClick={onClear} className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
        ล้างการค้นหา
      </button>
    </div>
  )
}
