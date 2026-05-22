export function EmptyState({ icon, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
      {icon && <div className="text-4xl opacity-30">{icon}</div>}
      <p className="text-sm text-gray-500">{message}</p>
      {action && action}
    </div>
  );
}
