export function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        <p className="mt-3 text-sm text-slate-500">
          Esta sección se construye en la próxima iteración.
        </p>
      </div>
    </div>
  );
}
