export interface Movie {
  id: string;
  title: string;
  posterUrl: string;
  version: string[];
  runtime: number;
  description: string;
  director: string;
  cast: string[];
  genres: string[];
  releaseDate: string;
  endDate: string;
  trailerUrl: string;
  rating: number;
}

export interface Showtime {
  id: string;
  movieId: string;
  date: string;
  time: string;
  hall: string;
  format: string;
  availableSeats: number;
  totalSeats: number;
}

export interface SeatData {
  id: string;
  row: string;
  number: number;
  type: "normal" | "vip" | "couple";
  status: "available" | "occupied" | "held" | "held_by_you";
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  bannerColor: string;
  bannerUrl: string | null;
  discount: string;

  // Match Django API response (from Code 1)
  promotionType: "USER" | "MOVIE" | "FLAT_PRICE";
  code?: string;
  flat_price?: number;
}

export interface ConcessionVariant {
  id: string;
  concessionId: string;
  name: string;
  basePrice: number;
  inComboPrice: number;
  sku: string;
  isActive: boolean;
}

export interface Concession {
  id: string;
  name: string;
  category: string;
  categoryDisplayName?: string;
  description: string;
  isActive: boolean;
  isCombo: boolean;
  variants: ConcessionVariant[];
  imageUrl?: string | null;
  priority: number;
}

export interface BookedTicket {
  id: string;
  movieTitle: string;
  bookingDate: string;
  showDate: string;
  showTime: string;
  hall: string;
  seats: string;
  total: number;
  status: "confirmed" | "used" | "cancelled";
}

export interface PointsRecord {
  id: string;
  date: string;
  movieTitle: string;
  type: "added" | "used";
  points: number;
  description: string;
}

export const SEAT_PRICES: Record<string, number> = {
  normal: 75000,
  vip: 120000,
  couple: 180000,
};

export const movies: Movie[] = [
  {
    id: "m1",
    title: "Galactic Odyssey",
    posterUrl: "",
    version: ["2D", "IMAX"],
    runtime: 148,
    description:
      "A team of explorers ventures beyond the known galaxy to find a new home for humanity. Stunning visuals and an emotional narrative that will keep you on the edge of your seat.",
    director: "Sarah Chen",
    cast: ["Alex Rivera", "Maya Johnson", "Thomas Park", "Lisa Wong"],
    genres: ["Sci-Fi", "Adventure", "Drama"],
    releaseDate: "2026-02-01",
    endDate: "2026-04-30",
    trailerUrl: "https://www.youtube.com/watch?v=example1",
    rating: 8.5,
  },
  {
    id: "m2",
    title: "The Last Detective",
    posterUrl: "",
    version: ["2D"],
    runtime: 122,
    description:
      "A retired detective is pulled back into the world of crime when a series of mysterious disappearances strikes his quiet hometown.",
    director: "Marcus Williams",
    cast: ["David Chen", "Rachel Adams", "James O'Brien"],
    genres: ["Thriller", "Mystery"],
    releaseDate: "2026-01-15",
    endDate: "2026-03-30",
    trailerUrl: "https://www.youtube.com/watch?v=example2",
    rating: 7.8,
  },
  {
    id: "m3",
    title: "Dragon's Keep",
    posterUrl: "",
    version: ["2D", "3D", "IMAX"],
    runtime: 135,
    description:
      "In a magical kingdom, a young blacksmith discovers she can communicate with dragons and must unite the realm against an ancient threat.",
    director: "Elena Rossi",
    cast: ["Sophie Turner", "Michael B. Cole", "An Nguyen", "Carlos Mendez"],
    genres: ["Fantasy", "Action", "Adventure"],
    releaseDate: "2026-02-14",
    endDate: "2026-05-15",
    trailerUrl: "https://www.youtube.com/watch?v=example3",
    rating: 8.2,
  },
  {
    id: "m4",
    title: "Midnight in Paris Again",
    posterUrl: "",
    version: ["2D"],
    runtime: 108,
    description:
      "A modern-day artist finds a mysterious clock that transports her to 1920s Paris, where she meets legendary creatives who change her perspective on life.",
    director: "Jean-Luc Martin",
    cast: ["Emma Laurent", "Pierre Dubois", "Isabelle Moreau"],
    genres: ["Romance", "Drama", "Fantasy"],
    releaseDate: "2026-02-10",
    endDate: "2026-04-10",
    trailerUrl: "https://www.youtube.com/watch?v=example4",
    rating: 7.6,
  },
  {
    id: "m5",
    title: "Speed Circuit",
    posterUrl: "",
    version: ["2D", "IMAX"],
    runtime: 130,
    description:
      "An underdog racing team takes on the world's most dangerous circuit in a high-octane battle for glory, redemption, and survival.",
    director: "Carlos Ramirez",
    cast: ["Jake Hunter", "Aisha Patel", "Bruno Fernandez"],
    genres: ["Action", "Sports", "Drama"],
    releaseDate: "2026-01-20",
    endDate: "2026-04-01",
    trailerUrl: "https://www.youtube.com/watch?v=example5",
    rating: 7.9,
  },
  {
    id: "m6",
    title: "Whispers in the Dark",
    posterUrl: "",
    version: ["2D"],
    runtime: 98,
    description:
      "A group of college friends rent a remote cabin for a weekend getaway, only to discover that the forest holds terrifying secrets.",
    director: "Kim Soo-Jin",
    cast: ["Emily Tran", "Marcus Lee", "Ava Brooks"],
    genres: ["Horror", "Thriller"],
    releaseDate: "2026-02-20",
    endDate: "2026-04-20",
    trailerUrl: "https://www.youtube.com/watch?v=example6",
    rating: 7.2,
  },
  {
    id: "m7",
    title: "The Grand Heist",
    posterUrl: "",
    version: ["2D", "3D"],
    runtime: 142,
    description:
      "A charismatic thief assembles an unlikely crew for the most ambitious museum heist in history, but nothing goes according to plan.",
    director: "Raj Kapoor",
    cast: ["Daniel Kim", "Sofia Reyes", "Oliver Stone", "Mei Lin"],
    genres: ["Action", "Comedy", "Crime"],
    releaseDate: "2026-02-05",
    endDate: "2026-04-25",
    trailerUrl: "https://www.youtube.com/watch?v=example7",
    rating: 8.0,
  },
  {
    id: "m8",
    title: "Ocean's Lullaby",
    posterUrl: "",
    version: ["2D", "IMAX"],
    runtime: 115,
    description:
      "A marine biologist and a fisherman form an unlikely bond while fighting to protect a pod of endangered whales from industrial threats.",
    director: "Anna Svensson",
    cast: ["Chris Hemsworth", "Yuna Kim", "Robert Santos"],
    genres: ["Drama", "Adventure"],
    releaseDate: "2026-01-25",
    endDate: "2026-03-25",
    trailerUrl: "https://www.youtube.com/watch?v=example8",
    rating: 7.4,
  },
];

function generateDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const halls = ["Hall A", "Hall B", "Hall C"];
const times = ["10:00", "13:30", "16:00", "19:00", "21:30"];

export function getShowtimesForMovie(movieId: string): Showtime[] {
  const movie = movies.find((m) => m.id === movieId);
  if (!movie) return [];

  const dates = generateDates();
  const showtimes: Showtime[] = [];
  let counter = 1;

  for (const date of dates) {
    for (let i = 0; i < 3; i++) {
      const hall = halls[i % halls.length];
      const time = times[(counter + i) % times.length];
      const format = movie.version[i % movie.version.length];

      showtimes.push({
        id: `st-${movieId}-${counter}`,
        movieId,
        date,
        time,
        hall,
        format,
        availableSeats: 60 + Math.floor(Math.random() * 30),
        totalSeats: 96,
      });

      counter++;
    }
  }

  return showtimes;
}

/**
 * Seat map merge note:
 * - Keep VIP logic from both
 * - Improve couple logic (based on Code 2):
 *   Row H (r===7):
 *     - odd seats => "couple"
 *     - even seats => "occupied" (avoid selecting single seat in couple row)
 */
export function generateSeatMap(showtimeId: string): SeatData[] {
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const seatsPerRow = 12;
  const seats: SeatData[] = [];
  const seed = showtimeId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  for (let r = 0; r < rows.length; r++) {
    for (let s = 1; s <= seatsPerRow; s++) {
      const hash = (seed + r * seatsPerRow + s) % 100;
      let type: SeatData["type"] = "normal";
      let status: SeatData["status"] = "available";

      // VIP block
      if (r >= 2 && r <= 4 && s >= 4 && s <= 9) {
        type = "vip";
      }

      // Couple row rule: odd seats are the left seat of a couple pair;
      // even seats are the paired slot (always occupied, never rendered standalone).
      if (r === 7) {
        if (s % 2 === 1 && s < seatsPerRow) {
          type = "couple";
        } else {
          status = "occupied";
        }
      }

      // Random bookings — only affects status, never the physical seat type.
      if (hash < 20) {
        status = "occupied";
      }

      seats.push({
        id: `${showtimeId}-${rows[r]}${s}`,
        row: rows[r],
        number: s,
        type,
        status,
      });
    }
  }

  return seats;
}

