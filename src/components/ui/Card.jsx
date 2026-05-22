export function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return <h2 className={`text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 ${className}`}>{children}</h2>;
}
