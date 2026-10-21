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

**Invoice**:
A dated, numbered, frozen record of a Booking's details and payment position at the
moment it was issued, delivered to the client as a picture. A Booking can hold
several Invoices, each keeping what the client was told at that point; an Invoice is
never a live view of the Booking.
_Avoid_: Bill, receipt, kwitansi, tagihan.

**Invoice Number**:
The number, drawn from the one business-wide `invc-NN/YYYY` series, that identifies an
Invoice. The series restarts every January and takes its year from the issue date;
the admin never types it because the next number is allocated when the Invoice is
issued.
_Avoid_: Reference number, document number.

**Payment Status**:
The payment position an Invoice records: `Lunas` when the DP is at least the agreed
total, otherwise `DP diterima`. It is derived from the Invoice's own copied amounts,
never stored and never set by hand.
_Avoid_: Payment state, paid flag.

**Headcount**:
The number of people to be made up in one booking. One service per booking, and the
price is multiplied by the headcount; an Invoice still prints the agreed total, not
price × headcount.
_Avoid_: Guest count, pax, quantity.

**Style**:
The styling the client chooses: Hijabdo (styled over a hijab) or Hairdo (styled on
open hair). A choice, not a description, and not a Reference: a Style is the
answer itself, while a Reference only points at what the client means.
_Avoid_: Model rambut, hairstyle.

**Reference**:
A link, or a short written description, of the look the client wants, sent with a
Booking Request.
_Avoid_: Photo, attachment.
