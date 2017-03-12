'use strict';

const AWS = require('aws-sdk');
const path = require('path');
const s3 = new AWS.S3();

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

    const body = JSON.parse(event.body);
    body.apiKey = apiKey;

    const bodyStr = JSON.stringify(body);

    // send event.body to s3 for backup
    s3.putObject({
        Bucket: "zsh-history/" + apiKey,
        Key: requestId,
        Body: bodyStr
    }, (err, data) => {
        if (err) {
            console.log('Failed to put object in S3', err, err.stack); // an error occurred
            callback(err, 'Failed to put object in S3');
        }
        else {
            console.log('Put object in S3', data);           // successful response

            // now put in ES
            const req = new AWS.HttpRequest(endpoint);
            req.method = 'POST';
            req.path = path.join('/', esDomain.index, esDomain.doctype);
            req.region = esDomain.region;
            req.body = bodyStr;
            req.headers['presigned-expires'] = false;
            req.headers['Host'] = endpoint.host;

            // Sign the request (Sigv4)
            const signer = new AWS.Signers.V4(req, 'es');
            signer.addAuthorization(creds, new Date());

            // Post document to ES
            const send = new AWS.NodeHttpClient();
            send.handleRequest(req, null, function (httpResp) {
                var body = '';
                httpResp.on('data', function (chunk) {
                    body += chunk;
                });
                httpResp.on('end', function (chunk) {
                    console.log('Indexed object in ElasticSearch');
                    callback(null, {
                        statusCode: '200',
                        body: event.body,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                });
            }, function (err) {
                console.log('Failed to index object in ElasticSearch', err, err.stack); // an error occurred
                callback(err, 'Failed to index object in ElasticSearch');
            });
        }
    });

};