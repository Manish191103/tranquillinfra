# 02 — The three lead-generation campaigns

All three are **Google Ads Search**, India, Telangana + Hyderabad. Shared settings below, then each campaign.

## Shared account settings

| Setting                      | Value                                                                                                                                                                                                                                                                                                          | Why                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Location option              | **Presence: people in or regularly in** targeted areas                                                                                                                                                                                                                                                         | Rudraram is empty land; "in" the area is ~0 population               |
| Presence areas               | Rudraram, Patancheru, Sangareddy, Muthangi, Isnapur, Mokila, Kandi/Nandikandi, Julkal, Shankarpally, Peddapur, Ameenpur, Yenkepally, **plus** Miyapur, Kukatpally, Gachibowli, HITEC City, Financial District, Madhapur, Secunderabad, Begumpet, Mehdipatnam, Serilingampally, Chanda Nagar, Uppal, Vanasthali | Demand comes from the employed west corridor, not from the plot      |
| Language                     | English + Hindi + Telugu                                                                                                                                                                                                                                                                                       | Telugu/Hinglish carries real volume per Insomniacs 2026              |
| Ad schedule                  | 06:00–23:00, all 7 days                                                                                                                                                                                                                                                                                        | Plot enquiries skew evening; sales team can't answer at 02:00 anyway |
| Devices                      | Mobile-first creative, all devices                                                                                                                                                                                                                                                                             | Indian real-estate search is >70% mobile                             |
| Attribution                  | Data-driven, **but** import offline `site_visit_booked` from Formspree                                                                                                                                                                                                                                         | Google cannot see WhatsApp or phone calls                            |
| Final URL expansion          | **Off**                                                                                                                                                                                                                                                                                                        | Otherwise ads land on `/about-us` and `/insights/*`                  |
| Auto-applied recommendations | All declined                                                                                                                                                                                                                                                                                                   |                                                                      |

**Account-level negatives** (applies to all three):
`jobs, job, vacancy, salary, government job, mgnmt, government, apply, exam, result, notification, scheme, subsidy, agri, subsidy, tution, tuition, school, college, admission, plot size conversion, sqft to sqm, sqm to sqyd, 2bhk, 3bhk, flat, apartment, rent, rental, hostel, pg, brokerage, broker, resale, second hand, used, interiors, architect, landscape design, civil contractor, land for sale agricultural, farming, quarry, mysql, oracle, trivago, youtube, download, pdf, free, template, near me jobs`

> Note `land for sale` — do **not** negative-match it broadly. Long-form land queries convert. Negative the
> qualifiers instead: `agricultural`, `farm land for lease`, `lease`, `60 acres barren`, `government land`.

---

## Campaign 1 — Core High-Intent Plot Search

**The money campaign.** Terms where a buyer is already deciding.

