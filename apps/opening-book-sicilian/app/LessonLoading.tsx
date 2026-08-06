export default function LessonLoading({ label = "Loading lesson…", overlay = false }: { label?: string; overlay?: boolean }) {
  return (
    <div className={`page-loader ${overlay ? "chapter-loader-overlay" : ""}`} role="status" aria-live="polite" aria-busy="true">
      <div className="page-loader-mark" aria-hidden="true">
        <span>C</span>
      </div>
      <p>{label}</p>
    </div>
  );
}
