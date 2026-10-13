# Open Questions and BRD Conflicts

This document records conflicts between `IND64_BRD.docx` and `API-ARCHITECTURE.md`, as well as client decisions pending approval.

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
