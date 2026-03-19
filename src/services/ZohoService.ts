import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_API_DOMAIN,
  ZOHO_ACCOUNTS_DOMAIN,
} = process.env;

export class ZohoService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log(`Refreshing Token in Service at ${ZOHO_ACCOUNTS_DOMAIN}...`);
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

  async fetchEmployees(): Promise<any[]> {
    const token = await this.getAccessToken();
    const response = await axios.get(`${ZOHO_API_DOMAIN}/forms/employee/getRecords`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    
   
    return response.data.response.result.map((item: any) => {
      const id = Object.keys(item)[0];
      const data = item[id][0];
      return { ...data, recordId: id };
    });
  }

  async fetchClients(): Promise<any[]> {
    const token = await this.getAccessToken();
    const response = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/getclients`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    return response.data.response.result || [];
  }

  async fetchProjects(): Promise<any[]> {
    const token = await this.getAccessToken();
    const response = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/getprojects`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    return response.data.response.result || [];
  }

  async fetchTimeLogs(): Promise<any[]> {
    const token = await this.getAccessToken();
    const response = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/gettimelogs`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { user: 'all', fromDate: '2026-03-01', toDate: '2026-03-05' }
    });
    return response.data.response.result || [];
  }

  async buildOrgTree(): Promise<any> {
    const employees = await this.fetchEmployees();
    const map = new Map<string, any>();
    employees.forEach(emp => {
      map.set(String(emp.recordId), {
        name: `${emp.FirstName} ${emp.LastName}`,
        attributes: { designation: emp.Designation || '' },
        children: []
      });
    });
    const roots: any[] = [];
    employees.forEach(emp => {
      const node = map.get(String(emp.recordId));
      const mId = emp['Reporting_To.ID'] ? String(emp['Reporting_To.ID']) : null;
      if (mId && map.has(mId)) {
        map.get(mId).children.push(node);
      } else {
        // Avoid duplicates in roots if any
        if (!roots.includes(node)) {
          roots.push(node);
        }
      }
    });
    return roots;
  }

  async buildClientTree(): Promise<any> {
    const clients = await this.fetchClients();
    const projects = await this.fetchProjects();
    return Promise.all(clients.map(async c => {
      const ps = projects.filter(p => String(p.clientId) === String(c.clientId));
      return {
        name: c.clientName,
        children: ps.map(p => ({ name: p.projectName, children: [] }))
      };
    }));
  }

  async buildEffortMatrix(): Promise<any> {
    console.log('[DEBUG] Starting buildEffortMatrix...');
    const logs = await this.fetchTimeLogs();
    console.log(`[DEBUG] Fetched ${logs.length} logs`);
    const clients = await this.fetchClients();
    console.log(`[DEBUG] Fetched ${clients.length} clients`);
    const projects = await this.fetchProjects();
    console.log(`[DEBUG] Fetched ${projects.length} projects`);

    const clientMap = new Map<string, string>();
    clients.forEach(c => clientMap.set(String(c.clientId), c.clientName));
    projects.forEach(p => {
      if (p.clientId && p.clientName) {
        clientMap.set(String(p.clientId), p.clientName);
      }
    });

    const matrix: any = {};
    logs.forEach(log => {
      const name = `${log.employeeFirstName || ''} ${log.employeeLastName || ''}`.trim() || 'Unknown';
      let cName = log.clientName;
      if (!cName && log.clientId) {
        cName = clientMap.get(String(log.clientId));
      }
      cName = cName || 'Unassigned';
      
      const pName = log.projectName || 'General';
      const h = (Number(log.hoursInMins) || 0) / 60;
      
      if (!matrix[name]) {
        matrix[name] = { name, totalHours: 0, clients: {} };
      }
      matrix[name].totalHours += h;
      
      if (!matrix[name].clients[cName]) {
        matrix[name].clients[cName] = { name: cName, hours: 0, projects: {} };
      }
      matrix[name].clients[cName].hours += h;
      
      if (!matrix[name].clients[cName].projects[pName]) {
        matrix[name].clients[cName].projects[pName] = 0;
      }
      matrix[name].clients[cName].projects[pName] += h;
    });

    return Object.values(matrix).map((emp: any) => ({
      ...emp,
      clients: Object.values(emp.clients).map((c: any) => ({
        ...c,
        projects: Object.entries(c.projects).map(([name, hours]) => ({ name, hours: hours as number }))
      }))
    }));
  }
}
