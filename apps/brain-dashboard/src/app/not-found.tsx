import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h1>Not in the brain</h1>
      <p className="muted">There is no such piece on the current branch. It may have been renamed or removed since you opened the link.</p>
      <p><Link href="/">Back to the overview</Link></p>
    </div>
  );
}
