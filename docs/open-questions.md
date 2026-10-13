# Open Questions and BRD Conflicts

This document records conflicts between `IND64_BRD.docx` and `API-ARCHITECTURE.md`, as well as client decisions pending business approval.

## 1. Authentication & Sign-in Mechanism
- **BRD**: Section 6, Section 7.1, and FR-AUTH-01/02 specify email + password credentials and Google OAuth ("Continue with Google"), plus password reset flows.
- **API Architecture**: Section 2, Section 5, Section 7, and Section 13 specify mobile OTP authentication using Indian E.164 phone numbers with HMAC challenge verification, rate limiting, and revocable session cookies. Password and Google OAuth are explicitly deferred pending client review.
- **Current Status**: Phase 1 implements mobile OTP authentication only. Email/password and OAuth sign-in are postponed.

## 2. User Roles & Account Model
- **BRD**: Section 5, Section 7.4, and FR-ROLE-01..03 specify additive badges: `Client`, `Artist`, and `Agency`. An Agency account is an organisation managing multiple artists.
- **API Architecture**: Section 5 and Section 6 specify canonical roles `customer`, `artist`, and `administrator` linked via `Membership` records. Section 2 notes that registration UI `organiser` maps to canonical `customer`. Agency roster models and multi-artist delegation are deferred.
- **Current Status**: Implemented roles in Phase 1 are `customer`, `artist`, and `administrator`. Agency multi-artist roster capabilities are pending client architecture sign-off.

## 3. Role Nomenclature ("Client" vs "Customer")
- **BRD**: Refers to the booking user as "Client".
- **API Architecture**: Refers to the booking user as "Customer" (`customer`).
- **Current Status**: Canonical database role and internal API terminology use `customer`.

## 4. SMS Provider & Verification Limits
- **Pending Decision**: Selection of production SMS provider (e.g., Twilio, AWS SNS, MSG91) and final pricing/country expansion. Phase 1 provides an in-memory `FakeSmsAdapter` and dev OTP retrieval endpoint for testing and development.

## 5. Payments Scope in Initial Release
- **Context**: The BRD does not specify payment gateways or processing mechanics (noted as out of scope in BRD Section 3.3). The API Architecture plans for payment orders, ledger entries, refunds, and payouts in Phase 5.
- **Pending Decision**: Which payment aggregator will be selected (e.g. Razorpay, Cashfree, Stripe India)? What settlement timeline and payout mechanism will be supported for artists and agencies?

## 6. Ratings & Reviews Lifecycle
- **Context**: BRD observed star ratings and completed booking counts on artist cards, but the post-event submission interface was out of scope / uncaptured.
- **Pending Decision**: What triggers rating eligibility (e.g., event completion status)? Can artists publicly reply to reviews? How are moderation and disputes handled?

## 7. Platform Admin Console Scope & Moderation SLAs
- **Context**: Both BRD and API Architecture infer a moderation step moving artist profiles from "Pending" to "Live".
- **Pending Decision**: What tools and SLAs will moderators have for approving artist identity, bank details, and portfolio media before publication?

## 8. Platform Commission, Deposit, and Cancellation Policy
- **Context**: API Architecture Section 14 highlights business rules needing sign-off.
- **Pending Decision**:
  - Platform take-rate / commission percentage.
  - Required deposit percentage to confirm a booking hold.
  - Tiered cancellation penalty rules (e.g., full refund >14 days prior, 50% 7-14 days prior, no refund <7 days prior).

## 9. DPDP Act 2023 Compliance & Data Retention Requirements
- **Context**: NFR-PRIV-01 requires compliance with India's Digital Personal Data Protection (DPDP) Act 2023.
- **Pending Decision**: Explicit retention schedules for inactive accounts, audit logs, and message histories, plus mechanisms for fulfilling user data correction and erasure requests.
