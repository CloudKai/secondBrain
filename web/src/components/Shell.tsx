import {
  BookOpen,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  House,
  Menu,
  Network,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { ThemePreference } from "../lib/theme";
import { PAGE_LABELS } from "../lib/shell-nav";
import type { ShellTopic } from "../lib/shell-nav";
import type { Page } from "../types";
import { Button, ThemeToggle } from "./ui";

export type { ShellTopic };

export interface ShellProps {
  page: Page;
  /** Route id when page is "collection", otherwise "". Keeps the `#collection/<id>` nav link. */
  collectionId: string;
  /** App focuses this on route change; the skip link focuses it too. */
  mainRef: RefObject<HTMLElement | null>;
  recentTopics: ShellTopic[];
  topicCount: number;
  demo: boolean;
  themePreference: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
  onAddSource: () => void;
  onOpenAbout: () => void;
  onSearchLibrary: () => void;
  onSelectTopic: (id: string) => void;
  children: ReactNode;
}

const NAV_ITEMS = [
  { page: "library", title: "Home", icon: House },
  { page: "topics", title: "Topic graph", icon: Network },
  { page: "collection", title: "Learning collections", icon: BookOpen },
  { page: "discover", title: "Reading list", icon: Sparkles },
] as const;

export default function Shell({
  page,
  collectionId,
  mainRef,
  recentTopics,
  topicCount,
  demo,
  themePreference,
  onThemeChange,
  onAddSource,
  onOpenAbout,
  onSearchLibrary,
  onSelectTopic,
  children,
}: ShellProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width:760px)").matches,
  );

  useEffect(() => {
    const close = () => setMobileNav(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!narrow || !mobileNav) return;
    sidebarRef.current
      ?.querySelector<HTMLButtonElement>(".mobile-nav-close")
      ?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus(),
        );
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [narrow, mobileNav]);

  function closeThen(action: () => void) {
    return () => {
      setMobileNav(false);
      action();
    };
  }

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`sidebar ${mobileNav ? "mobile-open" : ""}`}
        aria-hidden={narrow && !mobileNav}
        inert={narrow && !mobileNav}
      >
        <button
          className="icon-button mobile-nav-close"
          aria-label="Close navigation"
          onClick={() => {
            setMobileNav(false);
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLButtonElement>(".mobile-menu")
                ?.focus(),
            );
          }}
        >
          <X size={18} />
        </button>
        <a className="brand" href="#library">
          <span className="brand-symbol">
            <BrainCircuit size={24} />
          </span>
          <span>
            second brain<span className="brand-period">.</span>
          </span>
        </a>
        <button
          className="sidebar-search"
          onClick={closeThen(onSearchLibrary)}
        >
          <Search size={16} /> Search your library <span>/</span>
        </button>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map(({ page: itemPage, title, icon: Icon }) => (
            <a
              key={itemPage}
              href={
                itemPage === "collection" &&
                page === "collection" &&
                collectionId
                  ? `#collection/${collectionId}`
                  : `#${itemPage}`
              }
              className={`nav-item ${page === itemPage ? "active" : ""}`}
              aria-current={page === itemPage ? "page" : undefined}
              onClick={() => setMobileNav(false)}
            >
              <Icon size={18} />
              {title}
            </a>
          ))}
        </nav>
        <div
          className="sidebar-topics"
          role="group"
          aria-labelledby="sidebar-topics-label"
        >
          <div className="nav-label" id="sidebar-topics-label">
            Recent topics
          </div>
          {recentTopics.map((t, i) => (
            <button
              key={t.id}
              className="sidebar-topic"
              onClick={closeThen(() => onSelectTopic(t.id))}
            >
              <span
                className={`dot ${["mint", "purple", "peach", "blue"][i % 4]}`}
              />
              <span className="sidebar-topic-title">{t.title}</span>
              <span>{t.sourceCount}</span>
            </button>
          ))}
          {topicCount > 0 ? (
            <a
              className="sidebar-topics-all"
              href="#topics"
              onClick={() => setMobileNav(false)}
            >
              View all topics ({topicCount})
            </a>
          ) : (
            <p className="micro-copy">Topics grow from saved sources.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <ThemeToggle value={themePreference} onChange={onThemeChange} />
          <button className="sidebar-about" onClick={closeThen(onOpenAbout)}>
            <CircleHelp size={16} />
            About this workspace
          </button>
        </div>
      </aside>
      <div className="app-main" inert={narrow && mobileNav}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{PAGE_LABELS[page]}</strong>
          </div>
          <div className="topbar-actions">
            <button className="demo-indicator" onClick={onOpenAbout}>
              <span className="dot mint" />
              {demo ? "Includes examples" : "Private library"}
            </button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={16} />}
              onClick={onAddSource}
            >
              Add source
            </Button>
          </div>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}
