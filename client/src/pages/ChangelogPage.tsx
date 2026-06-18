/**
 * ChangelogPage — displays version history and changes for the application.
 * Fetches data from /changelog.json and renders in a clean, organized layout.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Package } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import Footer from '../components/Footer';

interface Version {
  version: string;
  date: string;
  isLatest: boolean;
  tag: string | null;
  changes: string[];
}

interface ChangelogData {
  versions: Version[];
}

export default function ChangelogPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChangelog() {
      try {
        const response = await fetch('/changelog.json');
        if (!response.ok) throw new Error('Failed to load changelog');
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError('Failed to load changelog. Please try again later.');
        console.error('Changelog load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadChangelog();
  }, []);

  const latestVersion = data?.versions.find(v => v.isLatest);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      
      {/* Header Section with Blue Background */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Version Change Log</h1>
              <p className="text-blue-100 text-sm">Track all updates and improvements to Job Lifecycle</p>
            </div>
            
            {latestVersion && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 text-center min-w-[120px]">
                <div className="text-xs text-blue-100 uppercase tracking-wide mb-1">Latest Version</div>
                <div className="text-2xl font-bold">{latestVersion.version}</div>
                <div className="text-xs text-blue-100 mt-1">{latestVersion.date}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading changelog...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {data && !loading && !error && (
            <div className="space-y-6">
              {data.versions.map((version, index) => {
                const isLatest = version.isLatest;
                return (
                  <div
                    key={version.version}
                    className={`rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                      isLatest
                        ? 'bg-blue-50/50 border-2 border-blue-300'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    {/* Version Header */}
                    <div className={`border-b px-6 py-4 ${
                      isLatest
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${
                            isLatest
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            <Package className="w-4 h-4" />
                            <span className="text-base font-bold">{version.version}</span>
                          </div>
                          {version.tag && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-500 text-white">
                              {version.tag}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{version.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Changes List */}
                    <div className="px-6 py-4">
                      <div className="mb-3">
                        <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                          Changes & Improvements ({version.changes.length})
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {version.changes.map((change, changeIndex) => (
                          <li key={changeIndex} className="flex gap-3 text-sm text-gray-700">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs">
                              {changeIndex + 1}
                            </span>
                            <span className="flex-1 leading-relaxed">{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
