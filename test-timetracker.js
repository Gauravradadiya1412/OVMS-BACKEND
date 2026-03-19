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

async function testTimetracker() {
    console.log('Refreshing Token...');
    const authParams = new URLSearchParams();
    authParams.append('refresh_token', ZOHO_REFRESH_TOKEN);
    authParams.append('client_id', ZOHO_CLIENT_ID);
    authParams.append('client_secret', ZOHO_CLIENT_SECRET);
    authParams.append('grant_type', 'refresh_token');

    const authRes = await axios.post(ZOHO_ACCOUNTS_DOMAIN, authParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const token = authRes.data.access_token;
    console.log('Token:', token);

    console.log('Fetching clients...');
    const clientRes = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/getclients`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    console.log('Clients Response:', JSON.stringify(clientRes.data, null, 2));

    console.log('Fetching projects...');
    const projectRes = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/getprojects`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    console.log('Projects Response:', JSON.stringify(projectRes.data, null, 2));
    
    console.log('Fetching logs...');
    const logRes = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/gettimelogs`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: { user: 'all', fromDate: '2026-03-01', toDate: '2026-03-05' }
    });
    console.log('Logs Response Status:', logRes.status);
    console.log('Logs Response:', JSON.stringify(logRes.data, null, 2));
}

testTimetracker().catch(console.error);
