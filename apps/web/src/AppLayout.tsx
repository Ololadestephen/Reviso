import { Link, NavLink, Outlet, useMatch } from "react-router-dom";
import { RevisoMark } from "./components/Brand";

/** NavLink sets aria-current="page" itself; the class only carries the styling. */
const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "selected" : "";

export default function AppLayout() {
  const appExact = useMatch("/app/thesis/:id");
  const appNested = useMatch("/app/thesis/:id/*");
  const legacyExact = useMatch("/thesis/:id");
  const legacyNested = useMatch("/thesis/:id/*");
  const thesisId = (appExact ?? appNested ?? legacyExact ?? legacyNested)
    ?.params.id;
  const openIdea = Boolean(thesisId && thesisId !== "new");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand app-brand" to="/" aria-label="Reviso home">
          <RevisoMark />
          <span>Reviso</span>
        </Link>
        <nav aria-label="App sections">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              isActive || openIdea ? "selected" : ""
            }
          >
            <span aria-hidden="true">▤</span> <span>My research</span>
          </NavLink>
          <NavLink to="/app/thesis/new" className={navClass}>
            <span aria-hidden="true">＋</span> <span>New research</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <small>Reviso cannot place trades.</small>
          <Link className="sidebar-quiet" to="/guide">
            Guide
          </Link>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
