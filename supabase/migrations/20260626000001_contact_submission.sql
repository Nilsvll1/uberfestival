-- Add contact_submission to the application status enum.
-- This status represents festivals where no public application process was found,
-- but we did find a general contact path (email, contact form, or social).
-- Unlike email_submission (which has a dedicated application email), contact_submission
-- means "reach out to inquire about performing" — lower confidence, lower Premium value.
ALTER TYPE festival_application_status ADD VALUE IF NOT EXISTS 'contact_submission';

-- Store the raw contact form URL separately from application_url.
-- application_url is reserved for actual application pages.
-- contact_form_url holds general contact forms (/contact page, etc.).
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS contact_form_url TEXT;
