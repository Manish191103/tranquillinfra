# P1-1 — RERA / HMDA verification request (Phase 1 gate)

**Status:** OPEN — blocking the brand Google Ads launch
**Owner:** Business / legal (decision) · Media buyer (downstream)
**Asked of:** [EDIT: name of the person who holds the approval letters]
**Date opened:** 2026-10-06

---

## 1. Why this is a gate, not a copy tweak

The brand campaign cannot launch until the project's registration status is
confirmed. Under the Real Estate (Regulation & Development) Act, 2016 a promoter
may not advertise, market or offer a project for sale before it is registered
with the Authority (s.3), and a registered project's advertisements must carry
the registration reference. Confirm the exact clause with counsel — the point is
that this is a legal precondition, not a wording preference. A "claims-free" ad
does not sidestep it.

Two facts make this urgent:

1. This site already publishes the RERA number and emits it as an
   `hasCertification` node in structured data (`src/lib/schema.ts:141`,
   `:584`), and prints it in the brochure and every page's announcement bar. The
   claim is already public.
2. The number **could not be confirmed** on the Telangana RERA portal's own
   exact-match project search on 2026-09-30 (`src/config/project.config.ts:150`).
   This is not proof of absence — the public search is captcha-gated and has no
   permalink — but it is unresolved.

## 2. What we know (published facts)

| Fact | Value | Source |
|---|---|---|
| Project | Tranquill City | `src/config/project.config.ts:107` |
| RERA number as published | `REA01100108192` | `src/config/project.config.ts:190` |
| HMDA number as published | `2103/HMDA/SWDL/2026` | `src/config/project.config.ts:195` |
| Location | Rudraram village, Patancheru mandal, Sangareddy district | `project.config.ts:141` |
| Coordinates | 17.585611, 78.148361 | `project.config.ts:146` |
| Layout | 82 parcels (4 under HMDA Mortgage), 19,410 sq.m / 4.8 acre | `project.config.ts:70` |
| Claimed promoter entity | **inconsistent** — see §3 | — |

## 3. Sub-blocker P1-1a — promoter entity name is inconsistent

RERA registration is tied to a **specific promoter legal entity**. The site names
two different ones:

| Where | Name stated |
|---|---|
| `src/config/site.config.ts:15` (`legalName`) | Tranquill Infra Projects **Pvt. Ltd.** |
| `src/config/about.config.ts:133` | Tranquill Infra Projects **Pvt. Ltd.** |
| `src/contact.ts:79` (footer NAP) | Tranquill Infra Projects **LLP** |

A certificate naming the LLP will not match an advertisement or structured-data
claim in the name of the Pvt. Ltd., and vice versa. The certificate must settle
which entity is the registered promoter.

## 4. Name-collision warning for the person searching

A **different**, genuinely registered plotted development called "TRANQUIL CITY"
exists in Ranga Reddy district under another promoter (**Samyuktha Developers**).
A name search that returns a record is not, by itself, this project. Match on the
promoter entity, the village/mandal/district and the survey details — not the
project name alone.

## 5. What we need from the business

Please provide **one of** the following.

**If the project is registered:**
- [ ] The RERA **registration certificate** for Tranquill City (the registration
      letter/Form with the registration number on it).
- [ ] A screenshot or PDF of the project's page on the Telangana RERA search
      portal, showing the number, project name, promoter entity and location.
- [ ] Confirmation of the **exact promoter legal entity** on the certificate
      (resolves P1-1a).
- [ ] If the number differs from `REA01100108192`, the correct number.

**If the project is not registered:**
- [ ] Confirmation that it is not registered, and the status/timeline of any
      application.
- [ ] Instruction on whether any advertising may run in the interim (expected:
      none, per s.3 — confirm with counsel).

**In both cases:**
- [ ] The **HMDA layout permission** document/proceedings for
      `2103/HMDA/SWDL/2026` (year, file number, district, mandal, village), or the
      correct reference if it differs.

## 6. How to verify (for the business, or counsel)

- **RERA:** https://rera.telangana.gov.in/ → *Search Registered Projects and
  Agents* → search by project name, by promoter name and by registration number.
  The public search is captcha-gated; there is no permalink for a single number.
- **HMDA:** https://masterplan.hmda.gov.in/planning/LO.aspx → *Layout Permission
  Report* → search year **2026**, file number, district **Sangareddy**, mandal
  **Patancheru**, village **Rudraram**. Confirm the village/mandal/district match;
  do not rely on a project-name match.

## 7. Verification attempts already made (2026-10-06)

| Target | Result |
|---|---|
| `rera.telangana.gov.in` (main portal) | Reachable (HTTP 200) |
| `rerait.telangana.gov.in/SearchList/Search` (the search) | Unreachable from the build/CI environment (HTTP 000) — cannot be automated |
| `masterplan.hmda.gov.in/planning/LO.aspx` | Reachable (HTTP 200) but an interactive form; the repo notes its dataset stops at 2023 and returned no records for known-good input |
| Repo assets for a certificate/approval letter | None found |
| `public/brochure/tranquill-city-final.pdf` | Publishes both numbers (cover, plan page); **no certificate enclosed** |
| Attached brochure (2026-10-06) | Truncated/corrupt upload — unreadable; see §10 |

Automated verification is blocked. The document the business holds is the only
reliable source.

## 8. Decision template (to be completed)

- Outcome: [ ] REGISTERED · [ ] NOT REGISTERED · [ ] UNRESOLVED
- Correct RERA number: ____________________
- Registered promoter entity: ____________________
- Correct HMDA reference: ____________________
- Ad wording approved by: ____________________ Date: __________
- **Go / No-Go for Phase 1 brand launch:** ____________________

## 9. Downstream effect once decided

1. **Registered** → include the registration reference in the brand RSA/callouts
   as counsel requires; launch Phase 1. Update `project.config.ts` and
   `src/contact.ts` so the entity name is consistent (P1-1a).
2. **Not registered** → Phase 1 stops. No ads run. The site's published claim and
   structured-data node must also be reviewed separately (out of ads scope).
3. **Unresolved** → hold.

## 10. Side finding — the downloadable brochure carries non-compliant claims

The site's own downloadable brochure (`public/brochure/tranquill-city-final.pdf`)
repeats the two approval numbers but also makes claims the website deliberately
refuses, and the brochure is publicly linked. If it is reused as ad creative or
as the lead magnet the ads point to, it imports that risk into Phase 1:

| Brochure claim | Conflict |
|---|---|
| "5 Acre Semi-Gated Community" | Site publishes 4.8 acre and describes a gated layout |
| "Land value grows", "creates wealth", "appreciation", "Long-term value creations", "Early Buyers always benefit", "The Smart Investment" | Return/appreciation claims — exactly what the site's claims guardrail forbids |
| "Smooth drive to Miyapur & Lingampally", "Close to…" | Drive-time / proximity claims the site avoids (route language only) |
| "RERA NO: … HMDA NO: …" with no promoter entity | Cannot be tied to a registered promoter without the certificate |

No certificate, promoter entity or survey detail appears anywhere in the
brochure. Action: do not send paid-search traffic to the brochure or use it as
creative until P1-1 is signed off and the claims are reviewed.
