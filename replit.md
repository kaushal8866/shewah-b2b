# Shewah B2B

## Overview

Shewah B2B is a Next.js 14 admin panel designed for the Shewah jewelry business. It serves as a comprehensive B2B platform for managing various aspects of the jewelry business, from product catalog and order management to manufacturing tracking and partner relations. The platform aims to streamline operations, enhance collaboration with partners and manufacturers, and provide insightful analytics. Key capabilities include a public-facing design showcase, a material ledger, and robust notification systems.

## User Preferences

I prefer to communicate in a direct and clear manner. When making changes or implementing new features, please explain the impact on existing functionalities and the rationale behind your approach. For critical updates or architectural decisions, I expect to be consulted before implementation. I appreciate an iterative development process with regular updates on progress. My preferred coding style emphasizes readability and maintainability.

## System Architecture

The application is built on Next.js 14 (App Router) and uses Supabase as its PostgreSQL database backend. Authentication is handled by NextAuth.js, supporting various user roles including master, sub, manufacturer, and retailer. Styling is implemented with Tailwind CSS, while Recharts is used for data visualization, and Lucide React for icons.

The system incorporates distinct portals for different user types:
- **Admin Panel**: Comprehensive management for master and sub users across various modules like analytics, CAD requests, catalog, orders, manufacturing, and vendor management.
- **Partner Design Portal**: A public-facing showcase for partners to browse collections, shortlist products, and express interest without requiring authentication.
- **Manufacturer Portal**: Provides manufacturers with a dedicated interface to manage orders, update status, add notes, and upload progress photos. Access to administrative functionalities is restricted.
- **Retailer Portal**: Offers retailers a view of the product catalog, custom design brief submission, and tracking of their own orders.

Key architectural features include:
- **Database Proxy**: All client-side Supabase interactions for authenticated users are routed through an `/api/db` proxy, leveraging the service role for enhanced security and RLS bypass for specific operations.
- **WhatsApp Integration**: Automated notifications for retailers on order status updates and for internal teams on CAD revision acknowledgements, utilizing configurable webhooks.
- **Material Ledger**: Tracks gold inventory and transactions with access control, ensuring gold integrity and consumption against orders.
- **CAD Management**: Comprehensive CAD request lifecycle, including partner sharing, revision tracking, and file uploads.
- **Cron Jobs**: Supports scheduled tasks like daily reconciliation digests for manufacturing partners, with email notification capabilities via Resend.
- **File Uploads**: Utilizes Cloudinary for storing various file types, including CAD files and reference images.

## Operations

- **Upload error retention**: The `upload_errors` table is trimmed by the `app/api/cron/cleanup-upload-errors` route, which deletes rows older than 90 days. Trigger it on a schedule (e.g. daily) with a `Bearer ${CRON_SECRET}` `Authorization` header, or manually as a master user. The Settings page only surfaces the most recent 100 rows, so older entries are not needed for live diagnosis.
- **Decimal precision for gold/diamond weights**: All weight columns (`products.gold_weight_g`, `orders.gold_weight_estimated/actual`, `manufacturing_orders.gold_weight_required/actual`, `material_transactions.quantity`, `material_float.current_quantity/reserved_quantity`, and matching `diamond_weight` columns) must be `numeric` so jewellers can record up to 4+ decimal places at every stage. If the live DB drifted and any of these are `integer`, run `scripts/migrate_task67_decimal_gold_weights.sql` in the Supabase SQL Editor — it inspects each column and only ALTERs the ones that aren't already `numeric`, so it is idempotent and safe to re-run. All gold-weight inputs in the admin UI use `step="0.0001"`.

## External Dependencies

- **Supabase**: PostgreSQL database, authentication, and real-time features.
- **NextAuth.js**: Authentication library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Recharts**: Composable charting library.
- **Lucide React**: Icon library.
- **Cloudinary**: Cloud-based image and video management (for file uploads, including CAD files).
- **Resend**: Email API for transactional emails (e.g., reconciliation digests).
- **WhatsApp Webhooks**: For sending and potentially receiving messages for notifications and acknowledgements.