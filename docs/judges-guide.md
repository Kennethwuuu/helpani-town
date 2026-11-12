# Helpani Town — Judge's Guide

[Open the Web demo](https://vibecreating.tech) · [Source repository](https://github.com/Kennethwuuu/helpani-town) · [Access and Sandbox buyer arrangement](judge-access.md)

Helpani Town connects a continuing virtual animal-care game with transparent ways to support wildlife projects. Players care for a green turtle, red panda, or Chinese pangolin, explore a species-specific learning trail, and choose whether to join an activity or support a project. Astropods helps an organizer turn selected materials into a reviewable task draft. PayPal handles Sandbox checkout.

The interface defaults to **English** and includes a **Language / 语言** switch in the header. The chosen language persists in the current browser across pages and reloads. Generated drafts follow the selected language; changing language retains source choices and asks for a new draft.

Organizations, activities, attendance checks, budgets, and project updates are fictional. Animal care, food, photographs, and medals are virtual. PayPal uses test funds. Procurement, delivery, organization partnerships, data permissions, and actual rescue outcomes are separate from this prototype's payment and game records.

## Five-minute walkthrough

1. On `/`, choose **Green turtle**, **Red panda**, or **Chinese pangolin**. Say hello, then feed the animal. Welcoming it gives one virtual food; feeding consumes one food and adds 10 game XP. Care stories unlock at 1, 3, 5 and 6 feedings. **Advance demo day** allows a demonstration of later visits.
2. Explore the care area's habitat layout, camera, and patrol. Roll the die, answer a question, and read the explanation and source. Each species has eight trail cells, six questions, knowledge records, and virtual rewards. Care-story and patrol-story progress are separate.
3. Open `/activities` and simulate signup for **Wetland cleanup**. Open **Organizer demo** (`/organizer`), search for the activity, and simulate verification. Return to Activities and refresh to see 100 charity points. Attendance verification is a fictional organizer action.
4. Open `/support` and reserve USD 2 of the fictional sponsor budget using 100 points. This is a simulated reservation, not a real payout. The alternative use of the same points is 50 points for one virtual food.
5. Open `/project-draft`. Select all three fictional sources and generate a draft. The source-derived budget is USD 100 target, eight items at USD 8 totaling USD 64, and USD 36 awaiting details. Select only **Observation area notes** and generate again: the old draft clears and the budget becomes unknown. Follow the task citation and compare the generated claims against the selected source. Budget arithmetic is deterministic; summaries and task suggestions come from the model and require human review.
6. Optionally test PayPal Sandbox on `/support`. Use the existing Personal buyer supplied in the event's private judging instructions. The USD 8 material option records a test payment for one shade-care cloth; **Material awaiting purchase (demo)** does not establish shipment, receipt, or rescue results. [Buyer-access details](judge-access.md)

Hosted AI access uses the maintainer's server credentials. It permits 100 actual Gateway attempts globally, 10 per demo session, and one concurrent draft operation. Failed attempts and the bounded format retry consume capacity; counters have no timed reset. Source viewing and budget calculation remain usable when generation is unavailable.

## Run from source

Use Node.js **22.13 or newer** and npm. The release source is MIT-licensed; dependency and asset provenance are in [Third-party notices](../THIRD_PARTY_NOTICES.md).

```bash
git clone https://github.com/Kennethwuuu/helpani-town.git
cd helpani-town
npm ci
cp .env.example .env
npm run doctor
npm start
```

Open [localhost:3000](http://localhost:3000) and keep the terminal running. Do not open the HTML files directly. The app creates `data/helpani.sqlite`. Blank service keys leave animal care, patrols, and simulated activities playable; real model generation and Sandbox checkout require private server configuration. Preserve an existing `.env` rather than overwriting it.

If port 3000 is occupied, use a separate database and matching origin:

```bash
HOST=127.0.0.1 PORT=3120 PUBLIC_ORIGIN=http://127.0.0.1:3120 DB_PATH=data/helpani-3120-new.sqlite npm start
```

`localhost` and `127.0.0.1` have separate cookies and photo storage. Progress uses a 30-day browser demo-session cookie; photos use IndexedDB. Formal accounts and cross-device restoration are future work.

Maintainers configuring services can follow [Astropods setup](astropods-setup.md), [server operation](deploy-existing-server.md), and `.env.example`. The default doctor command makes no API requests. `npm run check:ai` explicitly performs two live drafts with up to four Gateway attempts and can consume provider usage. Judges using the hosted app do not need these credentials or setup steps.

The [release checklist](release-checklist-2026-11-12.md) records remaining acceptance, including the public English video, private buyer-field handoff, and physical-iPhone checks. Earlier [hosted deployment evidence](vps-deployment-2026-11-12.md) describes its tested version, not automatic certification of every later release.
