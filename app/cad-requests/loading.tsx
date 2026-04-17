export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="w-12 h-12 border-4 border-surface-variant border-t-primary rounded-full animate-spin mb-4"></div>
      <h2 className="display-sm">Loading...</h2>
      <p className="text-secondary tracking-wide mt-2">Fetching Shewah operations data</p>
    </div>
  )
}
