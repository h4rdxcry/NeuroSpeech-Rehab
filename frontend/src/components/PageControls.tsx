export default function PageControls({ page, count, setPage }: { page: number; count: number; setPage: (page: number) => void }) {
  return <nav aria-label="Record pages" className="flex flex-wrap items-center justify-between gap-4 mt-5"><button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</button><span className="muted" role="status">Page {page + 1} · {count} records on this page</span><button type="button" className="secondary-button" disabled={count < 50} onClick={() => setPage(page + 1)}>Next page</button></nav>
}
