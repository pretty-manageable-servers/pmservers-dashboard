import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Page not found</h1>
        <p className="muted">This page does not exist.</p>
        <Link href="/" className="btn primary">
          Go to the console
        </Link>
      </div>
    </div>
  );
}
