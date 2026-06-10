export type Festival = {
  id: number;
  festival_name: string;
  city: string;
  country: string;
  category: string;
  application_url: string;
  submission_deadline: string;
  latitude: number;
  longitude: number;
  description?: string;
};

export type Profile = {
  id: string;
  artist_name: string | null;
  country: string | null;
  primary_genre: string | null;
  instagram_url: string | null;
  spotify_url: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedFestival = {
  id: string;
  user_id: string;
  festival_id: number;
  saved_at: string;
};

export type FestivalView = {
  id: string;
  user_id: string;
  festival_id: number;
  viewed_at: string;
};
