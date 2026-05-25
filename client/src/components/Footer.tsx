/**
 * Footer — minimal site-wide footer.
 */
export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto cursor-default">
      <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} River Edge Analytics Pvt. Ltd. — Real Dashboard
      </div>
    </footer>
  );
}

export default Footer;
