import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Library,
  Menu,
  Monitor,
  Moon,
  Network,
  Plus,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { nextThemePreference } from "../lib/theme";
import type { ThemePreference } from "../lib/theme";
import type { ShellTopic } from "../lib/shell-nav";
import type { Page } from "../types";

export type { ShellTopic };

export interface ShellProps {
  page: Page;
  /** Route id when page is "collection", otherwise "". Keeps the `#collection/<id>` nav link. */
  collectionId: string;
  /** App focuses this on route change; the skip link focuses it too. */
  mainRef: RefObject<HTMLElement | null>;
  recentTopics: ShellTopic[];
  topicCount: number;
  /** Saved sources plus examples shown beside the Library link. */
  noteCount: number;
  storage: "loading" | "ready" | "unavailable";
  demo: boolean;
  themePreference: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
  onAddSource: () => void;
  onOpenAbout: () => void;
  onSearchLibrary: () => void;
  onSelectTopic: (id: string) => void;
  children: ReactNode;
}

// Breadcrumb names; "Home" replaces "My library" together with the nav label.
const PAGE_LABELS: Record<Page, string> = {
  library: "My library",
  note: "Source note",
  collection: "Learning collections",
  topics: "Topic graph",
  discover: "Reading list",
};

const NAV_ITEMS = [
  { page: "library", title: "My library", icon: Library },
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
  noteCount,
  storage,
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
            <small>A PLACE FOR YOUR CURIOSITY</small>
          </span>
        </a>
        <button
          className="workspace-switch"
          onClick={closeThen(onOpenAbout)}
        >
          <span className="workspace-avatar">S</span>
          <span>
            Personal workspace
            <small>
              {storage === "ready" ? "Private library" : "Example preview"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button
          className="sidebar-search"
          onClick={closeThen(onSearchLibrary)}
        >
          <Search size={16} /> Search your library <span>/</span>
        </button>
        <span className="nav-label">WORKSPACE</span>
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
              {itemPage === "library" && (
                <span className="nav-count">{noteCount}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-topics">
          <div className="nav-label">
            YOUR TOPICS <span>{topicCount}</span>
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
              {t.title}
              <span>{t.sourceCount}</span>
            </button>
          ))}
          {!recentTopics.length && (
            <p className="micro-copy">Topics grow from saved sources.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={17} />
            </span>
            <strong>Stay curious.</strong>
            <p>Your next big idea starts with one small question.</p>
            <button onClick={closeThen(onAddSource)}>
              Add something interesting <Plus size={14} />
            </button>
          </div>
          <button
            className="appearance"
            onClick={() => onThemeChange(nextThemePreference(themePreference))}
          >
            {themePreference === "dark" ? (
              <Moon size={16} />
            ) : themePreference === "light" ? (
              <Sun size={16} />
            ) : (
              <Monitor size={16} />
            )}
            <span>
              {themePreference === "dark"
                ? "Dark"
                : themePreference === "light"
                  ? "Light"
                  : "System"}{" "}
              appearance
            </span>
            <span className="theme-switch">
              <span />
            </span>
          </button>
          <button className="profile" onClick={closeThen(onOpenAbout)}>
            <span className="profile-avatar">Y</span>
            <span>
              Your workspace
              <small>
                {demo
                  ? "Exploring example material"
                  : "Learning, one idea at a time"}
              </small>
            </span>
            <CircleHelp size={16} />
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
            <button
              className="button primary small-button"
              onClick={onAddSource}
            >
              <Plus size={16} />
              Add source
            </button>
          </div>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}
