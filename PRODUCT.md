# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Clients looking for makeup services for an event. They often start on a phone and want to see the artist’s work, find a suitable service, and check a date before getting in touch.
- The makeup artist who runs Wandana Makeup. She handles client conversations, manages her schedule and payments, and updates public content from the private dashboard.

## Product Purpose

Wandana Makeup helps clients decide whether to contact the artist and gives the artist a place to turn those conversations into confirmed work. A client can go from browsing the portfolio to asking about a service or date in WhatsApp without creating an account. The artist can manage the resulting Booking, payment details, and Invoices without retyping the same information from chat.

## Positioning

Wandana Makeup is a single artist’s portfolio and booking workspace. Booking conversations happen directly with the artist in WhatsApp. The priority client segment and what sets the business apart from other makeup artists are open decisions.

## Operating Context

- Clients browse the portfolio, services, prices in Indonesian rupiah, and approximate availability. They can open a WhatsApp message with the service or date already filled in.
- Once a client decides to book, the artist can send a **Format Booking** link in the same chat. The client submits a **Booking Request** with event details and the requested time. The artist reviews it and can use it to create a **Booking**. The artist can also create a Booking directly.
- The artist can publish or hide portfolio items, services, profile statistics, and testimonials, and update the business profile and contact details from the dashboard.
- The artist records the **Agreed Total**, **DP**, and **Pelunasan**. Each numbered **Invoice** preserves the Service and payment details at issue time and can be shared or resent as an image. A Booking can have several Invoices.

## Capabilities and Constraints

- Booking Requests may carry a proposed time but have no price or hold on the schedule. The artist alone creates and confirms Bookings. Only confirmed Bookings occupy time alongside admin-managed Blocks and closed dates.
- Public availability shows closures and occupied ranges without exposing client details. A date marked available can still have occupied times. The artist confirms the actual time in WhatsApp.
- The app is the source of truth for Bookings. The optional **Calendar Mirror** copies confirmed Bookings to a dedicated Google Calendar in one direction. Blocks and closed dates stay in the app.
- The artist keeps **Bagian MUA**, her share after paying collaborators, private. Client Invoices exclude it. Booking edits preserve earlier issued Invoices.
- [GLOSSARY.md](GLOSSARY.md) defines the project’s booking and payment terms. [Architecture decision records](docs/adr/) explain the calendar, intake, and Invoice rules.

## Brand Commitments

Use the business name **Wandana Makeup** and Indonesian interface copy. The business name is maintained in [`src/lib/brand.ts`](src/lib/brand.ts).

## Evidence on Hand

The artist can publish a portrait, portfolio images, statistics, and client testimonials. The repository also contains fallback statistics and testimonials in [`src/lib/hero-proof.ts`](src/lib/hero-proof.ts). Verify those with the artist before relying on them as evidence for a claim.

## Product Principles

1. Give clients enough information about the work, prices, and schedule to start a specific conversation.
2. Keep booking and payment decisions with the artist. Treat a Booking Request as client input and a confirmation as a separate action.
3. Capture client details once and carry them through to the Booking. Preserve the details of each saved Invoice so the artist can resend the same record.
