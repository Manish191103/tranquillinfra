# 01 — Competitor intel from Google Ads Transparency Center

Source: `https://adstransparency.google.com`, region **India (IN)**, pulled via the Transparency Center RPC
(`SearchService/SearchCreatives`, `LookupService/GetCreativeById`) — see `tools/atc.py`. Creative copy was
recovered from Google's archived creative renders (`tpc.googlesyndication.com/archive/simgad/…`) and OCR'd.
Full data: `data/competitor-creatives.csv`, `data/keyword-targets-observed.csv`.

## Who is actually advertising against Tranquill City

| Advertiser (Google Ads account)            | Domain                    | Live creatives in ATC | Formats                      | Earliest → latest       | Avg days live |
| ------------------------------------------ | ------------------------- | --------------------- | ---------------------------- | ----------------------- | ------------- |
| CHIPOTLE MEDIA PRIVATE LIMITED (agency)    | aurorealty.com            | 400 (40 pulled)       | 26 Image · 10 Text · 4 Video | 2024-10-17 → 2026-10-05 | 131           |
| Richland Infra Developers                  | saikrishnagroup.in        | 32                    | 27 Text · 5 Image            | 2021-12-15 → 2026-10-04 | 564           |
| Kshethra Ecospaces LLP                     | kshethragroup.com         | 20                    | 14 Text · 6 Image            | 2024-07-20 → 2026-10-04 | 368           |
| CONCRETE INFRA & DEVELOPERS                | westernpark.in            | 11                    | 5 Text · 2 Image · 4 Video   | 2026-02-05 → 2026-09-26 | 34            |
| Vaishnavi Global Builders & Developers LLP | vaishnaviglobal.com       | 7                     | 4 Text · 2 Image · 1 Video   | 2026-05-09 → 2026-09-20 | 19            |
| CASAGRAND APARTMENTS SL                    | casagrand.com             | 6                     | 6 Text                       | 2025-08-20 → 2026-10-05 | 271           |
| **KV SAIKRISHNA (that is you)**            | **tranquillinfra.com**    | **5**                 | **5 Text**                   | 2026-06-17 → 2026-10-04 | **16**        |
| BHASHYAM REALTORS                          | openvillaplots.com        | 2                     | 2 Text                       | 2026-08-17 → 2026-09-08 | 15            |
| Shaik Lalmunnisha                          | millennialassetrealty.com | 2                     | 1 Text · 1 Image             | 2026-06-23 → 2026-07-27 | 17            |
| Vite Real Estate                           | sanctuaryproject.online   | 1                     | Video                        | 2026-04-22 → 2026-05-21 | 30            |
| Akhila Reddy Vanam                         | asrindiaprojects.com      | 1                     | Video                        | 2025-08-06 → 2025-10-28 | 83            |
| Raaja Thankaraj                            | gsale.in (broker)         | 1                     | Video                        | 2026-04-24 → 2026-05-07 | 13            |

**Read this:** the direct competitive set in Rudraram / Patancheru / west-Hyderabad plotted land is
**one serious player — Richland Infra (saikrishnagroup.in), 32 creatives, running continuously since 2021** —
plus two small advertisers (Bhashyam, Millennial, ~2 creatives each). You are on **5 creatives, ~16 days
average life**. Nobody in your exact micro-market is running video. Auro Realty and Western Park compete for a
different buyer (₹2–4 Cr constructed villas in Patancheru/Shankarpally), so they set the auction floor on
"villa" and "ORR" terms but not on "plot".

## The competitor that matters: Richland Infra / Sai Krishna Group

Their live creatives are almost entirely **Responsive Search Text ads built around a price-inserted
keyword pattern**. The `*asterisks*` in their headlines are Google's keyword insertion — i.e. these are the
literal search terms they are bidding on:

```
Villa Plots Near Rudraram* - Right On NH-65 From ₹44L*          <-- bidding on YOUR micro-market
Villa Plots Sale Sangareddy* - Right On NH-65 From ₹44L*
Villa Plots Sale Near Kandi* - 5 Mins IIT Kandi From ₹44L*
Villa Plots Near Isnapur* - Right On NH-65 From ₹44L* - Book Visit
Villa Plots Near Muthangi* - 5 Mins IIT Kandi From ₹44L*
Villa Plots Sale in Peddapur® - 2 Mins Sangareddy @ ₹44L*
Open Plots in Sangareddy Hyd* - Right On NH-65 From ₹44L*
Open Plots in Nandikandi Hyd* - 2 Mins Sangareddy @ ₹44L*
HMDA & RERA Plots Sangareddy* - Next To IIT Hyd From ₹51L*
RERA Plots Nandikandi Hyd* - 5 Mins IIT Kandi From ₹44L*
DTCP & RERA Plots Nandikandi* - 32 Acres Layout From ₹44L*
DTCP Plots Near Sangareddy* - Right On NH-65 From ₹44L*
DTCP Reg. Plots Near Isnapur* - 5 Mins IIT Kandi From ₹44L*
Plots Sangareddy Hyderabad* - Right On NH-65 From ₹44L*
Annapurna County Plots Hyd* - 32 Acres Layout From ₹44L*
```

