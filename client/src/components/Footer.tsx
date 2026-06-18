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
   <footer className="mt-auto bg-gray-50">
    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-large text-gray-900">
      
      {/* Left */}
      <Link
        to="/changelog"
        className="flex items-center gap-1 text-black hover:text-black"
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
            leading-none
            hover:text-blue-700
          "
        >
          {currentVersion}
        </span>
      </Link>

      {/* Center */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center">
        © {new Date().getFullYear()} River Edge Analytics Pvt. Ltd. — Real Dashboard
      </div>

      {/* Right spacer */}
      <div className="w-32" />
    </div>
  </footer>
  );
}

export default Footer;
