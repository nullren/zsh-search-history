#!/usr/bin/env node
'use strict';

const moment = require('moment');
const os = require('os');
const fs = require('fs');
const request = require('request');
const xdg = require('xdg-basedir');

// not async.
const zshConfig = JSON.parse(fs.readFileSync(xdg.config + "/zsh-history", "utf8"));

const payload = JSON.parse(JSON.stringify(process.env));
payload.date = moment().format();
payload.host = os.hostname();
// not async. there is an extra "\n\n" at the end we can remove.
payload.command = fs.readFileSync('/dev/stdin', 'utf8').trim();

const options = {
    url: zshConfig.apiGateway,
    method: 'POST',
    headers: { 'x-api-key': zshConfig.apiKey },
    body: JSON.stringify(payload)
};

request(options, (error, response, body) => {
    if (error || response.statusCode != 200)
        console.error('Failed to upload ZSH history',
            response.statusCode, response.statusMessage, error);
    else console.log(body);
});