# Claims register — Tranquill City marketing

**Purpose:** one list of the marketing claims that are **not real or not
provable**, with the approved replacement wording, so the brochure, ad copy and
any future collateral stop asserting things the site itself refuses to assert.

**Status legend:** ✅ real (keep) · ⛔ remove · ✏️ rewrite · ⚠️ needs business
confirmation · ⏳ blocked on P1-1 (`docs/rera-verification-request.md`)

**Ground truth:** `src/config/project.config.ts` —
19,410 sq.m / **4.8 acre**, `82` parcels, `4` HMDA-mortgage (not saleable),
`78` saleable, plots `125.42–250.84 sq.m (150–300 sq.yd)`, entry **From ₹48 lakh
per plot**, layout in **Rudraram village, Patancheru mandal, Sangareddy district**.
`src/pages/index.astro:368-424` records that the site already **removed** the
unsourced "1 lakh+ employees" statistic and the appreciation / "Value Creation"
claims. The site is the clean reference; the violations below are in collateral.

---

## 1. Not real — remove or rewrite

| # | Claim (as written) | Where | Verdict | Action / approved rewrite |
|---|---|---|---|---|
| 1 | "5 Acre Semi-Gated Community" | Brochure, amenities grid | ⛔/⚠️ | Acreage is wrong: 19,410 sq.m = **4.8 acre**. Rewrite to **"4.8-Acre Gated Community"** — but see #2 for "Gated". |
| 2 | "Semi-Gated" vs the site's "gated community" | Brochure + archived ad "Semi Gated Community" | ⚠️ | Conflict. Site's reviewed copy says **gated**. Confirm the true status; then make brochure, site and ads say the same thing. If it is not fully gated, the **site** copy must change too. |
| 3 | "Over 1 lakh+employees work in the Patancheru-Sangareddy industrial Belt, creating continuous housing demand" | Brochure, "Invest Where" page | ⛔ | No source/year/methodology; the site already deleted this exact stat (`index.astro:371`). **Remove.** Replace with the neutral corridor line the site uses: "Kukatpally → Nizampet → Miyapur → Patancheru → Rudraram → Sangareddy traces the growth belt around Tranquill City." |
| 4 | "Land value grows." · "A GROWTH STORY THAT CREATES Lasting Value.." · "Developments designed to generate appreciation and create wealth for generations." | Brochure | ⛔ | Unprovable return/appreciation claims. **Remove** (site removed equivalents, `index.astro:398`). |
| 5 | "Early Buyers always benefit the most." · "Smart Buyers secure land in Expansion Zones before." · "The Smart Investment" · "The Next Growth Hub" | Brochure, "Why Invest Now" | ⛔ | Investment advice / appreciation pitch. **Remove.** |
| 6 | "HYDERABAD'S MOST DESIRABLE LANDMARK" | Brochure | ⛔ | Unprovable superlative. **Remove** or rewrite factually ("A gated villa-plot layout in Rudraram, near Patancheru"). |
| 7 | "Smooth drive to Miyapur & Lingampally" (+ any "5 Mins / 2 Mins / 10 Min / 30-40 minutes / km" distance) | Brochure + archived ad copy | ⛔ | The site publishes **no drive-time or distance figures** (`tranquill-city.md:94`). **Replace** with route language: "near Mumbai Highway (NH-65)", "connected to the ORR", "near IIT Hyderabad / GITAM University, Rudraram". |
| 8 | "Bank Loan Assistance" · "Spot Registration" · "Spot Admission Gate" | Archived ad copy | ⛔ | Unsupported service/reputation promises. Site's FAQ says financing **depends on the lender**. **Remove** or soften to "loan guidance — lender decides". |
| 9 | "4.2 Acres" | Archived ad copy (H13) | ⛔ | Wrong; conflicts with 4.8 acre. **Rewrite to "4.8 acres".** |
| 10 | "78 Of 82 Plots Left" | Archived ad copy | ✏️ | "Left" asserts current unsold inventory, which is not verified. Real fact is **78 saleable**. Rewrite to "78 of 82 plots saleable"; let the team state live availability. |
| 11 | HMDA written as "2103/SWDL/2026" | Archived ad copy | ✏️ | Use the published full form **"2103/HMDA/SWDL/2026"**. |

## 2. Blocked on P1-1 — approval *adjectives*

| Phrase | Where | Note |
|---|---|---|
| "HMDA-approved gated community plots…" | `src/config/site.config.ts:216` (site description) | ⏳ Only if the HMDA permission verifies. Until then, prefer the site's own neutral form: "gated community plots… HMDA layout permission and RERA registration published". |
| "HMDA & RERA Approved" | Brochure / archived ads / competitor-style copy | ⏳ Do not use "Approved/Registered" adjectives; publish the **numbers** and let buyers verify (the site's moat). |

## 3. Real — keep, align wording

- ✅ 78 saleable of 82 parcels (4 under HMDA Mortgage, not for sale) · 19,410 sq.m (4.8 acre)
- ✅ Plot range 125.42–250.84 sq.m (150–300 sq.yd)
- ✅ From ₹48 lakh per plot (priced per plot, not per sq.m)
- ✅ RERA `REA01100108192` and HMDA `2103/HMDA/SWDL/2026` — publish the **numbers**; verification pending (P1-1)
- ✅ Advertised features: 40 ft & 33 ft CC internal roads, gated community, entrance arch, compound wall, avenue plantation, jogging/cycle track, children's play zone, street lighting, water connection points, rainwater harvesting, underground drainage, 24/7 security
- ✅ Location landmarks (as proximity, no times): Mumbai Highway NH-65, ORR, proposed RRR, IIT Hyderabad, BHEL / Ramachandrapuram, ICRISAT, Patancheru & BDL Township, Isnapur & Kazipally, Pashamylaram, Miyapur & Lingampally, Gachibowli & Financial District, GITAM University Rudraram, Patancheru/Sangareddy hospitals

## 4. Where to apply

1. **Brochure `public/brochure/tranquill-city-final.pdf`** — binary, **no editable source in this repo**. The PDF must be edited in its authoring tool (Adobe Express) using §1. Until then, is it safe to keep as the live lead magnet? It is publicly linked, so the §1 items are live claims. **Treat as a fix-before-promoting item.**
2. **Archived ad copy** (`archives/02-campaign-plan.md`, `archives/01-competitor-intel.md`) — editable markdown, but archived/superseded. Do not let it feed live campaigns until §1 is applied.
3. **Site** — already compliant except the `site.config.ts:216` adjective (§2). No other action.

## 5. Needs business confirmation

- Gated vs semi-gated (affects the site, brochure and every ad).
- Current unsold vs saleable inventory (for any scarcity line).
- "24/7 security" as delivered vs planned.
- Any price/band detail beyond the published ₹48 lakh entry.