export const promotions: Promotion[] = [
  {
    id: "p1",
    title: "Student Discount Week",
    description:
      "Show your valid student ID and get 30% off on all weekday screenings. Valid for Normal and VIP seats.",
    startDate: "2026-02-15",
    endDate: "2026-03-01",
    bannerColor: "bg-gradient-to-r from-primary/10 to-accent/20",
    discount: "30% off",
    bannerUrl: "",
    promotionType: "USER",
  },
  {
    id: "p2",
    title: "IMAX Double Feature",
    description:
      "Buy 1 IMAX ticket, get the second screening at 50% off. Perfect for a full day of cinema magic.",
    startDate: "2026-02-20",
    endDate: "2026-03-15",
    bannerColor: "bg-gradient-to-r from-primary/15 to-primary/5",
    discount: "50% off 2nd",
    bannerUrl: "",
    promotionType: "MOVIE",
  },
  {
    id: "p3",
    title: "Valentine's Couple Pack",
    description:
      "Special couple seats with complimentary popcorn and drinks. A romantic movie night made easy.",
    startDate: "2026-02-10",
    endDate: "2026-02-28",
    bannerColor: "bg-gradient-to-r from-pink-50 to-accent/10",
    discount: "Free snacks",
    bannerUrl: "",
    promotionType: "USER",
  },
  {
    id: "p4",
    title: "Member Points Bonus",
    description:
      "Earn 2x points on all bookings this month. Stack your points faster and redeem for free tickets.",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    bannerColor: "bg-gradient-to-r from-accent/20 to-accent/5",
    discount: "2x points",
    bannerUrl: "",
    promotionType: "USER",
  },
  {
    id: "p5",
    title: "Early Bird Special",
    description:
      "All screenings before 12:00 PM are 20% off. Start your day with a great movie at a great price.",
    startDate: "2026-02-01",
    endDate: "2026-03-31",
    bannerColor: "bg-gradient-to-r from-primary/5 to-accent/15",
    discount: "20% off",
    bannerUrl: "",
    promotionType: "USER",
  },
];

export const bookedTickets: BookedTicket[] = [
  {
    id: "BK-20260215-001",
    movieTitle: "Galactic Odyssey",
    bookingDate: "2026-02-15",
    showDate: "2026-02-18",
    showTime: "19:00",
    hall: "Hall A",
    seats: "D5, D6",
    total: 36,
    status: "confirmed",
  },
  {
    id: "BK-20260210-002",
    movieTitle: "The Grand Heist",
    bookingDate: "2026-02-10",
    showDate: "2026-02-12",
    showTime: "21:30",
    hall: "Hall B",
    seats: "C4, C5, C6",
    total: 54,
    status: "used",
  },
  {
    id: "BK-20260205-003",
    movieTitle: "Dragon's Keep",
    bookingDate: "2026-02-05",
    showDate: "2026-02-08",
    showTime: "16:00",
    hall: "Hall C",
    seats: "E7",
    total: 18,
    status: "used",
  },
  {
    id: "BK-20260201-004",
    movieTitle: "Speed Circuit",
    bookingDate: "2026-02-01",
    showDate: "2026-02-03",
    showTime: "13:30",
    hall: "Hall A",
    seats: "A1, A2",
    total: 20,
    status: "cancelled",
  },
];

export const pointsHistory: PointsRecord[] = [
  {
    id: "pt1",
    date: "2026-02-15",
    movieTitle: "Galactic Odyssey",
    type: "added",
    points: 36,
    description: "Earned from booking BK-20260215-001",
  },
  {
    id: "pt2",
    date: "2026-02-10",
    movieTitle: "The Grand Heist",
    type: "added",
    points: 54,
    description: "Earned from booking BK-20260210-002",
  },
  {
    id: "pt3",
    date: "2026-02-08",
    movieTitle: "Dragon's Keep",
    type: "used",
    points: 100,
    description: "Redeemed for discount on booking",
  },
  {
    id: "pt4",
    date: "2026-02-05",
    movieTitle: "Dragon's Keep",
    type: "added",
    points: 18,
    description: "Earned from booking BK-20260205-003",
  },
  {
    id: "pt5",
    date: "2026-02-01",
    movieTitle: "Speed Circuit",
    type: "added",
    points: 20,
    description: "Earned from booking BK-20260201-004",
  },
  {
    id: "pt6",
    date: "2026-01-25",
    movieTitle: "",
    type: "added",
    points: 500,
    description: "Welcome bonus for new member",
  },
];

