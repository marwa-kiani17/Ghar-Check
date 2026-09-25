export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} GharCheck &mdash; Built for overseas Pakistanis
      </div>
    </footer>
  );
}