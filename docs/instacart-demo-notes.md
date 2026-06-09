# Instacart-in-Claude demo — notes & YouTube metadata

Source video: `~/Downloads/Screen Recording 2026-05-29 at 11.13.23 AM.mov` (~5:26).
Captured 2026-05-29 to discuss alongside the product-picker MCP app.

---

## YouTube title

**Shopping with Claude + Instacart: from recipe to grocery cart in one conversation**

Alternates:
- I asked Claude to cook Colombian food — then buy the groceries (Instacart in Claude)
- Claude + Instacart: build a real grocery cart by chatting (bandeja paisa demo)

---

## YouTube description

Claude now connects to Instacart. In this demo I go from "let's make a Colombian
dish" to a fully built, store-specific grocery cart — without ever leaving the
conversation. Claude plans the recipe, assembles the cart from real products with
live prices, and then hands checkout back to me: it explicitly will NOT complete
the purchase. That last part is the whole point of how agentic commerce is meant
to work.

This is built on MCP Apps: the Instacart cart is a thin interactive widget
embedded in chat, fed by server data, while the agent orchestrates everything
else in conversation.

Chapters:
0:00  Connect Instacart (OAuth — "Authorize Claude to use your account")
0:45  "Let's make a Colombian dish" — recipe planning in plain chat
2:00  Claude picks bandeja paisa and writes the full recipe
2:45  "Let's buy these ingredients in Instacart" — hand-off to the embed
3:30  The embedded cart: real products, live prices, quantity steppers, swaps
4:30  Adjusting quantities; subtotal updates live (~$43 → ~$53)
4:45  "I'm ready to checkout" → Claude declines to check out, hands off
5:00  Real Instacart "Place order" screen opens in the browser

Key takeaway: Claude builds the cart in conversation and hands it to your own
Instacart account to complete. No payment is collected in chat. Confirm-before-
purchase by design.

#Claude #Instacart #MCP #AgenticCommerce #AI

---

## My observations (for discussion)

### What the video actually does
1. **Connect** — Settings → Connectors → Instacart OAuth → "Authorize Claude to
   use your account?" → Allow. One-time account link; Claude acts via the user's
   account, not credentials in chat.
2. **Conversation first, no UI** — recipe Q&A (clarifying multiple-choice, then a
   full bandeja paisa recipe) happens as plain chat text. No widget yet.
3. **Hand-off to the embed** — user says "buy these ingredients in Instacart";
   Claude renders an `Instacart` embed (skeleton → filled cart).
4. **Embedded cart widget** — real store-specific products (Cardenas Markets),
   live prices + sale strikethroughs, quantity steppers, swap/substitute icon,
   "Checkout on Instacart" button, live subtotal. Claude narrates beside it.
5. **Checkout stays with the user** — "I can't run the checkout for you… that's a
   step I leave in your hands." Clicking through opens a real instacart.com
   checkout / "Place order" tab. Claude never handles payment.

### How it maps to MCP Apps
- OAuth consent            → host capability/connector delegation
- Recipe Q&A as text       → agent orchestrates; UI only when it adds value
- Cart card in chat        → app resource in a sandboxed iframe (registerAppResource + _meta.ui.resourceUri)
- Live products/steppers   → thin interaction surface fed by server data
- Subtotal + narration sync→ tool ↔ UI ↔ model loop (ontoolresult / updateModelContext)
- "I won't check out" → tab→ build cart in conversation, hand off to user's account; no embedded transaction layer

### How it relates to this repo (product-picker)
Same architecture, scaled down. Validates our direction:
- Thin UI + agent orchestration ✅ (selection-only iframe, Claude drives checkout)
- State sync ✅ (add-to-cart/set-quantity route back via ontoolresult)

Where the repo diverges from the real pattern:
1. We collect shipping + run a mock `pay-order` INSIDE chat. Instacart refuses to
   check out and bounces to instacart.com. Idiomatic move: drop set-shipping /
   place-order / pay-order; end with a checkout-URL hand-off (openLink equivalent).
2. No account/connector step. Real commerce starts with OAuth "authorize Claude."
   Ours is a self-contained in-memory demo.
3. No synthetic hand-off message. The *user* types "let's buy these" / "I'm ready
   to checkout." Argues for option #1 (silent) in our app: let the user speak;
   Claude reacts to the cart it already sees.

### Proposed next step (to decide)
Replace the in-chat payment mock with a checkout-URL hand-off, and optionally
model a connector/auth step — rather than simulating payment in the conversation.
