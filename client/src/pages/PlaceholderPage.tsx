/**
 * PlaceholderPage — generic stub for routes that will be implemented in
 * later phases. Keeps the route table in App.tsx fully wired during Phase 0.
 */
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

interface PlaceholderPageProps {
  title: string;
  phase: string;
}

export default function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-default">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-600">
              This page will be implemented in <strong>{phase}</strong>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
