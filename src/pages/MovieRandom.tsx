import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMovieStore } from "@/stores/movieStore";
import SafeImage from "@/components/SafeImage";
import { Button } from "@/components/ui/button";
import { Shuffle, Library, Swords } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { useTranslation } from "react-i18next";

export default function MovieRandom() {
  const { t } = useTranslation();
  const { movies, loadMovies } = useMovieStore();
  const [displayMovies, setDisplayMovies] = useState<typeof movies>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadMovies();
  }, []);

  useEffect(() => {
    if (movies.length > 0) {
      setDisplayMovies([...movies].sort(() => Math.random() - 0.5).slice(0, 12));
    }
  }, [movies]);

  const refresh = () => {
    setDisplayMovies([...movies].sort(() => Math.random() - 0.5).slice(0, 12));
  };

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg">{t("movie.no_movies")}</p>
        <Button className="mt-4 gap-2" onClick={() => navigate("/movies")}>
          <NeonIcon name="Library" size={16}><Library className="h-4 w-4" /></NeonIcon> {t("home.enter_library")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl transition-all duration-500">
          {t("movie.discover")}
        </h1>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <NeonIcon name="Shuffle" size={16}><Shuffle className="h-4 w-4" /></NeonIcon> Random
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {displayMovies.map((movie, idx) => (
          <div
            key={movie.id}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-primary bg-surface-light transition-all hover:scale-[1.02]"
            style={{ animationDelay: idx * 50 + "ms" }}
            onClick={() => navigate("/movies")}
          >
            <div className="aspect-[2/3] overflow-hidden">
              {movie.coverPath && movie.status !== "processing" ? (
                <SafeImage src={movie.coverPath} alt={movie.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  fallback={<div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-lighter to-surface"><span className="text-4xl">🎬</span></div>} />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-lighter to-surface">
                  <span className="text-4xl">🎬</span>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="truncate text-sm font-medium">{movie.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
