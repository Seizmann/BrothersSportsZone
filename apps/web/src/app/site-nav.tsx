"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Shared nav items so the desktop row and the mobile menu never diverge.
const NAV_LINKS = [
  { href: "/book", label: "Book" },
  { href: "/matches", label: "Matches" },
  { href: "/teams", label: "Teams" },
  { href: "/my-bookings", label: "My bookings" },
];

// Site navigation. Desktop keeps the inline link row; below md (768px, per
// DESIGN.md "Mobile nav") it collapses to a hamburger toggle with a dropdown
// panel. The menu closes on link click, outside click, and Escape (which also
// returns focus to the toggle).
export function SiteNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <nav ref={navRef} className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
      <Link href="/" className="shrink-0 font-semibold">
        BrothersSportsZone
      </Link>

      {/* Desktop row — identical behavior to the pre-mobile-nav header */}
      <div className="hidden items-center gap-4 text-sm md:flex">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:underline">
            {l.label}
          </Link>
        ))}
        {loggedIn ? (
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="hover:underline">
              Log out
            </button>
          </form>
        ) : (
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
        )}
      </div>

      {/* Mobile hamburger toggle */}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="-mr-1 rounded p-1 hover:bg-neutral-100 md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {/* Mobile dropdown panel */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full z-10 border-b bg-white shadow-sm md:hidden"
        >
          <div className="mx-auto flex max-w-4xl flex-col divide-y px-4 text-sm">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 hover:underline">
                {l.label}
              </Link>
            ))}
            <div className="py-3">
              {loggedIn ? (
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="hover:underline">
                    Log out
                  </button>
                </form>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="hover:underline">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
