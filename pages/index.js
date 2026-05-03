import Head from 'next/head';
import Link from 'next/link';

const pages = [
  ['/genui', 'GenUI', 'Primary generation workspace routed through Next.js.'],
  ['/customize', 'Customize', 'Theme editor behind the new page shell.'],
  ['/improve', 'Improve', 'Improvement dashboard with storage abstraction underneath.'],
  ['/preview', 'Preview', 'Light preview running in legacy isolation.'],
  ['/preview-dark', 'Preview Dark', 'Dark preview running in legacy isolation.'],
  ['/motion', 'Motion', 'Motion library screen.'],
  ['/components', 'Components', 'Component library screen.'],
];

export default function HomePage() {
  return (
    <div className="page-shell">
      <Head>
        <title>Samsung OneUI Design System</title>
      </Head>
      <div className="page-topbar">
        <div>
          <div className="page-title">Samsung OneUI Design System</div>
          <div className="page-subtitle">Next.js Pages Router shell with legacy runtime adapters and modular server APIs.</div>
        </div>
      </div>
      <div className="home-grid">
        {pages.map(([href, title, body]) => (
          <Link className="home-card" href={href} key={href}>
            <h2>{title}</h2>
            <p>{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
