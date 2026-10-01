# Atlas CMMS — layout notes

Reference notes on the hosted Atlas CMMS app (app.atlas-cmms.com, Business-plan trial),
taken from screenshots, to guide the PM System's layout. Ideas only: Atlas is AGPL, so
we copy no code or assets.

Screens reviewed so far:

| Date | Screen | URL |
|------|--------|-----|
| 2026-10-01 | Purchase Requests (empty list) | `/app/purchase-orders` |

Part 2 (below the screenshot notes) comes from reading Atlas's open-source frontend and
mobile code on GitHub (`Grashjs/cmms`, Oct 2026). Its docs site isn't reachable from the
build environment.

---

## 1. Overall frame

The layout has three parts:

- **Left sidebar.** Fixed and dark, roughly 17% of a wide screen (about 335 px at 2000 px).
- **Content header.** A white bar across the top of the content area.
- **Content area.** A light grey background (about `#f4f5fb`), with white cards on it.

The look is Material UI (MUI): rounded corners, soft shadows, and an indigo/blue
primary color (about `#5569ff`).

Two things float over the page:

- **Support chat bubble.** A blue circle with a red count badge, fixed at the bottom right
  (Intercom-style).
- **No breadcrumb trail.** Navigation context comes only from the sidebar's active item.

## 2. Sidebar

From top to bottom:

1. **Logo block.** The "A" mark centered, with "Powered by Intelloop" under it, then a thin
   divider.
2. **Trial / plan card.** A bright cyan-to-blue rounded card reading "Your trial ends in
   15 days / You are on the Business plan", with a solid indigo **Upgrade** button. This is
   SaaS-only.
