import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useMatch } from "react-router-dom";
import { RevisoMark } from "./components/Brand";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import SignIn from "./auth/SignIn";
import { accountFace } from "./lib/accountFace";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "selected" : "";

function AccountMenu() {
  const { user, signOut } = useAuth();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeIfOutside(event: MouseEvent) {
      const node = menu.current;
      if (node?.open && !node.contains(event.target as Node)) {
        node.open = false;
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
      }
    }
    window.addEventListener("pointerdown", closeIfOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeIfOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  if (!user) return null;
  const face = accountFace(user.user_id);
  const canSignOut = user.kind !== "local";
  const email =
    user.email && user.email !== user.display_name ? user.email : null;
  return (
    <details ref={menu} className="account-menu">
      <summary aria-label={user.display_name}>
        <img className="account-face" src={face} alt="" />
        <span className="nav-label">{user.display_name}</span>
      </summary>
      <div className="account-menu-panel">
        <p className="account-menu-name">{user.display_name}</p>
        {email && <p className="caption">{email}</p>}
        {canSignOut ? (
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : (
          <p className="caption">This computer’s local research identity.</p>
        )}
        <small>Reviso cannot place trades.</small>
      </div>
    </details>
  );
}

function AuthenticatedApp() {
  const { user, loading, error } = useAuth();
  const appExact = useMatch("/app/thesis/:id");
  const appNested = useMatch("/app/thesis/:id/*");
  const legacyExact = useMatch("/thesis/:id");
  const legacyNested = useMatch("/thesis/:id/*");
  const thesisId = (appExact ?? appNested ?? legacyExact ?? legacyNested)
    ?.params.id;
  const openIdea = Boolean(thesisId && thesisId !== "new");

  if (loading) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p className="empty" role="status">
            Opening your research…
          </p>
        </main>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand app-brand" to="/" aria-label="Reviso home">
          <RevisoMark />
          <span className="nav-word">Reviso</span>
        </Link>
        <nav aria-label="App sections">
          <NavLink
            to="/app"
            end
            title="My research"
            className={({ isActive }) =>
              isActive || openIdea ? "selected" : ""
            }
          >
            <span aria-hidden="true">▤</span>
            <span className="nav-label">My research</span>
          </NavLink>
          <NavLink
            to="/app/thesis/new"
            title="New research"
            className={navClass}
          >
            <span aria-hidden="true">＋</span>
            <span className="nav-label">New research</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <AccountMenu />
        </div>
      </aside>
      <main className="app-main">
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}

export default function AppLayout() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
