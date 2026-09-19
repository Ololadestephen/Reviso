import { Link, NavLink, Outlet } from "react-router-dom";
import { RevisoMark } from "./components/Brand";
import { useScrolled } from "./lib/useScrolled";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "active" : "";

export function RevisoLogo() {
  return (
    <span className="public-logo">
      <RevisoMark />
      <span>Reviso</span>
    </span>
  );
}

export default function MarketingLayout() {
  const scrolled = useScrolled(72, 24);
  return (
    <div className="public-shell">
      <div className={`public-header${scrolled ? " scrolled" : ""}`}>
        <nav className="public-nav" aria-label="Main navigation">
          <Link to="/" aria-label="Reviso home">
            <RevisoLogo />
          </Link>
          <div className="public-nav-links">
            <NavLink to="/guide" className={navClass}>
              Guide
            </NavLink>
          </div>
          <a className="button-link public-app-link" href="/app">
            Open app
          </a>
        </nav>
      </div>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div>
          <RevisoLogo />
          <p>Research ideas with clear conditions and cited sources.</p>
        </div>
        <div className="public-footer-links">
          <Link to="/example">NVIDIA example</Link>
          <Link to="/guide">Guide</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
        <p className="public-footer-note">
          Reviso is a research tool. It cannot place trades or make decisions
          for you. Tokenized Bitget products are not registered shares.
        </p>
      </footer>
    </div>
  );
}
