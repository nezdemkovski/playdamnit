import { Link } from "@tanstack/react-router";

import { useSession } from "@/hooks/auth";
import HeaderClient from "./header-client";

export default function Header() {
  const { user } = useSession();

  return (
    <header className="w-full">
      {/* Accent line */}
      <div className="h-2 w-full bg-gradient-to-r from-playdamnit-purple via-playdamnit-cyan to-playdamnit-purple"></div>

      {/* Main header content */}
      <div className="bg-black shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="relative z-10 flex items-center gap-2 group">
              <img src="/logo.svg" alt="PlayDamnIt Logo" className="w-32" />
            </Link>

            {/* Client-side interactive elements */}
            <HeaderClient user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
