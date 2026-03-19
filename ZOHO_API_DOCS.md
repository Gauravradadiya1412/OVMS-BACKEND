# Zoho People API Integration Documentation

This document outlines the specific Zoho People API endpoints utilized in the **Organization & Client Management System** and how their data is mapped to our internal PostgreSQL database.

---

## 1. Authentication (OAuth 2.0)
Before fetching data, we perform an OAuth 2.0 Refresh Token flow to obtain a short-lived `access_token`.

- **Endpoint:** `https://accounts.zoho.in/oauth/v2/token`
- **Method:** `POST`
- **Key Parameters:** `refresh_token`, `client_id`, `client_secret`, `grant_type=refresh_token`
- **Outcome:** Returns an `access_token` valid for 1 hour, used in the `Authorization: Zoho-oauthtoken <token>` header for all subsequent calls.

---

## 2. Employee Records API
Used to build the primary Organization Hierarchy and synchronize employee profiles.

- **Endpoint:** `https://people.zoho.in/people/api/forms/employee/getRecords`
- **Method:** `GET`
- **Data Structure Fetched:**
    - `Zoho_ID`: Unique identifier (String).
    - `FirstName` & `LastName`: Basic identification.
    - `EmailID`: Primary contact and unique key.
    - `Designation`: Official job title.
    - `Reporting_To.ID`: The Zoho ID of the manager (used to build the tree).
- **DB Mapping (`employees` table):**
    - Maps Zoho's nested hierarchy into a standard `manager_id` self-reference.
    - Performs a **Two-Pass Sync**: First creates all employees, then links them to their managers to avoid relational errors.

---

## 3. Clients API (TimeTracker)
Used to fetch the list of active clients managed within the organization.

- **Endpoint:** `https://people.zoho.in/people/api/timetracker/getclients`
- **Method:** `GET`
- **Data Structure Fetched:**
    - `clientId`: Unique client identifier.
    - `clientName`: The display name of the client.
    - `currency`: Billing currency (e.g., INR).
- **DB Mapping (`clients` table):**
    - Upserts clients into our local database using the `zoho_id` as a unique conflict key.

---

## 4. Projects API (TimeTracker)
Fetches specific projects under each client to provide deeper context for the Client Tree.

- **Endpoint:** `https://people.zoho.in/people/api/timetracker/getprojects`
- **Method:** `GET`
- **Data Structure Fetched:**
    - `projectId`: Unique project identifier.
    - `projectName`: Name of the project.
    - `clientId`: FK link to the parent client.
- **DB Mapping (`projects` table):**
    - Synchronizes Zoho projects and maintains their relationship to our local client records.

---

## 5. Add Client API (Management)
Allows the system to push new client data back to Zoho People.

- **Endpoint:** `https://people.zoho.in/people/api/timetracker/addclient`
- **Method:** `POST`
- **Required Parameters:** `clientName`, `currency`.
- **Purpose:** Used to ensure that if a manager creates a client in our system, it is officially registered in the Zoho ecosystem for time tracking and billing.

---

## Data Flow Summary
1. **Sync Engine:** Pulls from Zoho APIs ➔ PostgreSQL Cache.
2. **Management Layer:** Local PostgreSQL ➔ Hybrid Pivot UI (React).
3. **Write Path:** Manager Input ➔ Local DB (Allocations) / Zoho API (Clients).

*Note: By caching this data in PostgreSQL, we ensure the UI remains high-performance and stays functional even during Zoho API rate-limiting or downtime.*
