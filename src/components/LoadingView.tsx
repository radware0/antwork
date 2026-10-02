export function LoadingView() {
  return <div className="startup-screen" aria-busy="true" aria-label="Loading local history">
    <span className="startup-title">antwork</span>
    <span className="startup-indicator" aria-hidden="true"><i /><i /><i /></span>
    <span className="sr-only">Loading local history</span>
  </div>;
}
