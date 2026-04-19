# Shewah B2B

## Overview
Shewah B2B is a comprehensive admin panel designed for the Shewah jewelry business. Built on Next.js 14 and Supabase, its primary purpose is to streamline and manage various aspects of the jewelry business, including product catalog management, order processing, CAD request handling, manufacturing tracking, and partner relations. The platform aims to enhance operational efficiency, improve communication with partners and manufacturers, and provide robust analytics for informed decision-making. Key capabilities include a public-facing design showcase for partners, a dedicated portal for manufacturers and retailers, and real-time gold rate tracking. The long-term vision is to establish a scalable and integrated digital ecosystem for Shewah's B2B operations, fostering better collaboration and accelerating business growth.

## User Preferences
The user prefers clear and concise communication. When making changes, please ask for confirmation before implementing major architectural shifts or schema modifications. Iterative development is preferred, with frequent updates on progress. For any database migrations, explicit instructions and confirmation prompts are essential, as these often require manual execution.

## System Architecture

### UI/UX Decisions
The application uses Tailwind CSS for styling, ensuring a consistent and modern look and feel. Analytics dashboards leverage Recharts for clear data visualization. Lucide React provides a comprehensive set of icons for intuitive navigation. The admin panel features a consistent `AppShell` with a sidebar navigation, bypassed for public-facing routes like the partner showcase.

### Technical Implementations
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: NextAuth.js with credentials provider and JWT sessions, supporting roles: master, sub, manufacturer, and retailer.
- **API Proxy**: All client-side Supabase interactions for authenticated users are routed through an `app/api/db` proxy, enforcing role-based access control (master/sub only) and using the Supabase service role key for enhanced security. Public routes use `supabaseAdmin` directly.
- **WhatsApp Notifications**: Integrated for retailer order updates and CAD revision acknowledgements, using a configurable webhook for outbound messages and an inbound endpoint for processing acknowledgements.
- **Material Ledger**: Tracks gold and other materials, distinguishing between available, reserved, and used quantities. Access is restricted to master users.
- **Order COGS and Gold Integrity**: Computes Cost of Goods Sold (COGS) and margin, with strict validation rules for order completion based on gold weight and consumption records.
- **File Uploads**: Uses `/api/upload` to handle image and raw file uploads, routing non-image files to Cloudinary's `raw/upload` endpoint.

### Feature Specifications
- **Admin Panel**: Centralized management for partners, orders, CAD requests, manufacturing, product catalog, gold rates, vendors, circuits, analytics, and app settings.
- **Partner Design Portal (Public)**: Allows partners to browse curated collections, shortlist products, and add notes without requiring a login. Tracks views and interests.
- **Manufacturer Portal**: Dedicated interface for manufacturers to view and update their assigned orders, manage progress photos, and update status.
- **Retailer Portal**: Provides retailers with access to the product catalog, custom design brief forms, and a view of their order history and status.
- **CAD Management**: Comprehensive tracking of CAD requests, revisions, and sharing with partners, including file uploads and a timeline of changes.
- **Karigar Handoff**: Secure sharing of manufacturing order specifications, reference images, and CAD/STL files with karigars (manufacturers) via time-limited WhatsApp links.
- **Daily Reconciliation Digest**: Automated reporting for manufacturing partners to identify material float discrepancies, with configurable thresholds and optional email notifications.

### System Design Choices
- **App Router**: Utilizes Next.js 14's App Router for modern routing and data fetching patterns.
- **Middleware**: `middleware.ts` handles authentication guards, redirecting unauthorized users and protecting admin routes.
- **Database Migrations**: SQL scripts are provided for schema changes, designed to be run manually for control and idempotency.
- **Environment Variables**: Key configurations are managed via environment variables for secure and flexible deployment.

## External Dependencies
- **Supabase**: Primary database backend (PostgreSQL) for all application data, including authentication and real-time capabilities.
- **NextAuth.js**: Authentication library integrated with Supabase for user management and session handling.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Recharts**: JavaScript charting library for data visualization in analytics.
- **Lucide React**: Icon library for UI elements.
- **Cloudinary**: Used for storing and serving uploaded files, particularly non-image assets like CAD files.
- **WhatsApp API (via Webhook)**: For sending outbound notifications to retailers and karigars, and receiving inbound acknowledgements for CAD revisions. The specific webhook provider is configurable.
- **Resend**: Optional email service for sending reconciliation digests if `RESEND_API_KEY` and associated settings are configured.
- **JSZip**: Used for dynamically generating ZIP archives of CAD/STL files for karigar downloads.