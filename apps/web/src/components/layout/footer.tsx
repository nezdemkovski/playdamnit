export function Footer() {
  return (
    <footer className="mt-16 flex flex-col gap-2 border-t border-white/5 py-8 text-xs text-dimmed sm:flex-row sm:items-center sm:justify-between">
      <div>© {new Date().getFullYear()} PlayDamnIt</div>
      <div>
        Game data by{" "}
        <a
          href="https://www.igdb.com"
          target="_blank"
          rel="noreferrer"
          className="font-semibold hover:text-white"
        >
          IGDB
        </a>
      </div>
    </footer>
  );
}
