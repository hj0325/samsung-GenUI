import LegacyStandalonePage from '@/src/client/features/standalone/LegacyStandalonePage';

export default function PreviewDarkPage() {
  return (
    <LegacyStandalonePage
      title="Preview Dark"
      subtitle="Dark preview served through the Next.js boundary."
      legacyPath="preview-dark.html"
    />
  );
}
