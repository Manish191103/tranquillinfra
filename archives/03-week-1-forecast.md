# 03 — What 1 week gets you

Reproduce with `python3 tools/forecast.py`. Every input lives in `ASSUMPTIONS` in that file — re-run it
against your live numbers after 7 days and the model becomes your actual forecast.

## Headline

**₹1,500/day × 7 days = ₹10,500 spent → ~17 leads, ~364 clicks, ~4,500 impressions, ~₹630 CPL.**

Scenario range:

| Scenario   | Daily      | Week-1 spend | Clicks  | Leads   | CPL      |
| ---------- | ---------- | ------------ | ------- | ------- | -------- |
| Lean       | ₹700       | ₹4,900       | 170     | **7**   | ₹687     |
| **Base**   | **₹1,500** | **₹10,500**  | **364** | **~17** | **₹632** |
| Aggressive | ₹3,000     | ₹21,000      | 470     | **20**  | ₹1,037   |

Note the shape: going from ₹700/day to ₹3,000/day is **4.3× the money for 2.9× the leads**. Doubling budget
into a contested auction moves CPC from ₹29 to ₹45. That is normal and it is why the base case is ₹1,500/day.

## By campaign (base case, 7 days)

| Campaign                | Share | Spend  | CPC | CTR  | Impressions | Clicks | CVR  | Leads   | CPL  |
| ----------------------- | ----- | ------ | --- | ---- | ----------- | ------ | ---- | ------- | ---- |
| C1 Core High-Intent     | 50%   | ₹5,250 | ₹34 | 9.0% | 1,716       | 154    | 4.5% | **6.9** | ₹756 |
| C2 Corridor Geo         | 30%   | ₹3,150 | ₹30 | 8.0% | 1,312       | 105    | 3.2% | **3.4** | ₹938 |
| C3 Trust & Verification | 20%   | ₹2,100 | ₹20 | 7.0% | 1,500       | 105    | 6.0% | **6.3** | ₹333 |

C3 is the cheapest lead in the plan. That is the point of running it — it buys verified-research leads at
roughly half C1's cost, and a buyer reading your verification guide is closer to booking than one clicking a
generic "plots near Patancheru" ad.

## Where the assumptions come from

| Input  | Value    | Basis                                                                                                                                                                                                                                                   |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPC C1 | ₹34      | Google Search CPC, real estate India ₹40–120 (Go Ads India 2026); Hyderabad ₹30–110 (Insomniacs 2026). Plotted-land terms in a peripheral micro-market sit at the cheaper end; Richland's 32 creatives confirm a contested auction on these exact terms |
| CPC C2 | ₹30      | Slightly below C1 — less exact demand, more supply                                                                                                                                                                                                      |
| CPC C3 | ₹20      | Informational/finance queries, low competition                                                                                                                                                                                                          |
| CTR    | 7–9%     | Real-estate search CTR benchmark 4.5–7% (Go Ads India); 6.2–8.4% on buyer-intent keywords; observed 11.5% in one Hyderabad villa case. Used 9% for C1                                                                                                   |
| CVR    | 3.2–6.0% | Real-estate search CVR benchmark 3–7% (Apex Influence, May 2026). Used the low end: no reviews, no price page, no offline conversion history in week 1                                                                                                  |
| CPL    | ₹630–940 | Cross-checks: Hyderabad ₹700–2,000 (Insomniacs); plotted projects ₹800–2,400 (Webcomp Digitex); mid-market ₹600–1,500 (Beetle Dynamics)                                                                                                                 |

**Independent validation:** DIGITALOPS ran Google Search for _Western Park Villas_ — 112 premium 4BHK
villas at Shankarpally, ₹2.5 Cr, 20 km from Tranquill City. First three weeks: **₹16,065 spend, 3,760
impressions, 434 clicks, 21 conversions, ₹765 CPL** (≈₹5,355/week ≈ ₹765/day). After optimisation:
₹27,735 → 79 leads at ₹351 CPL. Our base case (₹10,500/week, ₹632 CPL, 17 leads) sits between those two,
which is where a week-1 launch with clean tracking should land.

