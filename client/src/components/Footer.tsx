/**
 * Footer — minimal site-wide footer with version information.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface ChangelogData {
  versions: Array<{
    version: string;
    isLatest: boolean;
  }>;
}

export function Footer() {
  const [currentVersion, setCurrentVersion] = useState<string>('v1.0');

  useEffect(() => {
    async function loadVersion() {
      try {
        const response = await fetch('/changelog.json');
        if (response.ok) {
          const data: ChangelogData = await response.json();
          const latest = data.versions.find(v => v.isLatest);
          if (latest) setCurrentVersion(latest.version);
        }
      } catch (err) {
        console.error('Failed to load version:', err);
      }
    }
    loadVersion();
  }, []);

  return (
<footer className="mt-auto bg-gray-50 border-t border-gray-200">
  <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
    
    <Link
      to="/changelog"
      className="flex items-center gap-1 text-black hover:text-black text-lg"
    >
      <span className="font-semibold">
        View Changelog &nbsp;
      </span>

      <span
        className="
          text-blue-600
          border-b
          border-dotted
          border-blue-600
          font-semibold
          hover:text-blue-700
        "
      >
        {currentVersion}
      </span>
    </Link>

    <div className="text-center sm:text-right text-gray-600 text-lg">
      © {new Date().getFullYear()} River Edge Analytics Pvt. Ltd. — Expense Manager
    </div>
  </div>
</footer>
  );
}

export default Footer;
