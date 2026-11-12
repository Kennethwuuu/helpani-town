# Helpani Town — submission draft

Status: prepared for owner review; not submitted or published. Replace the pending delivery links after the final release checks.

## Inspiration

Wildlife support often starts with a brief moment of concern. Helpani Town explores how an enjoyable animal-care routine can keep that interest alive and connect it to a specific project or activity.

## What it does

Players welcome a virtual green turtle, red panda, or Chinese pangolin. Species-specific habitat behavior, care stories, construction, patrol questions, and photographs give them reasons to return.

They can also join a sample conservation activity. An organizer demo uses AG Grid to review registrations and simulate attendance verification. Charity points are separate from game growth, and players can reserve a clearly fictional sponsor budget or exchange points for virtual care food.

PayPal Sandbox provides the direct project-support flow, including contributions toward a specified shade-care cloth. The server verifies the capture before recording a completed test payment. Payment, purchasing, delivery, and rescue outcomes remain distinct.

Astropods AI Gateway helps the organizer turn selected project records into a reviewable summary, budget questions, and a proposed virtual learning task with source references. The server calculates budget figures separately. Changing the selected records clears the old draft; unsupported inputs, invalid responses, and service failures have explicit handling. Every generated draft requires human review and is not automatically published into the game.

## How we built it

The web application uses JavaScript, Canvas, Node.js, SQLite, AG Grid Community, PayPal Sandbox REST APIs, and Astropods Gateway with Claude Sonnet 4.6. A Postman collection supports API exploration. Browser photos remain in IndexedDB.

## Prototype boundaries and testing

Organizations, activities, attendance verification, sponsor budgets, and rescue updates are fictional. Animal growth is virtual and payments use Sandbox test funds. The prototype does not claim official conservation partnerships, real funding arrangements, material delivery, or rescue outcomes.

Recorded tests cover real Sandbox captures, real source-based AI generation, story completion, mobile browser navigation, and simulated error recovery. Physical iPhone Safari acceptance and two checkout-display checks remain open. Public-release acceptance must be completed before submission.

## What is next

A limited pilot would validate one organization, authorized project materials, real attendance evidence, and an agreed funding mechanism before expanding.

## Delivery links

- Source repository: https://github.com/Kennethwuuu/helpani-town — MIT license and third-party notices supplied; see release checklist for final publication verification.
- Interface: English by default, with a persistent English/Chinese switch.
- Test access: no app account or personal API key. The owner supplies the existing Sandbox Personal buyer only in the private judging field; see judge-access.md.
- Working demo: [Helpani Town](https://vibecreating.tech). Hosted gameplay, AI, HTTPS, restart checks, and a reconciled USD 5 Sandbox buyer return passed. Final judge buyer access remains pending.
- Public English YouTube video, shorter than three minutes: pending.
- Submitted commit: pending final release freeze. Hosted runtime source: `e38a7440c9cce5b368af8343349dcb6a2ea5a7fe`; earlier functional baseline: `e7a5b480cd30242cd0d0009620d1c57f89c5fb12`.