Descriptions follow one template: _"Annapurna County – Plots Township in Sangareddy – Peddapur On NH-65
Hyderabad From ₹44L\*. DTCP & RERA Reg. 32 Acres Township | Right On NH-65 | Sangareddy – 2 Mins | Near IIT Kandi"_
with **sitelinks** (Plot Sizes, Location, Payment Plan) and a **price extension** — one creative rendered
_"View 4 prices from ₹34.5M"_. CTA assets: `Contact Us`, and call/WhatsApp.

Their second project (Sai Krishna Avenues, HMDA, next to IIT Hyderabad) runs the same pattern at a
**₹48–51L** band — i.e. they are already sitting exactly on top of Tranquill City's ₹50L entry price.

**The formula to beat, and its one weakness:**

`[Keyword] + [Approval type] + [Distance / landmark] + [Price from ₹XL]`

The weakness is that **it is 100% claim, zero proof**. Not one of their headlines shows an approval number,
plot count, or a document. Meanwhile your site publishes `REA01100108192` and `2103/HMDA/SWDL/2026`, says
out loud that it will not claim a possession date, and tells buyers to bring their lawyer. That is the
attack surface.

## Second pattern: price-per-sq-ft for farm/managed land

Kshethra (20 creatives, 368 days avg) runs a completely separate angle on the same buyer — managed
farmland at a price per sq.yd that is 3–4× lower than your entry:

```
Farm Plots At Nandi Hills BLR — Airport 30 Mins @ ₹599/Sft* - Bangalore - NH44
Farmlands At Devanahalli BLR — 40 Acre Layout @ ₹749/Sft*
Farm Villa Plots Devanahalli — 64 Acre Layout @ ₹749/Sqft*
…  "Airport Just 30 Mins | NH44 – 5.5 Kms | 26 Acres Layout"
```

This is the _budget-down_ competitor for the same ₹35–50L buyer, and it is competing on Instagram/YouTube
inventory as much as Search. Two lessons: (a) `/sq.ft` and `/sq.yd` price anchoring is table stakes in this
category; (b) the buyer is comparing down to ₹7,899/sq.yd farm land, so your ₹50L-for-150-sq.yd
(~₹33,000/sq.yd) needs its justification stated, not assumed.

## Third pattern: premium villas anchor the auction

Auro Realty (via agency Chipotle Media — **400 creatives, the largest advertiser found**) and Western Park
and Vaishnavi Global all bid ₹2–4 Cr _constructed_ villas in Patancheru / Shankarpally / Adibatla:

```
Auro Realty   — "Sansa County Villas @Patancheru — Starting ₹3.73 Cr*"  · "313-Acre Integrated Township"
Western Park  — "Luxury 4BHK Triplex Villas @Shankarpally*"  · "4BHK Villas Starting @₹2.6Cr*"
Vaishnavi     — "4 BHK Villas In Adibatla — Starting ₹2.20 Cr*"  · "Walk the site today."
```

Two things worth stealing from them: **"Walk the site today" / "Book a slot today"** — an imperative site-visit
CTA in the description; and **"Only a few units left!"** — scarcity. Their best-performing pattern for a
high-ticket item is a _short_, imperative description plus a lead-form or call asset, not a brochure paragraph.

## What you are running today (5 creatives, all Text, ~16 days each)

```
82 Plots, 150-300 Sq Yd — Check Plot Availability — Book A Site Visit Today
HMDA Approved Gated Layout — 82 Plots, 150-300 Sq Yd
Plots Near Patancheru — Explore Tranquill City
Semi Gated Community — HMDA & RERA Approved Plots Rudraram
Tranquill City Villa Plots — Tranquill City, Rudraram — Book A Site Visit
```

Descriptions reference the approval numbers ("Approval numbers published on the project page. Verify HMDA and
RERA before you buy."), which is right — but there is **no price in any headline**, which is the single
biggest gap against Richland's ₹44L/₹51L pattern. Most of the live set also lands on the homepage rather than
a plot-and-price page, so there is no keyword-to-page match.

## Structural gap summary

| Dimension                | Category norm (observed)                | Tranquill City today | Fix in this plan                      |
| ------------------------ | --------------------------------------- | -------------------- | ------------------------------------- |
| Price in headline        | Universal (₹44L / ₹50L / ₹599/sqft)     | **Absent**           | Every campaign carries `From ₹50L*`   |
| Approval                 | "DTCP/HMDA & RERA" words only           | Words + **numbers**  | Keep the numbers — this is the moat   |
| Keyword insertion        | Yes, geo-inserted                       | No                   | Pin geo into headline 1               |
| Site-visit CTA           | "Book Visit", "Book your slot today"    | Present              | Push to call + WhatsApp assets        |
| Scarcity                 | "Only a few units left", "82 plots"     | "82 plots"           | `78 of 82 plots left`                 |
| Distance/landmark        | "2 Mins Sangareddy", "5 Mins IIT Kandi" | "Near Patancheru"    | Specific km/hub anchors               |
| Format mix               | Text-dominant; video rare               | Text only            | Search-first, video in week 4         |
| Proof (docs/encumbrance) | **Nobody does this**                    | Publishes it         | Own the "verify before you buy" query |
