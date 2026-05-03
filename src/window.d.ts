export {}

export interface LibraryEpisode {
  id: number;
  season: string;
  episode: string;
  file_path: string;
  episode_title: string | null;
  is_watched: number;
}

export interface LibrarySeries {
  id: number;
  title: string;
  mal_id: number | null;
  poster_url: string | null;
  synopsis: string | null;
  genres: string | null;
  score: number | null;
  is_favorite: number;
  user_rating: number;
  episodes: LibraryEpisode[];
}

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>
      scanFiles: (path: string) => Promise<LibrarySeries[]>
      getLibrary: () => Promise<LibrarySeries[]>
      onMetadataUpdate: (callback: () => void) => void
      toggleFavorite: (id: number) => Promise<number>
      toggleWatched: (id: number) => Promise<number>
      updateRating: (id: number, score: number) => Promise<void>
      cleanLibrary: () => Promise<LibrarySeries[]>
      nukeDatabase: () => Promise<LibrarySeries[]>
      saveSettings: (path: string) => Promise<boolean>
      updateWatchedStatus: (ids: number[], status: number) => Promise<void>
      playVideo: (path: string) => Promise<void>
    }
  }
}