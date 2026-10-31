export default function WorkspaceLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading workspace">
      <div className="h-4 w-40 rounded skeleton" />
      <div className="h-10 w-2/3 max-w-md rounded skeleton" />
      <div className="h-4 w-1/2 max-w-lg rounded skeleton" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 rounded-2xl border border-line bg-surface p-5">
            <div className="h-3 w-24 rounded skeleton" />
            <div className="mt-6 h-7 w-20 rounded skeleton" />
          </div>
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-line bg-surface p-5">
        <div className="h-5 w-40 rounded skeleton" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-10 rounded-lg skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
}