**Budget:** ₹750/day (50%) · **Bidding:** Maximize Conversions with a ₹700 CPL cap _from day 1_ (falls back
to Maximize Clicks if it can't hit the cap in 48h) · **Goal:** booked site visit

### Ad groups (SKAGs — one geo term per group, so headline = query)

| #   | Ad group                   | Match          | Headline 1 (pinned, geo-inserted)                  |
| --- | -------------------------- | -------------- | -------------------------------------------------- |
| 1.1 | Rudraram villa plots       | phrase + exact | `Villa Plots In Rudraram — From ₹50L*`             |
| 1.2 | Patancheru plots           | phrase + exact | `Plots In Patancheru — 150-300 Sq Yd`              |
| 1.3 | HMDA approved plots        | phrase + exact | `HMDA Approved Plots Rudraram — From ₹50L*`        |
| 1.4 | Open plots near Patancheru | phrase         | `Open Plots Near Patancheru — HMDA + RERA`         |
| 1.5 | Gated community Rudraram   | phrase         | `Gated Villa Plot Layout, Rudraram — Book A Visit` |
| 1.6 | 200 sq yd plots            | phrase + exact | `200 Sq Yd Plots At ₹50L* — Rudraram`              |
| 1.7 | Brand — Tranquill          | exact + phrase | `Tranquill City Villa Plots — Rudraram`            |

### Keyword lists

```
# 1.1  [phrase] villa plots in rudraram
      [phrase] plots in rudraram
      [phrase] rudraram plots for sale
      [exact]  villa plots rudraram
# 1.2  [phrase] plots in patancheru
      [phrase] patancheru plots
      [phrase] open plots near patancheru
      [phrase] villa plots patancheru
# 1.3  [phrase] hmda approved plots rudraram
      [phrase] hmda approved plots near patancheru
      [phrase] hmda plots rudraram
      [phrase] hmda approved villa plots
      [exact]  hmda approved plots
# 1.4  [phrase] open plots near patancheru
      [phrase] residential plots for sale patancheru
      [phrase] plots for sale near patancheru
# 1.5  [phrase] gated community plots rudraram
      [phrase] villa plot layout rudraram
      [phrase] gated villa plots near patancheru
# 1.6  [phrase] 200 sq yd plots hyderabad
      [phrase] 200 sqyd plots near patancheru
      [phrase] 300 sq yd plots rudraram
      [phrase] 150 sq yd plots rudraram
# 1.7  [exact]  tranquill city
      [exact]  tranquill infra
      [phrase] tranquill city rudraram
      [phrase] tranquill city patancheru
```

### Responsive Search Ad — 1.1 (the pattern that beats Richland)

Headlines (30 char limit respected where marked):

```
H1  Villa Plots In Rudraram* - From Rs50L*        <- pinned
H2  HMDA & RERA Approved | RERA REA01100108192
H3  78 Of 82 Plots Left | 150-300 Sq Yd
H4  Book A Site Visit - Pick Your Day
H5  Rudraram, Near Patancheru | West Hyderabad
H6  Get The Brochure & Price Sheet
H7  40 Ft CC Roads | 24/7 Security
H8  From Rs50 Lakh Per Plot | Tranquill City
H9  Verified Layout | HMDA 2103/SWDL/2026
H10 Plots Near ORR Exit 3 - Book A Visit
H11 Bank Loan Assistance | Spot Registration
H12 See The Layout Plan Before You Buy
H13 4.2 Acres | 78 Saleable Plots
H14 Villa Plots Rudraram - Rs50L* - Book A Visit
H15 Tranquill City, Rudraram, Hyderabad
```

Descriptions:

```
D1  78 saleable plots of 150-300 sq yd in a gated layout at Rudraram, near Patancheru. Entry Rs50 lakh
     per plot. RERA REA01100108192 | HMDA 2103/HMDA/SWDL/2026 - both published on the project page.
D2  Pick the day that suits you. Book a site visit, read the layout plan and the approval numbers, then
     decide. We publish the approvals rather than promise them. No possession date claimed.
```

### Extensions (all campaigns, campaign 1 weighted highest)

- **Sitelinks** — `Plot Sizes & Prices` · `Approvals & Documents` · `Location & Connectivity` · `Site Layout Plan` · `Book A Site Visit` · `Verify Before You Buy`
- **Callouts** (≤25 char) — `RERA REA01100108192` · `HMDA Layout Approved` · `78 Plots Available` · `From Rs50 Lakh` · `150-300 Sq Yd` · `40 Ft CC Roads` · `24/7 Security` · `Spot Registration` · `Bank Loan Assistance` · `Spot Admission Gate`
- **Structured snippets** — Type _Apartment/Villa_: `150 Sq Yd`, `200 Sq Yd`, `250 Sq Yd`, `300 Sq Yd`; Type _Amenities_: `Avenue Plantation`, `Underground Drainage`, `Underground Cabling`, `Jogging Track`, `Children's Play Area`, `Street Lighting`
- **Price** — `150-300 sq yd` · type `Per plot` · `₹50,000` … `₹1,40,000` → renders "Prices from ₹50,000*"
- **Call** — +91 95503 62288, 06:00–23:00, call reporting on
- **Lead form** — 4 fields (name, phone, email, preferred visit date) — this is the cheapest conversion on mobile
- **Location** — Tranquill City, Rudraram (Patancheru), Sangareddy District, Telangana

### Landing page

Existing homepage fails on message match. Build **`/plots-rudraram`**:

1. Above the fold, four items only: plot size range, `From ₹50 lakh`, approval numbers **REA01100108192 / 2103/HMDA/SWDL/2026**, and two buttons — _Book a site visit_ / _Get the price sheet on WhatsApp_.
2. Immediately below: the layout plan image with the 78 available plots highlighted and 1–4 marked "not for sale (HMDA mortgage)".
3. Then: what is published vs what is not (reuse the existing homepage section verbatim — it is the best asset on the site).
4. 4-field form above the fold, phone tap-to-call, WhatsApp FAB.
5. Load under 2.5s on 4G. Every ad group gets its own URL with the geo in the path.

---

## Campaign 2 — Corridor & Neighbourhood Geo Search

**Where the buyers are and Richland is thin.** Richland covers Rudraram, Sangareddy, Kandi, Isnapur, Muthangi,
Peddapur, Nandikandi — but **not** Shankarpally, Julkal, Mokila, Kachiguda–Serilingampally, or the
Financial District / Gachibowli employment nodes. Budget-weighted geo expansion is where the marginal click
is cheapest.

**Budget:** ₹450/day (30%) · **Bidding:** Maximize Conversions, no cap for the first 5 days, then a CPL cap at
the observed week-1 CPL · **Goal:** booked site visit

### Ad groups

| #   | Ad group                        | Cluster   | Headline 1 (pinned)                          |
| --- | ------------------------------- | --------- | -------------------------------------------- |
| 2.1 | Muthangi / ORR Exit 3           | 10 km     | `Plots Near Muthangi — 10 Min To ORR Exit 3` |
| 2.2 | IIT Kandi / Nandikandi          | 12 km     | `Villa Plots Near IIT Kandi — From Rs50L*`   |
| 2.3 | Peddapur / Sangareddy           | 18 km     | `Plots On The NH-65 Corridor — Rudraram`     |
| 2.4 | Shankarpally / Julkal           | 20 km     | `Plots Near Shankarpally — HMDA + RERA`      |
| 2.5 | Gachibowli / Financial District | catchment | `Plots Near Financial District — Rudraram`   |
| 2.6 | Kukatpally / Miyapur            | 25 km     | `Plots Near Kukatpally — West Hyderabad`     |

### Keywords

```
# 2.1  [phrase] plots near muthangi        [phrase] villa plots near muthangi
      [phrase] plots near ORR exit 3       [phrase] open plots muthangi
# 2.2  [phrase] villa plots near kandi      [phrase] plots near IIT Hyderabad
      [phrase] plots isnapur               [phrase] plots near nandikandi
# 2.3  [phrase] plots near peddapur        [phrase] plots near sangareddy
      [phrase] plots on nh 65              [phrase] sangareddy open plots
# 2.4  [phrase] plots near shankarpally    [phrase] villa plots shankarpally
      [phrase] plots near julkal           [phrase] DTCP plots shankarpally
# 2.5  [phrase] plots near financial district   [phrase] plots near gachibowli
      [phrase] plots near hitech city      [phrase] sangareddy plots for gachibowli commute
# 2.6  [phrase] plots near kukatpally      [phrase] plots near miyapur
      [phrase] west hyderabad villa plots  [phrase] plots near serilingampally
```

> 2.5 and 2.6 are the "I live and work in the west corridor but haven't picked a micro-market yet" cluster.
> These convert at roughly half the rate of 2.1–2.3 but are the only ones not being bid on by anyone.

### Ad creative

Same asset set as Campaign 1 with the geo swapped in headline 1 and the distance swapped in description 1.
Add one extra description for 2.5/2.6:

```
D3  Working near Gachibowli or the Financial District? The Rudraram–Patancheru corridor is 30-40 minutes
     off ORR. Come and walk the layout on a Sunday before you shortlist anything else.
```

**Bid cap:** ₹28 on 2.1–2.4, ₹18 on 2.5–2.6, to stop the broad "west hyderabad villa plots" terms eating
the corridor budget.

---

## Campaign 3 — Trust, Finance & Verification Intent

**The campaign nobody in this category is running.** Richland, Auro, Western Park, Kshethra and Bhashyam all
advertise claims. `tranquillinfra.com` is the only site in this market publishing approval numbers and telling
buyers how to verify them. That is an owned position, and the queries that prove a buyer is 2–4 weeks from
signing are exactly the ones to own:

```
[phrase] how to verify a plot before buying
[phrase] verify HMDA approved layout
[phrase] HMDA layout approval number check
[phrase] HMDA vs DTCP approved plot
[phrase] RERA plot registration number telangana
[phrase] plot loan in telangana          [phrase] plot loan eligibility LTV
[phrase] plot registration charges telangana
[phrase] encumbrance certificate for plot
[phrase] agricultural land to plot conversion
[phrase] Gram Panchayat layout approval
[phrase] is rudraram a good place to buy plots
[phrase] patancheru vs rudraram
[phrase] plots near IIT Hyderabad under 1 crore
[phrase] 150 sq yd plot price rudraram
[phrase] 200 sq yd plot price near Patancheru
[exact]  tranquill city          [exact]  tranquill infra reviews
```

**Budget:** ₹300/day (20%) · **Bidding:** Maximize Conversions · **Goal:** site visit booked + brochure request
(these leads get an email/WhatsApp verification pack, which is what converts research into a visit)

### Why this works commercially

A buyer running _"how to verify a plot before buying"_ or _"plot loan in telangana LTV"_ is not shopping, they
are closing. `docs/` content already exists on the site (Insights: _Verify a Plot in Hyderabad_, _HMDA vs DTCP_,
_Plot Loans in Telangana_, _Plot Registration Charges in Telangana_) — this campaign gives that content an
exact-match buyer at the exact moment of doubt, and routes them to the project page as the answer.

### Ad creative

```
H1  How To Verify A Plot Before You Buy*     <- pinned (exact-match feel)
H2  RERA REA01100108192 | HMDA 2103/SWDL/2026
H3  We Publish The Numbers, Not A Promise
H4  Tranquill City, Rudraram — 78 Plots Left
H5  Verify It Yourself, Then Decide
H6  Plot Loan, LTV & Tax Guide For Telangana
H7  HMDA Or DTCP? Which Approved Our Layout
H8  Read The Guide — Then Come See The Plot
H9  From Rs50 Lakh | 150-300 Sq Yd
H10 Bring Your Lawyer. Seriously.
H11 No Possession Date Claimed | No Drive-Time Estimates
H12 Book A Site Visit With Our Team

D1  Most plots fail on paperwork, not on price. Here is the approval number to check, where to check it,
     and the questions to ask before you pay a token. Then walk the Rudraram layout.
D2  Telangana plot loan eligibility, LTV limits and registration charges, written by the team that sells
     the plots. Full guide, no gatekeeping.
```

Destination: the matching Insight article, with a persistent **"Now see the plot: Tranquill City, Rudraram"**
module at the end. Do not send research traffic to the sales form — send it to the guide, and let the guide
ask for the phone number.

---

## Tracking requirements before launch (day 0)

1. **GA4** — currently the site has a GA4 tag (`G-715…`) but no `dataLayer`, no conversion events and no
   Google Ads tag. Add Google Ads conversion tracking for: `generate_lead` (form), `call` (from ad),
   `whatsapp_click`, `brochure_download`, `site_visit_booked`.
2. **Offline conversion import** from Formspree → Google Ads on `site_visit_booked`. Without this the algorithm
   optimises toward cheap form fills, which is the single most common way plot campaigns produce junk leads.
3. **Value-based bidding input** — assign `site_visit_booked` = 5, `brochure_request` = 2, `whatsapp_click` = 1
   so the ₹50L ticket is reflected in the bid.
4. **Call tracking number** (Google forwarding number, or a CallRail/Cloudflare equivalent) so calls from ads
   are attributed and the phone number is never shown in the ad.
5. **Domain** `tranquillinfra.com` and `www.` both need to resolve and be tagged — both appear in ads today.

## Week-by-week operating rhythm

| Day  | Action                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Tracking live, negatives in, ads with full conversion history (run as "Enhanced for clicks" for 3 days to populate the asset list)                                                         |
| 1–3  | Manual review of the search-terms report twice daily. Add negatives same-day. Do **not** touch bids                                                                                        |
| 4–7  | Switch to Maximize Conversions. Compare achieved CPL vs `tools/forecast.py`. Move budget toward the campaign with the best CPL, not the most clicks                                        |
| 7    | Full read-out against `docs/03-week-1-forecast.md`. Decide: hold / scale / restructure. Only now consider tCPA                                                                             |
| 8–28 | Weekly: prune search terms, build negatives from actual queries, refresh headlines, feed offline site-visit conversions back                                                               |
| 29+  | tCPA at 130% of current CPL once ≥40 conversions in 30 days. Then a Demand Gen / YouTube campaign on the "walk the layout" video, and a branded Search campaign to defend `tranquill city` |
