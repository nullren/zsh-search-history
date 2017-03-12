// zsh-signup.js
'use strict';

console.log('Loading function');

const AWS = require('aws-sdk');

const apigateway = new AWS.APIGateway();
const dynamodb = new AWS.DynamoDB();
const ses = new AWS.SES({region: "us-west-2"});

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const payload = JSON.parse(event.body);
    const params = { name: payload.email, description: "User created in Sign-up API", enabled: true }

    apigateway.createApiKey(params, (err, data) => {
        if (err) {
            console.log("Failed to create API Key", err, err.stack); // an error occurred
            callback(err, 'Failed to create API Key');
        }
        else {
            console.log("API Key created", data);           // successful response
            const api_key = data.value;
            const email = data.name;
            // associate key to usage plan
            apigateway.createUsagePlanKey({ keyId: data.id, keyType: "API_KEY", usagePlanId: "0nxuwr" }, (err, data) => {
                if (err) {
                    console.log("Failed to add key to usage plan", err, err.stack); // an error occurred
                    callback(err, 'Failed to add key to usage plan');
                }
                else {
                    console.log("API Key added to usage plan", data);           // successful response
                    // dynamodb row
                    const ddbRecord = { Item: { "email": { S: email }, "apiKey": { S: api_key } }, TableName: "zsh-history-api-keys" };
                    dynamodb.putItem(ddbRecord, (err, data) => {
                        if (err) {
                            console.log('Failed to add row to DynamoDB', err, err.stack); // an error occurred
                            callback(err, 'Failed to add row to DynamoDB');
                        }
                        else {
                            console.log('Added row to DynamoDB', data);           // successful response
                            const emailParams = {
                                Destination: { ToAddresses: [email] },
                                Message: {
                                    Body: { Text: { Data: api_key } },
                                    Subject: { Data: "Your ZSH History API key" }
                                },
                                Source: "zsh-history@omgren.com"
                            };
                            ses.sendEmail(emailParams, (err, data) => {
                                if (err) {
                                    console.log("Failed to send email", err, err.stack); // an error occurred
                                    callback(err, 'Failed to send email');
                                }
                                else {
                                    console.log("Sent email", data);           // successful response
                                    callback(null, {
                                        statusCode: '200',
                                        body: 'Check ' + email + ' for your API key'
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};
