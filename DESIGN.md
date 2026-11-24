---
name: Wandana Makeup
description: Warm neutrals and serif headings frame the makeup portfolio and carry through to the booking dashboard.
colors:
  cream: "#fdf9f4"
  espresso: "#2e2620"
  gold: "#b45309"
  gold-deep: "#92400e"
  gold-soft: "#f7ead3"
  whatsapp: "oklch(52.7% 0.154 150.069)"
  whatsapp-hover: "oklch(44.8% 0.119 151.328)"
  stone-900: "oklch(21.6% 0.006 56.043)"
  white: "#fff"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.428571
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
  full: "9999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    padding: "0.625rem 1.5rem"
  button-whatsapp-hover:
    backgroundColor: "{colors.whatsapp-hover}"
  button-prices:
    backgroundColor: "{colors.stone-900}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    padding: "0.625rem 1.5rem"
  field-admin:
    height: "2.75rem"
    rounded: "{rounded.lg}"
  nav-admin-active:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.gold-deep}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 0.75rem"
  badge-featured:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.gold-deep}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.75rem"
  card-service:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.2xl}"
---

# Design System for Wandana Makeup

## Overview

The public site pairs warm neutrals and serif headings with portraits and portfolio photography. The dashboard carries the same palette into denser lists and forms, with clear labels and compact controls.

## Colors

- Cream grounds the page. White distinguishes cards and dialogs. Espresso is the default text color, with stone and neutral shades for secondary copy and borders.
- Gold accents small brand details and keyboard focus. Soft gold pairs with deep gold on featured labels and the active admin tab.
- Green identifies WhatsApp actions. The calendar uses labels alongside status colors, and the admin uses red for errors and green for successful saves.

## Typography

Playfair Display sets the main page and section headings. Inter covers body copy, prices, navigation, and form labels. The hero heading grows from 1.875rem on phones to 3rem on desktop. The Invoice also uses Courier Prime for its body and Great Vibes for the closing line.

## Layout

Public and admin shells cap at 72rem with 1rem phone gutters. The homepage starts with stacked copy and portrait, then switches to two columns at 64rem. Service cards use one column by default, two at 40rem, and three at 64rem. The admin uses a sticky section picker on smaller screens and a 13rem sidebar from 64rem.

## Elevation & Depth

White cards use fine borders with a small shadow on public service and testimonial cards. Admin panels rely on borders. Dialogs use a darker backdrop and a deeper shadow.

## Shapes

Actions, filters, and badges are pill-shaped. Admin fields and navigation items use 0.5rem corners. Admin panels use 0.75rem corners, and service cards and dialogs use 1rem corners.

## Components

- The hero pairs a green **Chat WhatsApp** action with a dark **Lihat Harga** action. Both use white semibold labels and a darker hover state.
- Service cards show a cover when available, a prominent IDR price, a smaller duration, and a WhatsApp action. The **Paling Dipilih** badge uses soft gold.
- Admin forms use visible labels and bordered fields. The active desktop tab shares the featured badge’s soft gold and deep gold pairing.
- The portfolio uses category pills with a pressed state. The calendar uses a seven-column grid and opens day details in a bottom sheet on phones and a centered panel on wider screens.
