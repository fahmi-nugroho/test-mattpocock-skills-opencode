# Makeup Artist Booking

The business of a single makeup artist taking client work directly: what a booking
is, how a client's request reaches her, and what does and does not occupy the
calendar. The public website and the admin dashboard exist to publish her work and
to keep this model honest — these entries describe the work, not how it is stored.

## Language

**Booking**:
A piece of client work the admin has taken on. Only the admin creates bookings and
the public never does, and only a confirmed booking occupies the calendar.
_Avoid_: Appointment, job, order, reservation.

**Format Booking**:
The link, and the short form it opens, that the admin sends once a client has
decided to book. It is a message and nothing else: sending or opening it changes
nothing on the calendar.
_Avoid_: Booking form, intake form, request template.

**Booking Request**:
What a client sends back through a Format Booking link — the client's own details
and the time they are asking for. A Request never occupies the calendar and never
carries a price; the admin accepts it by turning it into a Booking.
_Avoid_: Inquiry, ask, quote, reservation.

**Headcount**:
The number of people to be made up in one booking. One service per booking, and the
price is multiplied by the headcount.
_Avoid_: Guest count, pax, quantity.
