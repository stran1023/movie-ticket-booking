import { cache } from "react";
const API = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim();
 
export async function getMovies(params?: { filter?: string; search?: string; page?: string }) {
  const queryParams = new URLSearchParams();
  
  if (params?.filter) queryParams.append("filter", params.filter);
  if (params?.search) queryParams.append("search", params.search);
  if (params?.page) queryParams.append("page", params.page);
 
  const res = await fetch(`${API}/api/movies/?${queryParams.toString()}`);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Django Error:", errorText);
    throw new Error("Failed to fetch movies data");
  }
  
  return res.json();
}
 
export const getMovieById = cache(async (id: string) => {
  const res = await fetch(`${API}/api/movies/${id}/`);
 
  if (!res.ok) {
    if (res.status === 404) throw new Error("Movie not found");
    throw new Error("Failed to fetch movie details");
  }
 
  return res.json();
});


export function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
