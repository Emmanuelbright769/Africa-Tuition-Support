import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Info, Search, Crown, Home as HomeIcon, Grid3x3, Compass,
  ChevronLeft, ChevronRight, Star, Flame, X, Loader2, Lock, CheckCircle2,
} from "lucide-react";

type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: string;
  rating: number;
  genre: string;
  poster: string;
  backdrop: string;
  description: string;
};

const TMDB_W500 = "https://image.tmdb.org/t/p/w500";
const TMDB_BACK = "https://image.tmdb.org/t/p/original";

const MOVIES: Movie[] = [
  { id: "passion",        title: "The Passion of the Christ", year: 2004, runtime: "2h 7m",  rating: 7.5, genre: "Drama",        poster: `${TMDB_W500}/wuOgXjHfMx2KQjpDT4QzAOyArsy.jpg`, backdrop: `${TMDB_BACK}/xN7mFVYEkOPKQ57gXM3kTGPrKnq.jpg`, description: "A graphic portrayal of the last twelve hours of Jesus of Nazareth's life." },
  { id: "godfather",      title: "The Godfather",             year: 1972, runtime: "2h 55m", rating: 8.7, genre: "Drama",        poster: `${TMDB_W500}/3bhkrj58Vtu7enYsRolD1fZdja1.jpg`, backdrop: `${TMDB_BACK}/tmU7GeKVybMWFButWEGl2M4GeiP.jpg`, description: "The aging patriarch of an organized crime dynasty transfers control of his empire to his reluctant son." },
  { id: "shawshank",      title: "The Shawshank Redemption",  year: 1994, runtime: "2h 22m", rating: 8.7, genre: "Drama",        poster: `${TMDB_W500}/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg`, backdrop: `${TMDB_BACK}/9Xw0I5RV2ZqNLpul6lXKoviYg55.jpg`, description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency." },
  { id: "12-angry-men",   title: "12 Angry Men",               year: 1957, runtime: "1h 36m", rating: 8.6, genre: "Drama",        poster: `${TMDB_W500}/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg`, backdrop: `${TMDB_BACK}/qqHQsStV6exghCM7zbObuYBiYQ.jpg`,  description: "A jury holdout attempts to prevent a miscarriage of justice by forcing his colleagues to reconsider the evidence." },
  { id: "schindler",      title: "Schindler's List",           year: 1993, runtime: "3h 15m", rating: 8.6, genre: "Drama",        poster: `${TMDB_W500}/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg`, backdrop: `${TMDB_BACK}/loRmLIqBAtviRmUSh9JjCk7wSEX.jpg`, description: "In German-occupied Poland, an industrialist becomes concerned for his Jewish workforce after witnessing their persecution." },
  { id: "godfather-2",    title: "The Godfather Part II",      year: 1974, runtime: "3h 22m", rating: 8.6, genre: "Drama",        poster: `${TMDB_W500}/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg`, backdrop: `${TMDB_BACK}/kGzFbGhp99zva6oZODW5atUtnqi.jpg`, description: "The early life and career of Vito Corleone is portrayed while his son Michael expands the family business." },
  { id: "pulp",           title: "Pulp Fiction",                year: 1994, runtime: "2h 34m", rating: 8.5, genre: "Crime",        poster: `${TMDB_W500}/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg`, backdrop: `${TMDB_BACK}/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg`, description: "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption." },
  { id: "lotr-3",         title: "Lord of the Rings: Return of the King", year: 2003, runtime: "3h 21m", rating: 8.5, genre: "Fantasy", poster: `${TMDB_W500}/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg`, backdrop: `${TMDB_BACK}/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg`, description: "Gandalf and Aragorn lead the World of Men against Sauron's army to draw his gaze from Frodo and Sam." },
  { id: "fight-club",     title: "Fight Club",                  year: 1999, runtime: "2h 19m", rating: 8.4, genre: "Drama",        poster: `${TMDB_W500}/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg`, backdrop: `${TMDB_BACK}/52AfXWuXCHn3UjD17rBruA9f5qb.jpg`, description: "An insomniac office worker and a soap maker form an underground fight club that transforms into something much more." },
  { id: "forrest-gump",   title: "Forrest Gump",                year: 1994, runtime: "2h 22m", rating: 8.5, genre: "Drama",        poster: `${TMDB_W500}/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg`, backdrop: `${TMDB_BACK}/yE5d3BUhE8hCnkMUJOo1QDoOGNz.jpg`, description: "The presidencies of Kennedy and Johnson, the Vietnam War, and other historical events unfold from the perspective of an Alabama man." },
  { id: "good-bad-ugly",  title: "The Good, the Bad and the Ugly", year: 1966, runtime: "2h 58m", rating: 8.5, genre: "Western",     poster: `${TMDB_W500}/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg`, backdrop: `${TMDB_BACK}/oWNRVVjhE0kx1uaPtLT8ePpiq3I.jpg`, description: "A bounty hunting scam joins two men in an uneasy alliance against a third in a race to find a fortune in gold." },
  { id: "matrix",         title: "The Matrix",                  year: 1999, runtime: "2h 16m", rating: 8.2, genre: "Sci-Fi",       poster: `${TMDB_W500}/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg`, backdrop: `${TMDB_BACK}/icmmSD4vTTDKOq2vvdulafOGw93.jpg`, description: "A computer hacker learns about the true nature of his reality and his role in the war against its controllers." },
  { id: "inception",      title: "Inception",                   year: 2010, runtime: "2h 28m", rating: 8.4, genre: "Sci-Fi",       poster: `${TMDB_W500}/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg`, backdrop: `${TMDB_BACK}/s3TBrRGB1iav7gFOCNx3H31MoES.jpg`, description: "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea." },
  { id: "dark-knight",    title: "The Dark Knight",             year: 2008, runtime: "2h 32m", rating: 9.0, genre: "Action",       poster: `${TMDB_W500}/qJ2tW6WMUDux911r6m7haRef0WH.jpg`, backdrop: `${TMDB_BACK}/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg`, description: "When the menace known as The Joker wreaks havoc on Gotham, Batman must accept one of the greatest psychological tests." },
  { id: "interstellar",   title: "Interstellar",                year: 2014, runtime: "2h 49m", rating: 8.4, genre: "Sci-Fi",       poster: `${TMDB_W500}/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg`, backdrop: `${TMDB_BACK}/pbrkL804c8yAv3zBZR4QPEafpAR.jpg`, description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival." },
  { id: "endgame",        title: "Avengers: Endgame",           year: 2019, runtime: "3h 1m",  rating: 8.3, genre: "Action",       poster: `${TMDB_W500}/or06FN3Dka5tukK1e9sl16pB3iy.jpg`, backdrop: `${TMDB_BACK}/orjiB3oUIsyz60hoEqkiGpy5CeO.jpg`, description: "After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos' actions." },
  { id: "spider-verse",   title: "Spider-Man: Into the Spider-Verse", year: 2018, runtime: "1h 57m", rating: 8.4, genre: "Animation", poster: `${TMDB_W500}/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg`, backdrop: `${TMDB_BACK}/uUiId6cG32JSRI6RyBQSvQtLjz2.jpg`, description: "Teen Miles Morales becomes the Spider-Man of his universe and must join with five spider-powered individuals." },
  { id: "parasite",       title: "Parasite",                    year: 2019, runtime: "2h 12m", rating: 8.5, genre: "Drama",        poster: `${TMDB_W500}/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg`, backdrop: `${TMDB_BACK}/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg`, description: "Greed and class discrimination threaten the newly formed symbiotic relationship between two families." },
  { id: "gladiator",      title: "Gladiator",                   year: 2000, runtime: "2h 35m", rating: 8.5, genre: "Action",       poster: `${TMDB_W500}/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg`, backdrop: `${TMDB_BACK}/hND7xAaxxBgaIspp9iMsaEXEEAh.jpg`, description: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family." },
  { id: "lion-king",      title: "The Lion King",               year: 1994, runtime: "1h 28m", rating: 8.5, genre: "Animation",    poster: `${TMDB_W500}/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg`, backdrop: `${TMDB_BACK}/wXsQvli6tWqja51pYxXNG1LFIGV.jpg`, description: "Lion prince Simba and his father are targeted by his bitter uncle, who wants to ascend the throne himself." },
  { id: "avatar",         title: "Avatar",                      year: 2009, runtime: "2h 42m", rating: 7.6, genre: "Sci-Fi",       poster: `${TMDB_W500}/jRXYjXNq0Cs2TcJjLkki24MLp7u.jpg`, backdrop: `${TMDB_BACK}/Yc9q6QuWrMp9nuDm5R8ExNqbEWU.jpg`, description: "A paraplegic Marine dispatched to the moon Pandora becomes torn between his orders and protecting an alien civilization." },
  { id: "joker",          title: "Joker",                       year: 2019, runtime: "2h 2m",  rating: 8.2, genre: "Drama",        poster: `${TMDB_W500}/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg`, backdrop: `${TMDB_BACK}/n6bUvigpRFqSwmPp1m2YADdbRBc.jpg`, description: "In Gotham City, mentally troubled comedian Arthur Fleck embarks on a downward spiral of revolution." },
  { id: "titanic",        title: "Titanic",                     year: 1997, runtime: "3h 14m", rating: 7.9, genre: "Romance",      poster: `${TMDB_W500}/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg`, backdrop: `${TMDB_BACK}/yDI6D5ZQh67YU4r2ms8qcSbAviZ.jpg`, description: "A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious R.M.S. Titanic." },
  { id: "saving-private", title: "Saving Private Ryan",          year: 1998, runtime: "2h 49m", rating: 8.6, genre: "War",          poster: `${TMDB_W500}/uqx37cS8cpHg8U35f9U5IBlrCV3.jpg`, backdrop: `${TMDB_BACK}/jE5o7y9K6pZtWNNMEw3IdpHuncR.jpg`, description: "Following the Normandy Landings, a group of U.S. soldiers go behind enemy lines to retrieve a paratrooper." },
  { id: "green-mile",     title: "The Green Mile",               year: 1999, runtime: "3h 9m",  rating: 8.5, genre: "Drama",        poster: `${TMDB_W500}/8VG8fDNiy50H7FedNlpGbE8gPIa.jpg`, backdrop: `${TMDB_BACK}/u5Pa5zPJG2WzLDNTpGjEzfyEhd0.jpg`, description: "The lives of guards on Death Row are affected by one of their charges: a black man accused of rape and murder." },
  { id: "spirited-away",  title: "Spirited Away",                year: 2001, runtime: "2h 5m",  rating: 8.5, genre: "Animation",    poster: `${TMDB_W500}/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg`, backdrop: `${TMDB_BACK}/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg`, description: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods and witches." },
  { id: "departed",       title: "The Departed",                 year: 2006, runtime: "2h 31m", rating: 8.5, genre: "Crime",        poster: `${TMDB_W500}/nT97ifVT2J1yMQmeq20Qblg61T.jpg`, backdrop: `${TMDB_BACK}/lFSSLTlFozwpaGlO31OoUeirBgQ.jpg`, description: "An undercover cop and a mole in the police attempt to identify each other while infiltrating an Irish gang." },
  { id: "wolf-wall",      title: "The Wolf of Wall Street",      year: 2013, runtime: "3h",     rating: 8.2, genre: "Drama",        poster: `${TMDB_W500}/34m2tygAYBGqA9MXKhRDtzYd4MR.jpg`, backdrop: `${TMDB_BACK}/iaGVfaiUSn6QqWGgVe8TEhicRsv.jpg`, description: "Based on the true story of Jordan Belfort, from his rise to a wealthy stock-broker to his fall involving crime." },
  { id: "oppenheimer",    title: "Oppenheimer",                  year: 2023, runtime: "3h",     rating: 8.3, genre: "Drama",        poster: `${TMDB_W500}/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg`, backdrop: `${TMDB_BACK}/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg`, description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb." },
  { id: "dune",           title: "Dune: Part Two",               year: 2024, runtime: "2h 46m", rating: 8.5, genre: "Sci-Fi",       poster: `${TMDB_W500}/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg`, backdrop: `${TMDB_BACK}/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg`, description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family." },
];

const FEATURED_IDS = ["passion", "godfather", "dark-knight", "interstellar", "lotr-3", "endgame", "dune"];
const TRENDING_IDS = ["good-bad-ugly", "godfather-2", "pulp", "spider-verse", "matrix", "joker", "parasite", "oppenheimer", "dune", "spirited-away"];

const CATEGORIES = [
  { id: "Drama",     label: "Drama",     gradient: "from-rose-500 to-purple-600" },
  { id: "Action",    label: "Action",    gradient: "from-orange-500 to-red-600" },
  { id: "Sci-Fi",    label: "Sci-Fi",    gradient: "from-cyan-500 to-blue-700" },
  { id: "Crime",     label: "Crime",     gradient: "from-slate-700 to-zinc-900" },
  { id: "Animation", label: "Animation", gradient: "from-pink-500 to-amber-500" },
  { id: "Fantasy",   label: "Fantasy",   gradient: "from-emerald-500 to-teal-700" },
  { id: "Romance",   label: "Romance",   gradient: "from-pink-400 to-rose-600" },
  { id: "War",       label: "War",       gradient: "from-stone-600 to-zinc-900" },
  { id: "Western",   label: "Western",   gradient: "from-amber-700 to-yellow-900" },
];

type View = "home" | "browse" | "categories";

export default function MoviesSection() {
  const [view, setView] = useState<View>("home");
  const [heroIndex, setHeroIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string>("All");
  const [sort, setSort] = useState<"top" | "year" | "title">("top");
  const [selected, setSelected] = useState<Movie | null>(null);
  const [showInfo, setShowInfo] = useState<Movie | null>(null);
  const trendingRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const featured = useMemo(() => MOVIES.filter(m => FEATURED_IDS.includes(m.id)), []);
  const trending = useMemo(() => MOVIES.filter(m => TRENDING_IDS.includes(m.id)), []);

  // Subscription state — reuses existing $5/month Movies API
  const { data: subData, refetch: refetchSub } = useQuery<{ subscription: any | null }>({
    queryKey: ["/api/movies/subscription"],
  });
  const isSubscribed = subData?.subscription && new Date(subData.subscription.expiresAt) > new Date();

  const subscribeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/movies/subscribe").then(r => r.json()),
    onSuccess: (data: any) => {
      if (data?.message && !data?.subscription) {
        toast({ title: "Subscription failed", description: data.message, variant: "destructive" });
        return;
      }
      toast({ title: "Welcome to Zynema Premium!", description: "Stream freely. Watch legally." });
      refetchSub().then(() => setSelected(null));
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    },
    onError: (e: any) => toast({
      title: "Subscription failed",
      description: e?.message || "Insufficient wallet balance. Add at least $5 to continue.",
      variant: "destructive",
    }),
  });

  // Auto-rotate hero
  useEffect(() => {
    const t = setInterval(() => setHeroIndex(i => (i + 1) % featured.length), 7000);
    return () => clearInterval(t);
  }, [featured.length]);

  const browseMovies = useMemo(() => {
    let list = MOVIES.filter(m =>
      (genreFilter === "All" || m.genre === genreFilter) &&
      (search === "" || m.title.toLowerCase().includes(search.toLowerCase()))
    );
    if (sort === "top") list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === "year") list = [...list].sort((a, b) => b.year - a.year);
    if (sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [genreFilter, search, sort]);

  const handleWatch = (m: Movie) => {
    if (!isSubscribed) {
      setSelected(m);
      return;
    }
    setShowInfo(m);
    toast({ title: `Now playing: ${m.title}`, description: "Enjoy the show on Zynema Premium." });
  };

  const scrollTrending = (dir: "left" | "right") => {
    if (!trendingRef.current) return;
    trendingRef.current.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };

  const hero = featured[heroIndex];

  return (
    <div className="-mx-4 sm:-mx-6 -my-4 sm:-my-6 rounded-xl overflow-hidden" style={{ background: "#0a0e1a" }} data-testid="zynema-root">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0a0e1a]/80 border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4">
          <button onClick={() => setView("home")} className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#fbbf24", fontFamily: "Georgia, serif" }} data-testid="link-zynema-logo">
            Zynema
          </button>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {([
              { id: "home", label: "Home", icon: HomeIcon },
              { id: "browse", label: "Browse", icon: Compass },
              { id: "categories", label: "Categories", icon: Grid3x3 },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => setView(id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${view === id ? "text-white" : "text-gray-400 hover:text-white"}`}
                data-testid={`nav-${id}`}>
                {label}
              </button>
            ))}
            <button className="px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors text-[#fbbf24] hover:text-[#fcd34d]"
              onClick={() => !isSubscribed && setSelected(featured[0])}
              data-testid="nav-premium">
              <Crown className="w-4 h-4" /> Premium
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(s => !s)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:bg-white/5" data-testid="btn-search">
              <Search className="w-4 h-4" />
            </button>
            {isSubscribed ? (
              <span className="px-3 sm:px-4 py-1.5 rounded-lg bg-[#fbbf24]/15 text-[#fbbf24] text-xs sm:text-sm font-semibold flex items-center gap-1.5 border border-[#fbbf24]/30" data-testid="badge-premium-active">
                <CheckCircle2 className="w-3.5 h-3.5" /> Premium
              </span>
            ) : (
              <button onClick={() => setSelected(featured[0])} className="px-3 sm:px-4 py-1.5 rounded-lg bg-[#fbbf24] text-black text-xs sm:text-sm font-semibold hover:bg-[#fcd34d] transition-colors" data-testid="btn-signin">
                Sign In
              </button>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-3 text-xs overflow-x-auto">
          {([
            { id: "home", label: "Home" },
            { id: "browse", label: "Browse" },
            { id: "categories", label: "Categories" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)}
              className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${view === id ? "bg-white/10 text-white" : "text-gray-400"}`}>
              {label}
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1 text-[#fbbf24]" onClick={() => !isSubscribed && setSelected(featured[0])}>
            <Crown className="w-3 h-3" /> Premium
          </button>
        </div>
        {/* Search bar */}
        {searchOpen && (
          <div className="px-4 sm:px-8 pb-3 border-t border-white/5">
            <input
              autoFocus value={search}
              onChange={e => { setSearch(e.target.value); if (view !== "browse") setView("browse"); }}
              placeholder="Search movies…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#fbbf24]/50"
              data-testid="input-search"
            />
          </div>
        )}
      </header>

      {/* ── HOME VIEW ──────────────────────────────────────────────────── */}
      {view === "home" && (
        <>
          {/* Hero */}
          <div className="relative h-[70vh] min-h-[480px] overflow-hidden">
            {featured.map((m, i) => (
              <div key={m.id}
                className="absolute inset-0 transition-opacity duration-1000"
                style={{ opacity: i === heroIndex ? 1 : 0 }}>
                <img src={m.backdrop} alt="" className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(10,14,26,0.95) 0%, rgba(10,14,26,0.7) 40%, rgba(10,14,26,0.2) 100%)" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, #0a0e1a 0%, transparent 30%)" }} />
              </div>
            ))}
            <div className="relative h-full flex items-end pb-16 sm:pb-20 px-4 sm:px-12">
              <div className="max-w-2xl text-white">
                <div className="flex items-center gap-3 text-xs font-bold tracking-widest mb-3">
                  <span className="text-[#fbbf24]">FEATURED</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">{hero.year}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">{hero.runtime}</span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-bold mb-4 leading-tight" style={{ fontFamily: "Georgia, serif" }} data-testid={`text-hero-title-${hero.id}`}>
                  {hero.title}
                </h1>
                <p className="text-sm sm:text-base text-gray-300 mb-5 max-w-xl leading-relaxed">{hero.description}</p>
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-2.5 py-1 rounded bg-white/10 text-xs text-gray-200">{hero.genre}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-[#fbbf24]">
                    <Star className="w-4 h-4 fill-[#fbbf24]" /> {hero.rating.toFixed(1)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => handleWatch(hero)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#fbbf24] text-black font-bold hover:bg-[#fcd34d] transition-colors shadow-lg"
                    data-testid={`btn-watch-${hero.id}`}>
                    <Play className="w-5 h-5 fill-black" /> Watch Now
                  </button>
                  <button onClick={() => setShowInfo(hero)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-colors backdrop-blur"
                    data-testid={`btn-info-${hero.id}`}>
                    <Info className="w-5 h-5" /> More Info
                  </button>
                </div>
                {/* Carousel dots */}
                <div className="flex gap-2 mt-8">
                  {featured.map((_, i) => (
                    <button key={i} onClick={() => setHeroIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${i === heroIndex ? "w-8 bg-[#fbbf24]" : "w-2 bg-white/30"}`}
                      data-testid={`dot-hero-${i}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Trending Now */}
          <section className="px-4 sm:px-8 py-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#fbbf24]" /> Trending Now
              </h2>
              <div className="flex gap-2">
                <button onClick={() => scrollTrending("left")} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center" data-testid="btn-scroll-left">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => scrollTrending("right")} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center" data-testid="btn-scroll-right">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div ref={trendingRef} className="flex gap-4 overflow-x-auto pb-3 -mx-4 sm:-mx-8 px-4 sm:px-8 scroll-smooth" style={{ scrollbarWidth: "none" }}>
              {trending.map(m => <PosterCard key={m.id} movie={m} onClick={() => setShowInfo(m)} />)}
            </div>
          </section>

          {/* Top Rated */}
          <section className="px-4 sm:px-8 py-6 pb-12">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-5">Top Rated</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...MOVIES].sort((a, b) => b.rating - a.rating).slice(0, 12).map(m => (
                <PosterCard key={m.id} movie={m} onClick={() => setShowInfo(m)} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── BROWSE VIEW ────────────────────────────────────────────────── */}
      {view === "browse" && (
        <div className="px-4 sm:px-8 py-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6" style={{ fontFamily: "Georgia, serif" }}>Browse Movies</h1>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 mb-6">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search movies…"
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#fbbf24]/50"
              data-testid="input-browse-search" />
            <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#fbbf24]/50"
              data-testid="select-genre">
              <option value="All">All</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#fbbf24]/50"
              data-testid="select-sort">
              <option value="top">Top Rated</option>
              <option value="year">Newest</option>
              <option value="title">A–Z</option>
            </select>
          </div>
          <p className="text-sm text-gray-400 mb-5" data-testid="text-results-count">{browseMovies.length} movies found</p>
          {browseMovies.length === 0 ? (
            <p className="text-center text-gray-500 py-20">No movies match your search.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {browseMovies.map(m => <PosterCard key={m.id} movie={m} onClick={() => setShowInfo(m)} />)}
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORIES VIEW ───────────────────────────────────────────── */}
      {view === "categories" && (
        <div className="px-4 sm:px-8 py-8 pb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>Categories</h1>
          <p className="text-sm text-gray-400 mb-8">Stream freely. Watch legally.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {CATEGORIES.map(cat => {
              const count = MOVIES.filter(m => m.genre === cat.id).length;
              return (
                <button key={cat.id}
                  onClick={() => { setGenreFilter(cat.id); setView("browse"); }}
                  className={`relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br ${cat.gradient} text-white text-left p-5 hover:scale-[1.02] transition-transform`}
                  data-testid={`card-category-${cat.id}`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative">
                    <p className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>{cat.label}</p>
                    <p className="text-xs opacity-80 mt-1">{count} {count === 1 ? "movie" : "movies"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PREMIUM PAYWALL MODAL ─────────────────────────────────────── */}
      {selected && !isSubscribed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelected(null)} data-testid="modal-paywall">
          <div className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#0f1424" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80" data-testid="btn-close-paywall">
              <X className="w-4 h-4" />
            </button>
            <div className="relative h-40">
              <img src={selected.backdrop} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1424] via-transparent to-transparent" />
            </div>
            <div className="p-6 text-white -mt-12 relative">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: "#fbbf24" }}>
                <Crown className="w-7 h-7 text-black" />
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>Zynema Premium</h3>
              <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                Stream <span className="text-[#fbbf24] font-semibold">{selected.title}</span> and the entire Zynema library — unlimited HD streaming, no ads, cancel anytime.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6 text-xs">
                {["Unlimited streaming", "All movies & shows", "HD & 4K quality", "Cancel anytime"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" /> <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-white">$5</span>
                <span className="text-sm text-gray-400">/month · charged to your TSIA wallet</span>
              </div>
              <button onClick={() => subscribeMutation.mutate()} disabled={subscribeMutation.isPending}
                className="w-full py-3 rounded-lg bg-[#fbbf24] text-black font-bold hover:bg-[#fcd34d] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                data-testid="btn-subscribe">
                {subscribeMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><Crown className="w-4 h-4" /> Activate Premium — $5/month</>}
              </button>
              <p className="text-[11px] text-center text-gray-500 mt-3">Charged from your TSIA SwiftWallet balance.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── MOVIE INFO / PLAYER MODAL ─────────────────────────────────── */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto" onClick={() => setShowInfo(null)} data-testid="modal-movie-info">
          <div className="relative max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl my-8" style={{ background: "#0f1424" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowInfo(null)} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90" data-testid="btn-close-info">
              <X className="w-4 h-4" />
            </button>
            <div className="relative h-56 sm:h-72">
              <img src={showInfo.backdrop} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1424] via-[#0f1424]/40 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <h2 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: "Georgia, serif" }}>{showInfo.title}</h2>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-300">{showInfo.year}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">{showInfo.runtime}</span>
                  <span className="text-gray-500">•</span>
                  <span className="px-2 py-0.5 rounded bg-white/10">{showInfo.genre}</span>
                  <span className="flex items-center gap-1 text-[#fbbf24] font-semibold">
                    <Star className="w-3.5 h-3.5 fill-[#fbbf24]" /> {showInfo.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6 text-white">
              <p className="text-sm text-gray-300 leading-relaxed mb-5">{showInfo.description}</p>
              {isSubscribed ? (
                <div className="space-y-3">
                  <div className="aspect-video rounded-xl bg-black flex flex-col items-center justify-center text-gray-400 border border-white/5">
                    <Play className="w-14 h-14 text-[#fbbf24] fill-[#fbbf24] mb-3" />
                    <p className="text-sm font-semibold text-white">Now Streaming</p>
                    <p className="text-xs text-gray-500 mt-1">{showInfo.title} — Premium Quality</p>
                  </div>
                  <p className="text-[11px] text-center text-gray-500">Premium active — enjoy unlimited streaming on Zynema.</p>
                </div>
              ) : (
                <button onClick={() => { setShowInfo(null); setSelected(showInfo); }}
                  className="w-full py-3 rounded-lg bg-[#fbbf24] text-black font-bold hover:bg-[#fcd34d] transition-colors flex items-center justify-center gap-2"
                  data-testid="btn-info-subscribe">
                  <Lock className="w-4 h-4" /> Unlock with Premium — $5/month
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PosterCard({ movie, onClick }: { movie: Movie; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group text-left flex-shrink-0 w-36 sm:w-44" data-testid={`card-movie-${movie.id}`}>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 mb-2 shadow-lg group-hover:scale-[1.04] transition-transform">
        <img src={movie.poster} alt={movie.title} loading="lazy" className="w-full h-full object-cover" />
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[#fbbf24] text-[11px] font-bold flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 fill-[#fbbf24]" /> {movie.rating.toFixed(1)}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
          <div className="px-3 py-1.5 rounded-full bg-[#fbbf24] text-black text-xs font-bold flex items-center gap-1">
            <Play className="w-3 h-3 fill-black" /> Watch
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
      <p className="text-xs text-gray-400">{movie.year} · {movie.genre}</p>
    </button>
  );
}
