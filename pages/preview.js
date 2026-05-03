import LegacyStandalonePage from '@/src/client/features/standalone/LegacyStandalonePage';

export default function PreviewPage() {
  return (
    <LegacyStandalonePage
      title="Preview"
      subtitle="Legacy preview served through the Next.js boundary."
      legacyPath="preview.html"
    />
  );
}
