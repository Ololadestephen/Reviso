import { Link, NavLink, Outlet, useMatch } from "react-router-dom";
import { RevisoMark } from "./components/Brand";

/** NavLink sets aria-current="page" itself; the class only carries the styling. */
const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "selected" : "";

export default function AppLayout() {
  // Run each matcher on every render to preserve hook order.
  const appExact = useMatch("/app/thesis/:id");
  const appNested = useMatch("/app/thesis/:id/*");
  const legacyExact = useMatch("/thesis/:id");
  const legacyNested = useMatch("/thesis/:id/*");
  const thesisId = (appExact ?? appNested ?? legacyExact ?? legacyNested)
    ?.params.id;
  const openIdea = thesisId && thesisId !== "new" ? thesisId : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand app-brand" to="/" aria-label="Reviso home">
          <RevisoMark />
          <span>Reviso</span>
        </Link>
        <p className="brand-caption">RESEARCH APP</p>
        <nav aria-label="App sections">
          <NavLink to="/app" end className={navClass}>
            <span aria-hidden="true">▤</span> <span>My research</span>
          </NavLink>
          <NavLink to="/app/thesis/new" className={navClass}>
            <span aria-hidden="true">＋</span> <span>New research</span>
          </NavLink>
          {openIdea && (
            <>
              <NavLink to={`/app/thesis/${openIdea}`} end className={navClass}>
                <span aria-hidden="true">◫</span> <span>Research idea</span>
              </NavLink>
              <NavLink
                to={`/app/thesis/${openIdea}/timeline`}
                className={navClass}
              >
                <span aria-hidden="true">◷</span> <span>Decision history</span>
              </NavLink>
            </>
          )}
          <Link to="/guide">
            <span aria-hidden="true">?</span> <span>Guide</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <span className="badge">PROTECTED DEMO</span>
          <p>You make every final decision.</p>
          <small>Reviso cannot place trades.</small>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
        <footer>
          <span>Reviso · Research ideas with clear conditions.</span>
          <span>Human decisions · cited sources · optional AI help</span>
        </footer>
      </main>
    </div>
  );
}
