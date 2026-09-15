# KrePay Country/Currency Matrix and Tobago Pilot Plan (Phase 3.E)

CODE-INSPECTED, 2026-09-15. Complements the existing `KREPAY_PAYMENT_CAPABILITY_MATRIX.md` (capability-by-capability feasibility, already thorough) with the two pieces it doesn't cover: a literal country/currency table, and a concrete Tobago pilot plan. Read that document first for the capability-level analysis (marketplace splits, KYC, chargebacks, reconciliation) — this document doesn't repeat it.

## 1. Country/currency matrix — literal, from source

`supabase/functions/wallet-add-bank/index.ts`'s `SUPPORTED_COUNTRIES` constant is the authoritative allowlist — it's checked server-side specifically so a crafted request can't bypass the frontend picker and reach Stripe with an unsupported combination (the comment in the source says so directly). This is the complete, real list:

| Country | Currency | Requires routing number | IBAN length |
|---|---|---|---|
| US | USD | Yes | — |
| CA | CAD | Yes | — |
| GB | GBP | Yes | — |
| AU | AUD | Yes | — |
| DE | EUR | No | 22 |
| FR | EUR | No | 27 |
| NL | EUR | No | 18 |
| ES | EUR | No | 24 |

**Confirmed absent, both grep'd this pass and previously:**
- **Indonesia** — not in this list, despite being referenced elsewhere in the product as a market of interest. Zero payout support today.
- **Any Caribbean country** — not in this list. Zero `PowerTranz` or `WiPay` references anywhere in `.ts`/`.tsx` source (checked again this pass — zero matches, confirming the capability matrix's row T: "PowerTranz is marketing-copy-only").

This list lives in exactly one file, unshared. If a second onboarding surface exists anywhere that duplicates this list by hand rather than importing it, it will silently drift from this one — worth a follow-up grep before treating this table as guaranteed platform-wide, though this pass found only the one definition site.

## 2. Currency scope elsewhere in the product

The capability matrix's row Q already flags this as "not independently confirmed for checkout/subscription pricing" beyond the bank-linking layer. This document doesn't resolve that gap — flagging it again so it isn't lost between the two documents: **do not assume checkout/subscription pricing supports the same 5-currency set as payout** without a separate read of `create-checkout`/`Subscription.tsx`'s actual price-ID currency (both are USD-denominated Stripe Price IDs per the Stripe mode-mismatch fix landed this session — so subscription pricing is USD-only today, narrower than the payout currency list above).

## 3. Tobago — qualified research, not traction (confirmed again this pass)

The Bible's own section 30 already frames Tobago correctly: a prospective enterprise opportunity, no conversation with the Tobago Festivals Commission yet, no validated budget or procurement position. This section adds the technical answer underneath that framing — what's actually buildable in 90 days, given zero Caribbean payment infrastructure exists (§1 above) and won't exist by any near-term deadline (building a licensed payment rail in a new jurisdiction is not a 90-day project under any circumstance, regardless of engineering effort — see the capability matrix's own note on capability M, KYC/KYB, being "the single most regulation-heavy piece in the entire inventory").

### 3.1 What NOT to build
A real Caribbean-region Stripe Connect equivalent, a PowerTranz/WiPay integration, or any licensed payment rail. None of these are honestly achievable in a pilot timeframe, and attempting one risks presenting an unlicensed, untested payment flow as production-ready for a real festival's real ticket buyers — a materially worse outcome than not bidding.

### 3.2 What IS buildable and honest: the manual-payment pilot

Kretopia already has a security-hardened, working manual-payment path: the self-attestation RPCs (`confirm_invoice_paid_manually`/`confirm_milestone_paid_offline`, per the capability matrix's row F) that let a payer/issuer record "this was paid by real-world bank transfer or cash outside the platform," while the milestone/invoice itself stays inside Kretopia's normal record — assignment, status tracking, notifications, and (once this session's milestone-payout-attribution fix is live) correct payee attribution.

**Concrete pilot shape:**
1. Tobago Festivals Commission participants get invoiced/milestoned through Kretopia normally.
2. Payment happens by real-world bank transfer or cash, outside the platform (no Stripe, no new payment code).
3. The payer or an authorized staff member confirms payment via the existing self-report RPC — the same mechanism already used and hardened for the manual-payment path generally.
4. Kretopia's record of "what was agreed, what was delivered, what was paid" stays accurate and centralized, without Kretopia ever touching the actual money movement or taking on payment-facilitator regulatory exposure in a jurisdiction it has no license in.

**This is honestly a scoping choice, not a workaround to hide.** State it as such to the Commission and in any public materials: "payment confirmation is recorded manually today; automated Caribbean payment rails are a future phase, not part of this pilot."

### 3.3 What this displaces
Per the Bible's own note: running this seriously — support, monitoring the honor-system flow, onboarding a new institutional partner — competes directly for the same engineering/support hours as the G0/P0 repair list from this same session. Worth deciding explicitly which comes first rather than assuming both proceed at full pace simultaneously; that's a resourcing decision for Ethan/Jeff, not something this document should resolve.

### 3.4 Product decisions required before committing to this pilot
- Confirm the Commission conversation and procurement position exist before any engineering commitment (per the Bible's own framing — this document only removes the "is it technically possible" uncertainty, not the "is there a real deal" uncertainty).
- Decide the resourcing tradeoff in §3.3.
- Decide whether the manual-payment framing (§3.2) is acceptable to present to a real institutional partner, or whether the Commission's own expectations require something closer to a real payment rail — if the latter, this pilot is not ready and needs a different, longer-timeline plan.
