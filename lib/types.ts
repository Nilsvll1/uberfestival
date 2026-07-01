export type Festival = {
  id: number;
  festival_name: string;
  city: string;
  country: string;
  category: string;
  /** Full URL — only present in premium-gated server contexts. Never sent in public RSC payloads. */
  application_url?: string | null;
  /** True when a festival has an apply URL; sent instead of the URL itself in public payloads. */
  has_apply_url?: boolean;
  application_platform?: string;
  application_status?: "verified_application" | "email_submission" | "filmfreeway" | "festhome" | "contact_form" | "contact_submission" | "invitation_only" | "seasonally_closed" | "unknown";
  contact_form_url?: string | null;
  application_email?: string | null;
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

export type NotificationPrefs = {
  email_deadlines: boolean;
  email_new_opportunities: boolean;
  email_product_updates: boolean;
  email_reopening_alerts?: boolean;
};

export type Profile = {
  id: string;
  artist_name: string | null;
  country: string | null;
  primary_genre: string | null;
  instagram_url: string | null;
  spotify_url: string | null;
  website_url: string | null;
  avatar_url?: string | null;
  notification_prefs?: NotificationPrefs | null;
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

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionItem = {
  id: string;
  collection_id: string;
  festival_id: number;
  added_at: string;
};

export type RssFeed = {
  id: number;
  name: string;
  url: string;
  feed_type: "rss" | "atom";
  is_active: boolean;
  last_fetched_at: string | null;
  last_fetch_status: "ok" | "failed" | "empty" | "parse_error" | null;
  items_last_run: number;
  created_at: string;
};

export type PipelineRun = {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
  feeds_processed: number;
  items_found: number;
  festivals_created: number;
  festivals_updated: number;
  festivals_archived: number;
  errors_count: number;
  duration_ms: number | null;
  error_message: string | null;
  summary: Record<string, unknown> | null;
};

export type PipelineRunEvent = {
  id: number;
  run_id: number;
  created_at: string;
  level: "info" | "warn" | "error";
  event_type: string;
  message: string;
  data: Record<string, unknown> | null;
};