// Keep upcomingMovies from Code 1
export const upcomingMovies: Movie[] = [
  {
    id: "u1",
    title: "Neon Horizon",
    posterUrl: "",
    version: ["2D", "IMAX"],
    runtime: 138,
    description:
      "In a sprawling cyberpunk metropolis, a rogue hacker uncovers a conspiracy that could rewrite the fabric of reality itself.",
    director: "Yuki Tanaka",
    cast: ["Keanu Reeves", "Rinko Kikuchi", "John Boyega"],
    genres: ["Sci-Fi", "Action", "Thriller"],
    releaseDate: "2026-03-20",
    endDate: "2026-06-20",
    trailerUrl: "https://www.youtube.com/watch?v=example-u1",
    rating: 0,
  },
  {
    id: "u2",
    title: "The Forgotten Kingdom",
    posterUrl: "",
    version: ["2D", "3D", "IMAX"],
    runtime: 152,
    description:
      "An archaeologist stumbles upon a hidden civilization beneath the Sahara, awakening forces that have slumbered for millennia.",
    director: "Ava DuVernay",
    cast: ["Idris Elba", "Lupita Nyong'o", "Oscar Isaac"],
    genres: ["Adventure", "Fantasy", "Drama"],
    releaseDate: "2026-04-10",
    endDate: "2026-07-10",
    trailerUrl: "https://www.youtube.com/watch?v=example-u2",
    rating: 0,
  },
  {
    id: "u3",
    title: "Silent Frequencies",
    posterUrl: "",
    version: ["2D"],
    runtime: 105,
    description:
      "A deaf musician discovers she can hear transmissions from another dimension through her cochlear implant, pulling her into a world of secrets.",
    director: "Park Chan-wook",
    cast: ["Florence Pugh", "Steven Yeun", "Tilda Swinton"],
    genres: ["Thriller", "Mystery", "Sci-Fi"],
    releaseDate: "2026-03-28",
    endDate: "2026-06-01",
    trailerUrl: "https://www.youtube.com/watch?v=example-u3",
    rating: 0,
  },
  {
    id: "u4",
    title: "Wildfire Hearts",
    posterUrl: "",
    version: ["2D", "IMAX"],
    runtime: 118,
    description:
      "Two rival wildfire fighters must set aside their differences when a record-breaking blaze threatens a mountain town and everyone they love.",
    director: "Denis Villeneuve",
    cast: ["Zendaya", "Pedro Pascal", "Jenna Ortega"],
    genres: ["Action", "Drama", "Romance"],
    releaseDate: "2026-04-25",
    endDate: "2026-07-25",
    trailerUrl: "https://www.youtube.com/watch?v=example-u4",
    rating: 0,
  },
];

export const moviePosters: Record<string, { gradient: string; icon: string }> =
  {
    m1: {
      gradient: "from-indigo-900 via-blue-800 to-cyan-700",
      icon: "Rocket",
    },
    m2: { gradient: "from-gray-900 via-gray-700 to-amber-900", icon: "Search" },
    m3: {
      gradient: "from-emerald-900 via-green-700 to-amber-600",
      icon: "Flame",
    },
    m4: { gradient: "from-pink-800 via-rose-600 to-amber-500", icon: "Heart" },
    m5: { gradient: "from-red-900 via-orange-700 to-yellow-600", icon: "Zap" },
    m6: { gradient: "from-gray-900 via-purple-900 to-gray-800", icon: "Moon" },
    m7: {
      gradient: "from-amber-900 via-yellow-700 to-amber-500",
      icon: "Diamond",
    },
    m8: { gradient: "from-sky-900 via-blue-700 to-teal-500", icon: "Waves" },
  };

export const concessionPosters: Record<
  string,
  { gradient: string; icon: string }
