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

async function test() {
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

    const logParams = {
        user: 'all',
        fromDate: '2026-03-01',
        toDate: '2026-03-05'
    };

    console.log('Fetching logs...');
    const logRes = await axios.get(`${ZOHO_API_DOMAIN}/timetracker/gettimelogs`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: logParams
    });

    console.log('Response Status:', logRes.status);
    console.log('Full Response Body:', JSON.stringify(logRes.data, null, 2));
}

test().catch(console.error);
