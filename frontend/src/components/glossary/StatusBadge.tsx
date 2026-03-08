interface StatusBadgeProps {
  name:  string
  color: string
}

export function StatusBadge({ name, color }: StatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border"
      style={{
        backgroundColor: color + '20',
        color,
        borderColor: color + '60',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  )
}
