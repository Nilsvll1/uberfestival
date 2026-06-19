export type Festival = {
  id: number;
  festival_name: string;
  city: string;
  country: string;
  category: string;
  application_url: string;
  application_platform?: string;
  application_status?: string;
  application_source?: string;
  application_verified_at?: string;
  application_confidence?: number;
  submission_deadline: string;
  latitude: number;
  longitude: number;
  description?: string;
  hero_image_url?: string;
  festival_start_date?: string;
  festival_end_date?: string;
  website?: string;
  social_links?: Record<string, string>;
  last_scraped_at?: string;
  scrape_status?: string;
  is_verified?: boolean;
  source_url?: string;
};

export type StagedFestival = {
  id: number;
  festival_name: string | null;
  country: string | null;
  city: string | null;
  genre: string | null;
  application_url: string | null;
  submission_deadline: string | null;
  festival_start_date: string | null;
  festival_end_date: string | null;
  website: string | null;
  social_links: Record<string, string> | null;
  source_url: string;
  raw_text: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type ScrapeSource = {
  id: number;
  name: string;
  url: string;
  is_active: boolean;
  last_scraped_at: string | null;
  festivals_found: number;
  created_at: string;
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
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  is_premium?: boolean;
  premium_until?: string | null;
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
