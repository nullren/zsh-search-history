'use strict';

console.log('Loading function');

const AWS = require('aws-sdk');
const apigateway = new AWS.APIGateway();
const dynamodb = new AWS.DynamoDB();
const ses = new AWS.SES({region: "us-west-2"});

function fail(message, err, awsCb) {
    console.error(message, err, err.stack);
    awsCb(err, message);
}

function successfulResponse(email, awsCb) {
    awsCb(null, {
        statusCode: '200',
        body: 'Check ' + email + ' for your API key'
    });
}

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    const payload = JSON.parse(event.body);
    createApiKey(payload.email, callback);
};

// the chain gang follows

function createApiKey(email, awsCb) {
    const params = { name: email, description: "User created in Sign-up API", enabled: true };
    apigateway.createApiKey(params, (err, data) => {
        if (err) fail('Failed to create API Key', err, awsCb);
        else {
            console.log("API Key created", data);
            const api_key_id = data.id;
            const api_key = data.value;
            const email = data.name;
            attachUsagePlan(api_key_id, api_key, email, awsCb);
        }
    });
}

function attachUsagePlan(api_key_id, api_key, email, awsCb) {
    const params = { keyId: api_key_id, keyType: "API_KEY", usagePlanId: "0nxuwr" };
    apigateway.createUsagePlanKey(params, (err, data) => {
        if (err) fail('Failed to add key to usage plan', err, awsCb);
        else {
            console.log("API Key added to usage plan", data);
            storeInDdb(email, api_key, awsCb);
        }
    });
}

function storeInDdb(email, api_key, awsCb) {
    const ddbRecord = {
        Item: { "email": { S: email }, "apiKey": { S: api_key } },
        TableName: "zsh-history-api-keys"
    };
    dynamodb.putItem(ddbRecord, (err, data) => {
        if (err) fail('Failed to add row to DynamoDB', err, awsCb);
        else {
            console.log('Added row to DynamoDB', data);
            sendEmail(email, api_key, awsCb);
        }
    });
}

function sendEmail(email, api_key, awsCb) {
    const emailParams = {
        Destination: { ToAddresses: [email] },
        Message: {
            Body: { Text: { Data: api_key } },
            Subject: { Data: "Your ZSH History API key" }
        },
        Source: "zsh-history@omgren.com"
    };
    ses.sendEmail(emailParams, (err, data) => {
        if (err) fail("Failed to send email", err, awsCb);
        else {
            console.log("Sent email", data);
            successfulResponse(email, awsCb);
        }
    });
}