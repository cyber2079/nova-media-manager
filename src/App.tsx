import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";

// Route-level code splitting — each page loaded on demand
const Home = lazy(() => import("@/pages/Home"));
const MovieLibrary = lazy(() => import("@/pages/MovieLibrary"));
const MovieRandom = lazy(() => import("@/pages/MovieRandom"));
const ImageLibrary = lazy(() => import("@/pages/ImageLibrary"));
const MusicLibrary = lazy(() => import("@/pages/MusicLibrary"));
const GameLibrary = lazy(() => import("@/pages/GameLibrary"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/movies" element={<Page><MovieLibrary /></Page>} />
          <Route path="/movies/random" element={<Page><MovieRandom /></Page>} />
          <Route path="/images" element={<Page><ImageLibrary /></Page>} />
          <Route path="/music" element={<Page><MusicLibrary /></Page>} />
          <Route path="/games" element={<Page><GameLibrary /></Page>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
