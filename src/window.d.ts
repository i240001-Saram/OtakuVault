export {}

export interface LibraryEpisode {
  id: number;
  season: string;
  episode: string;
  file_path: string;
  episode_title: string | null;
}

export interface LibrarySeries {
  id: number;
  title: string;
  mal_id: number | null;
  poster_url: string | null;
  synopsis: string | null;
  genres: string | null;
  score: number | null;
  episodes: LibraryEpisode[];
}

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>
      scanFiles: (path: string) => Promise<LibrarySeries[]>
      getLibrary: () => Promise<LibrarySeries[]>
    }
  }
}