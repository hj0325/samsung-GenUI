import LegacyPageFrame from '@/src/client/features/legacy/LegacyPageFrame';

export default function LegacyStandalonePage({ title, subtitle, legacyPath }) {
  return <LegacyPageFrame title={title} subtitle={subtitle} legacyPath={legacyPath} />;
}
