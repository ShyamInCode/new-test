require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const XMLParser = require('fast-xml-parser').XMLParser;


const app = express();
const port = process.env.PORT || 3000;

let globalAccessToken = null;
let globalStatusCounts = {};
let globalExtractedData = [];

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

async function getSalesforceData(token) {
  const headers = {
    "Content-Type": "text/xml;charset=UTF-8",
    "SOAPAction": "Retrieve",
    "Authorization": `Bearer ${token}`
  };
  const url = "https://mclxdpbrg2n9j1y8ftm46zszshqy.soap.marketingcloudapis.com/Service.asmx";
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <s:Header>
        <a:Action s:mustUnderstand="1">Retrieve</a:Action>
        <a:To s:mustUnderstand="1">${url}</a:To>
        <fueloauth xmlns="http://exacttarget.com">${token}</fueloauth>
      </s:Header>
      <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
          <RetrieveRequest>
            <ObjectType>Automation</ObjectType>
            <Properties>Name</Properties>
            <Properties>Description</Properties>
            <Properties>CustomerKey</Properties>
            <Properties>IsActive</Properties>
            <Properties>CreatedDate</Properties>
            <Properties>ModifiedDate</Properties>
            <Properties>Status</Properties>
            <Properties>ProgramID</Properties>
            <Properties>CategoryID</Properties>
            <Properties>LastRunTime</Properties>
            <Properties>ScheduledTime</Properties>
            <Properties>LastSaveDate</Properties>
            <Properties>ModifiedBy</Properties>
            <Properties>CreatedBy</Properties>
            <Properties>AutomationType</Properties>
            <Properties>RecurrenceID</Properties>
            <Filter xsi:type="SimpleFilterPart">
              <Property>IsActive</Property>
              <SimpleOperator>equals</SimpleOperator>
              <Value>true</Value>
            </Filter>
          </RetrieveRequest>
        </RetrieveRequestMsg>
      </s:Body>
    </s:Envelope>`;

  try {
    const response = await axios.post(url, soapBody, { headers });
    return response.data;
  } catch (error) {
    console.error("Error fetching data from Salesforce:", error.response ? error.response.data : error.message);
    throw error;
  }
}


function extractRelevantData(xmlData) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });
  const jsonData = parser.parse(xmlData);

  // Navigate to the Results array
  const results = jsonData['soap:Envelope']['soap:Body']
    .RetrieveResponseMsg.Results;

  const statusMap = {
    '-1': 'Error',
    '0': 'Building Error',
    '1': 'Building',
    '2': 'Ready',
    '3': 'Running',
    '4': 'Paused',
    '5': 'Stopped',
    '6': 'Scheduled',
    '7': 'Awaiting Trigger',
    '8': 'Inactive Trigger'
  };

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return dateString.replace('T', ', ').split('.')[0];
  }

  return results.map(result => ({
    BusinessUnit: 'Corporate',
    Name: result.Name || 'N/A',
    Description: result.Description || 'N/A',
    CustomerKey: result.CustomerKey || 'N/A',
    IsActive: result.IsActive,
    CreatedDate: formatDate(result.CreatedDate),
    ModifiedDate: formatDate(result.ModifiedDate),
    Status: statusMap[result.Status] || 'Unknown',
    ProgramID: result.ProgramID || 'N/A',
    CategoryID: result.CategoryID || 'N/A',
    LastRunTime: formatDate(result.LastRunTime),
    ScheduledTime: formatDate(result.ScheduledTime),
    LastSaveDate: formatDate(result.LastSaveDate),
    ModifiedBy: result.ModifiedBy || 'N/A',
    CreatedBy: result.CreatedBy || 'N/A',
    AutomationType: result.AutomationType || 'N/A',
    RecurrenceID: result.RecurrenceID || 'N/A'
  }));
}

function countStatuses(data) {
  const statusCounts = {
      'Error': 0,
      'Building Error': 0,
      'Building': 0,
      'Ready': 0,
      'Running': 0,
      'Paused': 0,
      'Stopped': 0,
      'Scheduled': 0,
      'Awaiting Trigger': 0,
      'Inactive Trigger': 0
  };

  data.forEach(item => {
      if (statusCounts.hasOwnProperty(item.Status)) {
          statusCounts[item.Status]++;
      }
  });

  return statusCounts;
}

app.get('/login', (req, res) => {
  const authUrl = `${process.env.AUTH_URL}?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
  console.log('Authorization URL:', authUrl);
  res.redirect(authUrl);
});

app.get('/oauth2/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post(process.env.TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI
    });
    
    globalAccessToken = response.data.access_token;

    let accessToken = globalAccessToken;

    if (!accessToken) {
      return res.status(401).send('Unauthorized: No access token found');
    }
  
    try {
      const salesforceData = await getSalesforceData(accessToken);
      globalExtractedData = await extractRelevantData(salesforceData);

      globalStatusCounts = countStatuses(globalExtractedData);
      // Render the dashboard EJS file with the extracted data
      res.render('data', { 
        data: globalExtractedData, 
        businessUnit: 'All', 
        status: 'All', 
        searchName: '',
        statusCounts: globalStatusCounts
      });
    } catch (error) {
      console.error('Error fetching data for dashboard:', error);
      res.status(500).send('Error fetching data for dashboard');
    }
  } catch (error) {
    console.error('Error getting token:', error.response ? error.response.data : error.message);
    res.status(500).send('Authentication failed');
  }
});

app.post('/filter', async (req, res) => {
  try {
    const { businessUnit, status, searchName } = req.body;
    let filteredData = globalExtractedData;

    if (status !== 'All') {
      filteredData = filteredData.filter(item => item.Status === status);
    }

    if (searchName) {
      filteredData = filteredData.filter(item => 
        item.Name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    res.render('data', { 
      data: filteredData, 
      businessUnit: businessUnit, 
      status: status,
      searchName: searchName,
      statusCounts: globalStatusCounts  // Use the global status counts
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred');
  }
});

app.get('/logout', (req, res) => {
  // Clear any stored tokens or sessions here
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
