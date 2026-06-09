# Instacart-in-Gemini demo — notes & YouTube metadata

Source video: `~/Downloads/Screen Recording 2026-05-29 at 11.58.59 AM.mov` (~4:32).
Captured 2026-05-29. Companion to [instacart-demo-notes.md](./instacart-demo-notes.md)
(the Claude version) — same Instacart connector, different host.

---

## YouTube title

**The same Instacart shopping experience — but in Gemini (cross-host connectors)**

Alternates:
- Cooking Pasta Primavera with Gemini + Instacart (and editing the cart by chat)
- Instacart works in Gemini too: build a Costco cart by talking
- One Instacart connector, two AI hosts: Gemini vs Claude

---

## YouTube description

Instacart's connector isn't Claude-only. Here it's running inside Google Gemini:
I go from "let's cook Italian Pasta Primavera" to a full Costco cart, edit it by
chatting ("remove some items"), and Gemini points me to do the rest in the embedded
widget. Just like Claude, Gemini builds the cart but won't place the order — checkout
happens on Instacart, with my own account and payment.

The interesting bit for builders: this is the same embeddable shopping app surfacing
across two different AI hosts, with an explicit capability contract (what the agent
CAN and CANNOT do). That's the cross-host promise of MCP-style apps in action.

Chapters:
0:00  Connect Instacart in Gemini settings (Connected Apps)
0:15  The connector contract — CAN: find stores, search products, add to cart / CANNOT: place orders, track status, find delivery times
0:45  "Let's cook Italian Pasta Primavera, get ingredients from Instacart"
1:15  Gemini asks which store; I pick Costco → "Connecting to Instacart"
2:00  Recipe steps + embedded Costco cart widget (18 items, live prices, ~$244)
3:00  "Can you remove some items?" — Gemini lists non-recipe items, edits cart by chat
3:30  Remove Kirkland Pork Belly → cart re-syncs (subtotal ~$209)
4:00  "Can I remove from the widget directly?" → yes: click items in the widget, or hit Checkout
4:15  Real Instacart checkout (Costco membership, Pay with Visa, Place order)

Takeaway: build cart in conversation, edit from chat OR the widget, hand off checkout
to the user's own Instacart account. No payment in chat.

#Gemini #Instacart #MCP #AgenticCommerce #AI #Connectors

---

## My observations (for discussion)

### What the video does
1. **Connect in Gemini** — Settings → Personal Intelligence → Connected Apps →
   Instacart → **Link** (toggles to **Unlink** once linked).
2. **Explicit capability contract** — the connector dialog spells out, in plain UI:
   - **CAN:** find grocery stores near you, search products, add items to your cart
   - **CANNOT:** place or manage orders, find available delivery times, track order status
   This is a visible, user-facing scope — stronger/clearer than the Claude version's
   OAuth consent text.
3. **Conversation first** — "let's cook italian food italian primavera and let's get
   ingredients from instacart." Gemini confirms the dish and asks **which store**
   (mentions a "store picker widget"); user replies "Costco" → "Connecting to Instacart."
4. **Recipe + embedded cart** — Gemini writes the recipe (steps, chef's tip), then
   renders an `Instacart` cart widget: **Costco, 18 items**, product thumbnails, live
   prices with strikethrough sales, quantity steppers, items subtotal (~$244 → ~$209
   after edits), and a blue **"Checkout on Instacart"** button. "8% service fee" note.
5. **Edit the cart by chat** — "can you remove some items from the shopping cart?"
   Gemini lists the non-primavera leftovers from a previous session and offers to
   clear them; user removes Kirkland Pork Belly → "Connecting to Instacart" → cart
   re-syncs with new subtotal.
6. **Edit from the widget too** — "Can I remove the item from the widget directly?"
   Gemini: "Yes — click any item in the widget to change quantity or remove, or click
   Checkout whenever you're ready." Explicitly bidirectional (chat ↔ widget).
7. **Checkout stays with the user** — clicking through opens the real instacart.com
   checkout (Costco membership prompt, Pay with Visa, Place order). Gemini never
   places the order or handles payment — matches the CANNOT list from step 2.

### How it maps to MCP Apps / cross-host
- Capability contract (CAN/CANNOT)  → declared tool surface + host-enforced scope
- Store picker / cart widget        → app resource in a sandboxed iframe
- Chat edits re-sync the widget     → tool ↔ UI ↔ model loop (our ontoolresult equivalent)
- "Edit in the widget directly"     → UI-callable tools mutating shared server state
- "Won't place the order" → tab     → build cart, hand off to user's account; no embedded transaction layer
- **Same app in Gemini AND Claude** → the headline: one embeddable shopping surface,
  portable across hosts. This is the cross-host payoff MCP Apps is built for.

### Claude vs Gemini (the two demos side by side)
| | Claude (11:13 video) | Gemini (11:58 video) |
|---|---|---|
| Dish | Bandeja paisa | Pasta primavera |
| Store | Cardenas Markets | Costco |
| Capability scope shown | OAuth consent text | Explicit CAN/CANNOT list |
| Cart edits | quantity in widget | by chat AND in widget (called out) |
| Checkout | refuses, opens instacart.com | refuses, opens instacart.com |
| Payment in chat | none | none |
Both: thin widget + agent orchestration + hand-off to user's own account.

### How it relates to this repo (product-picker)
- Reinforces everything from the Claude notes, plus two new lessons:
  1. **Publish a capability contract.** Gemini's CAN/CANNOT panel is a clean model
     for how to describe our tools to the user — and an argument for NOT having a
     `pay-order`/`place-order` tool at all (it'd be a "CANNOT" in real commerce).
  2. **Bidirectional edits are the expected UX.** Gemini confirms editing from both
     chat and the widget is normal — exactly the sync our app already does. Keep it.
- Cross-host portability is the strategic point: if our picker is a clean MCP App, it
  should likewise run anywhere that supports the extension, not just Claude Desktop.

### Open decision (carried over)
Replace the in-chat payment mock with a checkout-URL hand-off; consider modeling a
connector/auth step + a visible capability contract instead of simulating payment.
