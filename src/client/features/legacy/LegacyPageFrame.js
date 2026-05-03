import Link from 'next/link';
import Head from 'next/head';

const NAV_LINKS = [
  ['/', 'Home'],
  ['/genui', 'GenUI'],
  ['/customize', 'Customize'],
  ['/improve', 'Improve'],
  ['/preview', 'Preview'],
  ['/preview-dark', 'Preview Dark'],
  ['/motion', 'Motion'],
  ['/components', 'Components'],
];

export default function LegacyPageFrame({ title, subtitle, legacyPath }) {
  return (
    <div className="page-shell">
      <Head>
        <title>{title}</title>
      </Head>
      <div className="page-topbar">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-subtitle">{subtitle}</div>
        </div>
        <div className="page-links">
          {NAV_LINKS.map(([href, label]) => (
            <Link className="page-link" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="legacy-frame-wrap">
        <div className="legacy-frame-note">
          This screen is running inside the new Next.js shell while the legacy runtime is isolated behind the
          ` /api/legacy/* ` bridge. This removes top-level global collisions during the migration.
        </div>
        <iframe className="legacy-frame" src={`/api/legacy/${legacyPath}`} title={title} />
      </div>
    </div>
  );
}
