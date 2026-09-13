import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./AppLayout";
import MarketingLayout from "./MarketingLayout";
import Example from "./pages/Example";
import Guide from "./pages/Guide";
import Landing from "./pages/Landing";
import Library from "./pages/Library";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ThesisTimeline from "./pages/ThesisTimeline";
import Workspace from "./pages/Workspace";

export default function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<Landing />} />
        <Route path="example" element={<Example />} />
        <Route path="guide" element={<Guide />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="app" element={<Library />} />
        <Route path="app/thesis/new" element={<Workspace />} />
        <Route path="app/thesis/:id" element={<Workspace />} />
        <Route path="app/thesis/:id/timeline" element={<ThesisTimeline />} />
        {/* Keep links saved from the first demo working. */}
        <Route path="thesis/new" element={<Workspace />} />
        <Route path="thesis/:id" element={<Workspace />} />
        <Route path="thesis/:id/timeline" element={<ThesisTimeline />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
