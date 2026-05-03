import LegacyStandalonePage from '@/src/client/features/standalone/LegacyStandalonePage';

export default function ComponentsPage() {
  return (
    <LegacyStandalonePage
      title="Components"
      subtitle="Component library routed through the new page shell."
      legacyPath="components.html"
    />
  );
}