3. **Navigation list.** Each item is an outline-style icon plus a label in white, about
   18 px text.
   - **Count badges.** Some items have a small blue circle with a number: Work Orders
     shows **1** and Requests shows **1**, meaning open or pending items.
   - **Collapsible groups.** Groups have a chevron that points up when open and down when
     closed. An open group gets a slightly lighter background block.
   - **Two levels of nesting** are visible under Statistics:
     - **Statistics** (open)
       - • **Work Orders** (open; the bullet marks the current section)
         - Status Report
         - Work Order analysis
         - Work Order Aging
         - Time and Cost
       - **Assets** (closed)
       - **Parts** (closed)
       - **Requests** (closed)
   - **Top-level items seen:** Work Orders (1), Preventive Maintenance, Statistics…,
     Requests (1).
   - **Items below the scroll** (from the source code's menu): Assets, Locations, Parts &
     Inventory, Purchase Orders, Meters, People & Teams, Vendors & Customers, Categories,
     Files, Settings. The sidebar scrolls on its own, independent of the page.
4. **Bottom toolbar.** Four square icon buttons, pinned to the bottom of the sidebar:
   import/upload, help (?), calendar, and sign out (power icon).

**Observation:** the Statistics section takes most of the visible sidebar when expanded,
which pushes the everyday modules (Assets, Parts) out of view. Reports deserve a single
entry or a dashboard page, not a deep tree in the main nav.

## 3. Content header (top bar)

- **Left:** a **back arrow**, a thin vertical divider, then the **page title**. The title
  is large (about 36 px), semibold, in a muted indigo/slate color.
- **Right:** a **notification bell** in a light-blue rounded square, and a **user avatar**
  circle.
- **Page name vs. URL:** the title says "Purchase Requests" while the URL and source menu
  say "purchase orders". The UI uses the friendlier word.

## 4. List page pattern (Purchase Requests)

The pattern is the same for every module list:

1. **Toolbar row** sitting on the grey background, above the card:
   - **Left:** a search box with a magnifier icon (about 250 px wide, placeholder
     "Search").
   - **Right:** the primary action, an indigo button "**+ Purchase Request**". The pattern
     is "+ <thing>".
2. **Table** inside a white rounded card:
   - **Header row:** grey background, UPPERCASE column names, thin vertical separators
     between columns.
   - **Purchase Request columns:** ID · NAME · NUMBER OF ITEMS · TOTAL COST ·
     TOTAL QUANTITY · CATEGORY · STATUS · SHIPPING TO · SHIPPING AD(DRESS)… The last column
     is cut off, so the table scrolls sideways even on a 2000 px screen.
   - **Empty state:** centered in the table, a bold line "Manage your Purchase Requests in
     a single place" and a grey hint "Press the '+' button to create a Purchase Request."
   - **Footer:** "Rows per page: 10 ▾", a "0–0 of 0" count, and ‹ › page arrows. This is
     the MUI DataGrid style.

## 5. What a purchase request holds

Taken from the columns:

- ID
- name
- number of line items
- total cost and total quantity (rolled up from the line items)
- category
- status (approval workflow; the source has an `ApprovalStatus` enum)
- shipping-to (vendor or site) and shipping address

This is a parts-and-inventory feature, for stage 3.

---

## Part 2 — From the source code

### 6. Page patterns (used throughout)

- **List + right-side drawer.** On most modules (work orders, PM, requests, locations,
  parts) clicking a row opens a **details drawer from the right**. It takes 50% of the
  width on desktop and 70–90% on mobile, so the list stays visible behind it. The drawer
  header has edit / delete / copy / close. **Assets are the exception:** a row opens a
  full detail *page* with tabs.
- **Create / edit happens in a modal dialog** (medium width), not on a separate page. The
  submit button says "Add" or "Save".
- **The list toolbar** (right-aligned):
  - a **Filter** button that opens an advanced-filter drawer from the left
  - quick **Priority** and **Status** filter chips
  - a debounced search box
  - a **⋮ menu** with Export
  - a **split button** "+ Work order" whose dropdown holds **Import from spreadsheet**
- **The tables** (MUI DataGrid): columns can be reordered, resized and hidden, with
  rows-per-page pagination underneath.
- **Tabbed page layout** ("MultipleTabsLayout"): a title, a scrollable tab bar (44 px tabs
  with a short underline indicator), action buttons on the right, then the content inside
  a card. Asset detail, analytics and settings use it.
- **Empty states** (`NoRowsMessage`): a bold one-liner plus "press + to create…".

### 7. Work orders

- **Views** are tabs at the top:
  - **List** (default)
  - **Calendar**
  - **Workload** (paid feature)
  - **Column / kanban** ("coming soon")
- **Default filter:** not archived, and status Open, In progress or On hold. **Default
  sort:** most recently updated.
- **List columns:** ID, status (colored icon), **title (bold)**, priority, description,
  assigned to (avatars), location, location address, category, asset, due date, days since
  creation, file count, requested by, completed on, updated, created.
- **Create form fields, in order:**
  - title (the only required field)
  - description and image
  - location, then asset (filtered by the location)
  - **asset status** (set the asset's status while raising the WO, e.g. Down)
  - due date, estimated start date and estimated duration (hours)
  - priority and category
  - primary worker, additional workers, customers and team
  - tasks (pick a checklist template)
  - files, a **requires signature** switch, and custom fields
- **Detail drawer:**
  - **Header:** priority badge, title, then description. On the right are ⋮, Edit and
    Delete. The ⋮ menu holds Link, **PDF report**, Email contractors, **Copy WO** and
    **Archive**.
  - **Status dropdown:** Open / In progress / On hold / Complete, with a color background
    for each. Next to it is a **timer button** that shows logged time, like a stopwatch on
    the job.
  - **Two tabs:** *Details* and *Comments (n)*.
  - **Details grid:** ID, due date, estimated start, estimated duration, category,
    location, asset and team (as links), created, primary worker, approved / created by,
    the PM it came from, requested by, time, assigned to and customers. Once complete it
    also shows completed by, completed on, feedback and signature.
  - **Collapsible sections:** **Tasks** (checklist), **Time** (labor entries),
    **Additional costs**, **Parts** (with editable quantities), **Links** to other WOs
    (blocks / blocked by / duplicate / related / split) and **Files**.
- **Completing a work order:** picking "Complete" runs checks, then a "Close WO" dialog
  asks for **feedback** and/or a **signature** when they're turned on.
- **Tasks / checklist:**
  - **Six types:** subtask (checkbox), number, text, inspection (pass/fail), multiple
    choice, and meter reading.
  - **Each answer saves immediately**, with no Submit at the end.
  - **Every task can carry its own notes and photos.**
- **Workload view:** **people as rows × the 7 days of the week**.
  - Each cell shows a **capacity bar** (warning at 80%, red at 100%+), the hours left, and
    draggable WO chips.
  - There's a team total row, week arrows and a "This week" button, a user filter, and
    chips for unscheduled / overdue / due within 48 h.

### 8. Preventive maintenance

- **List columns:** ID, name, title, priority, description, **next work order** (date),
  worker, assigned to, location, category, asset. A row opens a details drawer.
- **The form has two parts:**
  1. **Trigger:**
     - **trigger name**
     - **based on** (scheduled date / completed date)
     - **starts on** and **ends on**
     - **frequency** and **recurrence type** (daily / weekly / monthly / yearly)
     - **days of week** (only for weekly + scheduled date)
     - a due-date delay
  2. **Work order template:** the same fields as a WO (title, description, priority,
     workers, team, location, category, asset, tasks, requires signature).

### 9. Assets

- **The list is a tree** (parent/child) with expand chevrons, plus "Load more" under big
  parents. It turns into a flat list while you search.
- **Columns:** ID, name (indented by depth), status, location, image, area, model,
  barcode, category, description, primary worker, assigned to, teams, vendors, parent
  asset, created.
- **Form groups:**
  - **Asset information:** name, location, acquisition cost, description, manufacturer,
    power, model, barcode, serial number, category, area, image
  - **Assigned to:** worker, additional workers, teams
  - **More information:** customers, vendors, in-service date, warranty expiration,
    files, additional info
  - **Structure:** parts, parent asset
- **Detail page tabs:** **Details · Work orders · Parts · Files · Meters · Downtimes ·
  Statistics**, with Edit and Delete in the header.

### 10. Locations

- **Tree list** (parent/child) with columns ID, name, address, created and actions, plus a
  **Map view** tab (needs Google Maps).
- **Form:** name, address, **parent location**, workers, teams, vendors, customers, map
  pin, image and files.

### 11. Requests

- **Columns:** ID, title, description, priority, **status** (pending / approved /
  rejected), due date, asset, location, created.
- **Filters:** priority and status (approved / cancelled / pending).
- **The form uses the WO fields.** Admins configure which fields requesters see or must
  fill in.
- **An approved request links to its work order**, and clicking it opens the WO. There's
  also a **request portal**: a public form with its own configurable fields, so someone
  can report a problem without an account.

### 12. Analytics

- **Page layout:** a date-range picker at the top (default: the last month), an
  **Overview** KPI row, then a grid of charts (2-up on desktop, stacked on mobile).
- **Work orders pages:**
  - **Status report:** overview, status pie, status by date, incomplete WOs, hours worked
  - **Analysis:** WOs by primary user, by completed-by, by priority, by category, by
    week, time by week, costs
  - **Aging** and **Time & cost**
- **Asset pages:** reliability and maintenance cost. **Parts:** consumption.
  **Requests:** analysis.

### 13. Settings

Tabs: **General**, **Checklists** (reusable checklist templates), **Features**,
**Integrations**, **Roles**, plus a per-entity **fields configuration** (choose which
fields are required, optional or hidden on WO and request forms).

### 14. Mobile app (React Native)

- **Bottom tabs:** **Home · Work orders · (+) Create** (centered) **· Requests · More**.
  Requesters don't get Home.
- **Home screen:**
  - **Header icons:** scan asset (QR/barcode), WO stats, notifications (with badge),
    assets.
  - **An "Only assigned to me" switch.**
  - **Six count tiles** with colored left borders: **Open, On hold, In progress, Complete,
    Due today, High priority**. Tapping a tile opens the filtered WO list.
  - Pull to refresh.
- **Other screens:** **Scan asset** (opens the asset from its label), Tasks (a full-screen
  checklist), Notifications, Feedback, and add/edit for each entity.

---

## Takeaways from the source research

Where we stand against Atlas, and what's worth taking. "We have" means stage 1.

| Area | Atlas | We have | Recommendation |
|------|-------|---------|----------------|
| Navigation | Dark left sidebar, groups, count badges | Top bar | **Sidebar** with badges; drawer on phones |
| List → detail | Right-side drawer over the list | Separate page | Keep pages for now; they work on phones and links are shareable. Maybe a drawer on desktop later |
| Create / edit | Modal dialog | Separate page | Keep pages (long forms, phones) |
| List toolbar | Filter drawer + quick chips + search + ⋮ export + "+ X" split button (import) | Tabs + search + type filter | Add **status/priority chips**, **CSV export**, and later **import** under the + button |
| WO status | Dropdown + timer | Buttons (Start / Hold / Resume) | Keep buttons (clearer for techs); add a **labor timer** in stage 3 |
| Checklist | 6 types, **saves each answer immediately**, notes + photos per item | 4 types, saved on Complete | Add **autosave per item** (a long PM interrupted midway keeps its answers) and **per-item notes**; photos with file storage; multiple choice and meter later |
| Closing a WO | Optional **signature** + feedback | Notes | Add an optional **signature** on PM schedules (useful for safety / QMS records) |
| Work order from a problem | Request → approval → WO | — | Stage 2 **request form**, plus a **simple no-login request page** for operators |
| Assets | Tree list; detail tabs: Details / WOs / Parts / Files / Meters / Downtimes / Stats | Flat list; one page with sections | Stage 2: **parent/child tree**, **tabs** on the asset page, **downtime** |
| Locations | Tree + map | Text field | Stage 2: **location tree** (plant → area → line); skip the map |
| Raising a WO | Can set asset status (e.g. Down) | — | Stage 2: "**Asset is down**" toggle on new repair WOs → starts a downtime record |
| Reports | Date range + KPI row + chart grid | — | Stage 4, same layout |
| Workload | People × week, capacity bars | — | Later, once there are several techs and estimated hours |
| Checklist templates | Settings → Checklists | Typed per PM | Later: **reusable templates** (one forklift checklist for every forklift) |
| Mobile | Tabs Home / WOs / + / Requests / More; scan asset; tiles | Responsive web | Stage 4 **QR labels → asset page**; a **"+ " quick-create** and an **"only mine" toggle** on the dashboard |
| PDF | Work order PDF report | — | Stage 3: **printable WO / PM record** for audits |

## Takeaways from the screenshot

**Adopt:**

1. **A left sidebar instead of the top nav.** Our top nav already overflows at six items
   and stages 2–4 add Locations, Requests, Parts and Reports.
   - **Desktop:** a sidebar with icons and labels, about 240 px (narrower than Atlas).
   - **Phone:** it collapses into a menu drawer.
   - Collapsible groups for related pages, e.g. Work orders → List / Calendar.
2. **Count badges in the nav.** Show open work orders assigned to the viewer, or overdue
   ones, and pending requests (stage 2). The badge is a cheap, glanceable "what needs me"
   signal.
3. **A consistent page header.** Title on the left, with a back arrow on detail pages;
   page actions on the right.
4. **A consistent list toolbar.** Search on the left, the primary "+ New …" button on the
   right, and filters next to the search.
5. **Table footer pagination** with a rows-per-page control and an "x–y of N" count. Our
   lists are currently unpaginated, except History.
6. **Empty states that say what to do next.** We already do this; we should keep the same
   wording style everywhere.
7. **A notification bell** in the header, for overdue and newly assigned work orders
   (stage 3).
8. **Purchase requests in stage 3,** with the fields in §5 and an approval status.

**Avoid / do differently:**

- **Plan, trial and upgrade card, "Powered by", and the support-chat bubble.** These are
  SaaS clutter with no use for an in-house tool.
- **A deep Statistics tree in the sidebar.** Use one "Reports" entry instead, with tabs
  inside the page.
- **Very wide tables that scroll sideways on a large monitor.** Keep the default columns
  to what fits, and put the rest on the detail page.
- **Low-contrast muted titles.** Keep our darker titles for readability on shop-floor
  screens.

**Still to see:**

Screenshots of these would let us match the rest of the layout:

- the work order list and a work order's detail
- the preventive maintenance list and its create form
- an asset's detail tabs
- the request portal form
- a Statistics page
- Settings
