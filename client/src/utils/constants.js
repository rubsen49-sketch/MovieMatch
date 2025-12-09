export const API_KEY = "14b0ba35c145028146e0adf24bfcfd03";

export const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:3001" 
  : "https://moviematch-backend-0om3.onrender.com";

export const PLATFORMS = [
  { id: 8, name: "Netflix", logo: "https://media.themoviedb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, name: "Disney+", logo: "https://media.themoviedb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { id: 119, name: "Amazon Prime", logo: "https://media.themoviedb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { id: 381, name: "Canal+", logo: "https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg" }
];

export const GENRES_LIST = [
  { id: 28, name: "Action" },
  { id: 12, name: "Aventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comédie" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentaire" },
  { id: 18, name: "Drame" },
  { id: 10751, name: "Famille" },
  { id: 14, name: "Fantastique" },
  { id: 36, name: "Histoire" },
  { id: 27, name: "Horreur" },
  { id: 10402, name: "Musique" },
  { id: 9648, name: "Mystère" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "Guerre" },
  { id: 37, name: "Western" }
];