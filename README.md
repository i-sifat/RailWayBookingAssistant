# Railway Booking Assistant

Local-first Chrome MV3 extension that **reduces form-filling time** on a railway
website you are **already manually logged into**.

## Principles

- You log in manually. The extension never asks for, stores, or uses passwords.
- No payment credentials, OTPs, CAPTCHA solutions, banking secrets, or auth tokens.


## Site


- `https://eticket.railway.gov.bd/*`

## How to cut a ticket with this extension

The extension only fills forms faster on a site where **you** are logged in.
It never sees your password, OTP, CAPTCHA solution, or payment details, and
it stops wherever those appear. The full flow:

1. **Load the extension.** Open `chrome://extensions`, enable Developer mode,
   Load unpacked the extension folder (the desktop app's *Open Extension
   Folder* finds it for you), then pin the toolbar icon.
2. **Log in yourself.** Open https://eticket.railway.gov.bd, log in with your
   own account, and keep that booking tab **open**. Nothing happens on a
   closed tab or while logged out.
3. **Fill the popup.** Click the toolbar icon and enter From / To using the
   exact station names the site shows, journey date, watch time, and
   passengers. Press **Save** — the Save button disappears once everything
   is stored. Change any detail and it comes back; Save again to store.
4. **Arm the assistant.** Press the primary button (*Arm the assistant*).
   Status becomes **Armed**: the extension now waits for your booking time.
5. **At booking time**, with the railway tab open, the assistant fills
   origin, destination, and date, reads every field back to verify it,
   searches, picks your exact train and class (it never substitutes unless
   you ticked the substitution box), fills passenger names, and selects
   the ticket. If you already searched manually, it picks up directly
   from the results page instead of re-filling the form. If every
   matching train shows zero seats, it stops and tells you plainly
   instead of clicking a sold-out row.
6. **You finish it.** The status becomes **Seat secured** (or **Needs you**
   at a CAPTCHA / OTP / queue / payment step). Review the train, date,
   passengers, and price yourself, then type the OTP, solve the CAPTCHA,
   and pay manually in the railway tab.

Status meanings: **Idle** (nothing stored/armed) · **Armed** (waiting for
the time) · **Booking now** (working — don't close the tab) · **Seat
secured** (filled, ready for you to pay) · **Needs you / Couldn't finish**
(stopped with the reason shown — take over manually) · **Stop watching**
halts everything.

Nothing filled on the site? Check, in order: did you press Arm (not just
Save)? Has the watch time passed? Is the railway tab open and logged in?
Are station names spelled exactly as the site shows them, underscores
included (e.g. `Biman_Bandar`, not `Biman Bandar`)? Does the status bar
show an error, a dialog notice, or an unexpected-page message? A popup
dialog on the page (login prompt, seat map) always hands control back to
you. The site is an Angular app, so the assistant only acts when it
positively recognizes the booking form or results — otherwise it waits
and says so instead of clicking blindly.
