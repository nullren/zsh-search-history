'use strict';

const AWS = require('aws-sdk');
const path = require('path');

const esDomain = {
    endpoint: process.env.ES_ENDPOINT,
    region: 'us-west-1',
    index: 'history',
    doctype: 'command'
};
const endpoint =  new AWS.Endpoint(esDomain.endpoint);

/*
 * The AWS credentials are picked up from the environment.
 * They belong to the IAM role assigned to the Lambda function.
 * Since the ES requests are signed using these credentials,
 * make sure to apply a policy that permits ES domain operations
 * to the role.
 */
const creds = new AWS.EnvironmentCredentials('AWS');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const apiKey = event.requestContext.identity.apiKey;
    const requestId = event.requestContext.requestId;

    // const body = JSON.parse(event.body);
    // body.apiKey = apiKey;

    const query = {
        query: {
            bool: {
                // let them do a fancy query if they want
                must: { query_string: { query: event.queryStringParameters.q } },
                // filter only this years documents
                filter: { term: { 'apiKey.keyword': apiKey } }
            }
        }
    };

    const req = new AWS.HttpRequest(endpoint);
    req.method = 'POST';
    req.path = path.join('/', esDomain.index, esDomain.doctype, "_search");
    req.region = esDomain.region;
    req.body = JSON.stringify(query);
    req.headers['presigned-expires'] = false;
    req.headers['Host'] = endpoint.host;

    // Sign the request (Sigv4)
    const signer = new AWS.Signers.V4(req, 'es');
    signer.addAuthorization(creds, new Date());

    // Post query to ES
    const send = new AWS.NodeHttpClient();
    send.handleRequest(req, null, function (httpResp) {
        var body = '';
        httpResp.on('data', function (chunk) {
            body += chunk;
        });
        httpResp.on('end', function (chunk) {
            console.log('Search result from ElasticSearch');
            callback(null, {
                statusCode: '200',
                body: body,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        });
    }, function (err) {
        console.log('Failed to query ElasticSearch', err, err.stack); // an error occurred
        callback(err, 'Failed to query ElasticSearch');
    });
}