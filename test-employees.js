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

async function testEmployees() {
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

    console.log('Fetching employees...');
    const empRes = await axios.get(`${ZOHO_API_DOMAIN}/forms/employee/getRecords`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });

    console.log('Response Status:', empRes.status);
    console.log('Full Response Body:', JSON.stringify(empRes.data, null, 2));
}

testEmployees().catch(console.error);
