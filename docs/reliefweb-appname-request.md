# ReliefWeb API appname request (draft)

Since November 2025 the ReliefWeb API only serves pre-approved `appname` values. Submit the
request form linked from https://apidoc.reliefweb.int/ (the "request an appname" link in the
blog post "Upcoming changes to the ReliefWeb API"). Suggested answers:

- **Application name (appname):** `openseldon`
- **Contact email:** olivia@sarapis.org
- **Organisation:** Open Seldon — created and owned by Olivia Croteau, developed with the support
  of the Sarapis Foundation (New York 501(c)(3)); free and open source,
  https://github.com/oliviacroteau667/open-seldon
- **Website:** https://www.openseldon.org
- **Description of use:**

  > Open Seldon is an open-source humanitarian situational-awareness dashboard that combines
  > public Telegram community channels with open humanitarian datasets on a live map. We would
  > use the ReliefWeb API (v2, `reports` and `disasters` endpoints) in a nightly job to list new
  > humanitarian reports for a small set of countries (initially Ukraine, Poland, Moldova,
  > Romania, Slovakia and Hungary), showing each report's title, publisher, date, country tags,
  > themes and a short excerpt with a link back to ReliefWeb. Full report text is not stored or
  > republished. Expected volume: one request per country per night plus occasional backfills —
  > well under 100 calls per day.

- **Expected request volume:** < 100 calls/day
- **Data retention:** metadata and short excerpt only; links point to reliefweb.int
