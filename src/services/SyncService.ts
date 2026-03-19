import axios from 'axios';
import { pool } from '../database';

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_API_DOMAIN,
  ZOHO_ACCOUNTS_DOMAIN,
} = process.env;

export class SyncService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) return this.accessToken;

    const params = new URLSearchParams();
    params.append('refresh_token', ZOHO_REFRESH_TOKEN!);
    params.append('client_id', ZOHO_CLIENT_ID!);
    params.append('client_secret', ZOHO_CLIENT_SECRET!);
    params.append('grant_type', 'refresh_token');

    const response = await axios.post(ZOHO_ACCOUNTS_DOMAIN!, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = now + (response.data.expires_in * 1000) - 60000;
    return this.accessToken!;
  }

  async syncAll() {
    console.log('[SYNC] Starting full sync from Zoho...');
    const token = await this.getAccessToken();

    try {
      // 1. Sync Clients
      console.log('[SYNC] Fetching Clients...');
      const clientRes = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/getclients`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      const zohoClients = clientRes.data.response.result || [];
      for (const zc of zohoClients) {
        await pool.query(
          `INSERT INTO clients (zoho_id, name) VALUES ($1, $2)
           ON CONFLICT (zoho_id) DO UPDATE SET name = EXCLUDED.name`,
          [String(zc.clientId), zc.clientName]
        );
      }

      // 2. Sync Employees
      console.log('[SYNC] Fetching Employees...');
      const empRes = await axios.get(`${ZOHO_API_DOMAIN}/forms/employee/getRecords`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      const zohoEmps = empRes.data.response.result || [];
      
      // First Pass: Insert/Update Employees (without manager_id to avoid FK issues)
      for (const item of zohoEmps) {
        const id = Object.keys(item)[0];
        const e = item[id][0];
        await pool.query(
          `INSERT INTO employees (zoho_id, first_name, last_name, email, designation)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (zoho_id) DO UPDATE SET 
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             email = EXCLUDED.email,
             designation = EXCLUDED.designation,
             is_active = true`,
          [id, e.FirstName, e.LastName || '', e.EmailID, e.Designation || '']
        );
      }

      // Second Pass: Update Hierarchies (manager_id)
      for (const item of zohoEmps) {
        const id = Object.keys(item)[0];
        const e = item[id][0];
        const managerZohoId = e['Reporting_To.ID'];
        
        if (managerZohoId) {
          await pool.query(
            `UPDATE employees SET manager_id = (SELECT id FROM employees WHERE zoho_id = $1)
             WHERE zoho_id = $2`,
            [String(managerZohoId), id]
          );
        }
      }

      console.log('[SYNC] Sync completed successfully.');
    } catch (error) {
      console.error('[SYNC] Sync failed:', error);
      throw error;
    }
  }
}