> = {
  c1: { gradient: "from-amber-900 via-orange-700 to-red-600", icon: "Flame" },
  c2: { gradient: "from-blue-900 via-cyan-700 to-blue-500", icon: "Waves" },
  c3: { gradient: "from-yellow-900 via-amber-700 to-orange-600", icon: "Zap" },
  c4: {
    gradient: "from-orange-900 via-orange-700 to-amber-600",
    icon: "Flame",
  },
  c5: {
    gradient: "from-yellow-800 via-amber-700 to-orange-600",
    icon: "Diamond",
  },
  c6: { gradient: "from-rose-900 via-red-700 to-orange-600", icon: "Heart" },
};

export const concessions: Concession[] = [
  {
    id: "c1",
    name: "Cola",
    category: "drink",
    categoryDisplayName: "Drinks",
    description: "Drinks: Cola",
    isActive: true,
    isCombo: false,
    priority: 0.5,
    variants: [
      {
        id: "cv1",
        concessionId: "c1",
        name: "330ml",
        basePrice: 20000,
        inComboPrice: 15000,
        sku: "COLA-330ML",
        isActive: true,
      },
      {
        id: "cv2",
        concessionId: "c1",
        name: "500ml",
        basePrice: 25000,
        inComboPrice: 18000,
        sku: "COLA-500ML",
        isActive: true,
      },
    ],
  },
  {
    id: "c2",
    name: "Mineral Water",
    category: "drink",
    categoryDisplayName: "Drinks",
    description: "Drinks: Mineral Water",
    isActive: true,
    isCombo: false,
    priority: 0.3,
    variants: [
      {
        id: "cv3",
        concessionId: "c2",
        name: "500ml",
        basePrice: 15000,
        inComboPrice: 12000,
        sku: "WATER-500ML",
        isActive: true,
      },
    ],
  },
  {
    id: "c3",
    name: "Chocolate Popcorn",
    category: "snack",
    categoryDisplayName: "Snacks",
    description: "Snacks: Chocolate Popcorn",
    isActive: true,
    isCombo: false,
    priority: 0.4,
    variants: [
      {
        id: "cv4",
        concessionId: "c3",
        name: "Kid Size",
        basePrice: 10000,
        inComboPrice: 8000,
        sku: "PC-CH-S",
        isActive: true,
      },
      {
        id: "cv5",
        concessionId: "c3",
        name: "Party Size",
        basePrice: 15000,
        inComboPrice: 12000,
        sku: "PC-CH-L",
        isActive: true,
      },
    ],
  },
  {
    id: "c4",
    name: "Nachos",
    category: "snack",
    categoryDisplayName: "Snacks",
    description: "Snacks: Nachos",
    isActive: true,
    isCombo: false,
    priority: 0.2,
    variants: [
      {
        id: "cv6",
        concessionId: "c4",
        name: "Standard",
        basePrice: 40000,
        inComboPrice: 30000,
        sku: "NACHOS-STANDARD",
        isActive: true,
      },
      {
        id: "cv7",
        concessionId: "c4",
        name: "Large",
        basePrice: 60000,
        inComboPrice: 48000,
        sku: "NACHOS-LARGE",
        isActive: true,
      },
    ],
  },
  {
    id: "c5",
    name: "Popcorn",
    category: "snack",
    categoryDisplayName: "Snacks",
    description: "Snacks: Popcorn",
    isActive: true,
    isCombo: false,
    priority: 0.7,
    variants: [
      {
        id: "cv8",
        concessionId: "c5",
        name: "Small",
        basePrice: 30000,
        inComboPrice: 25000,
        sku: "POPCORN-SMALL",
        isActive: true,
      },
      {
        id: "cv9",
        concessionId: "c5",
        name: "Medium",
        basePrice: 45000,
        inComboPrice: 35000,
        sku: "POPCORN-MEDIUM",
        isActive: true,
      },
      {
        id: "cv10",
        concessionId: "c5",
        name: "Large",
        basePrice: 55000,
        inComboPrice: 40000,
        sku: "POPCORN-LARGE",
        isActive: true,
      },
    ],
  },
  {
    id: "c6",
    name: "Movie Combo",
    category: "combo",
    categoryDisplayName: "Combos",
    description: "Combo: Popcorn + Cola + Candy",
    isActive: true,
    isCombo: true,
    priority: 0.8,
    variants: [
      {
        id: "cv11",
        concessionId: "c6",
        name: "Standard",
        basePrice: 12000,
        inComboPrice: 10000,
        sku: "COMBO-STANDARD",
        isActive: true,
      },
      {
        id: "cv12",
        concessionId: "c6",
        name: "Premium",
        basePrice: 18000,
        inComboPrice: 15000,
        sku: "COMBO-PREMIUM",
        isActive: true,
      },
    ],
  },
];