## What a "lead" is

A lead = any one of, and they are counted separately in Google Ads:

| Conversion                                     | Est. share of leads | Quality                                            |
| ---------------------------------------------- | ------------------- | -------------------------------------------------- |
| `site_visit_booked` (form with preferred date) | ~40%                | **Qualified** — highest                            |
| `whatsapp_click`                               | ~30%                | Mixed — needs fast first reply (<2 min) or it dies |
| `call_from_ad` (>30s)                          | ~20%                | Qualified                                          |
| `brochure_request`                             | ~10%                | Early stage, nurture                               |

**A week-1 lead is not a sale.** The full funnel from the base case:

```
17 leads/week
  → 4-6  site visits booked   (25-35% of leads)
  → 2-4  site visits actually attended
  → 0.7-2.5 bookings at ~Rs 50-90L   (15-25% of attended visits)
```

Real-estate buying cycles run **60–180 days** (consistent across every agency source quoted here). A buyer
who clicks in week 1 books in month 2 or 3. So the honest one-week scorecard is:

| Metric                                    | Week-1 target   | Why it matters                                                    |
| ----------------------------------------- | --------------- | ----------------------------------------------------------------- |
| Search terms harvested                    | 400–700 queries | The actual asset; becomes next month's negatives and new keywords |
| Qualified lead rate (site visits ÷ leads) | >35%            | Quality test, not volume                                          |
| Tracked calls with duration >30s          | 3–6             | Real intent                                                       |
| Cost per **site visit booked**            | ₹1,800–2,600    | The KPI that decides budget from week 5                           |
| Impression share, C1 branded + non-brand  | >25%            | Is there inventory left to win?                                   |
| Approval-number ad vs price ad CTR        | measure it      | Decide week 2 whether to drop the proof angle or the price angle  |

**What you should NOT judge week 1 on:** bookings, revenue, ROAS. There will not be any. If anyone
presents a week-1 ROAS number for a plotted-land launch, it is fabricated.

## Downside case — the honest failure mode

If CPC comes in at ₹46 instead of ₹34 (Richland raises its bid, or Quality Score on the new `/plots-rudraram`
page is low in week 1) and CVR is 3%:

|        | Base    | Downside |
| ------ | ------- | -------- |
| Spend  | ₹10,500 | ₹10,500  |
| Clicks | 364     | 228      |
| Leads  | 17      | 7        |
| CPL    | ₹632    | ₹1,500   |

**Mitigations, in order of impact:**

1. Bid ₹30/₹26/₹17 max-CPC for the first 72 hours instead of Maximize Conversions. Manual CPC prevents the
   week-1 learning dip from burning budget at ₹60+ clicks.
2. Ship the dedicated `/plots-rudraram` page before launch. Every ad currently landing on the homepage is
   costing you Quality Score and conversion rate — this is the single highest-leverage item on the list.
3. Keep the phone number out of the ad copy. Ad extensions with call reporting, plus a forwarding number,
   stops low-intent clicks on a visible number.
4. Add `farmer`, `layout only`, `no water`, `without road`, `agricultural`, `lease` to negatives in week 1.

## Upside case

If the ₹50L price anchor outperforms the ₹44L competitor anchor and you hold CTR at 9% with CVR at 6%:
**~22 leads at ₹480 CPL**, and the corridor campaign (C2) — where nobody is bidding on Gachibowli,
Financial District or Kukatpally — becomes the cheapest source. If so, week 2 should move the split from
50/30/20 to 45/40/15.

## One honest caveat on the CPC inputs

Everything above the table is derived, not measured on your account. Google Keyword Planner and your own
impression-share data are the only sources that will give a real CPC for `villa plots in rudraram` — and
Keyword Planner needs an active account. **On day 1, pull those three numbers before touching a bid:**

```
Keyword Planner → Locations: Hyderabad       → "villa plots rudraram"
                                         →   "hmda approved plots near patancheru"
                                         →   "open plots near patancheru"
```

Low / High bid ranges from that screen replace the CPC column in `tools/forecast.py` and the forecast
becomes real rather than modelled. Expect them to be ₹25–45.
