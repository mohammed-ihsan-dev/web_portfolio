import Link from 'next/link';

export default function NotFound() {
  return (
    <div data-page="404" className="page" style={{ display: 'grid', alignContent: 'center', gap: 24 }}>
      <p className="mono muted">(404) Page not found</p>
      <h1 className="display">Lost.</h1>
      <p className="small" style={{ maxWidth: '34ch' }}>
        This page doesn’t exist, or it moved. The rest of the site is one click away.
      </p>
      <Link href="/" className="small" style={{ textDecoration: 'underline', textUnderlineOffset: '0.2em' }}>
        Back to the homepage
      </Link>
    </div>
  );
}
