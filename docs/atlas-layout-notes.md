# Atlas CMMS — layout notes

Reference notes on the hosted Atlas CMMS app (app.atlas-cmms.com, Business-plan trial),
taken from screenshots, to guide the PM System's layout. Ideas only: Atlas is AGPL, so
we copy no code or assets.

Screens reviewed so far:

| Date | Screen | URL |
|------|--------|-----|
| 2026-10-01 | Purchase Requests (empty list) | `/app/purchase-orders` |

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

## Takeaways for the PM System

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
