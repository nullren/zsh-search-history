# ZSH Search History

Helper script to dump shell commands into ElasticSearch. All commands will be backed up in S3 and searchable in ElasticSearch.

## Setup

First you will need an API key from me. After you have your key, store it in a config file located in your XDG config home, eg `~/.config/zsh-history`:

    {
        "apiKey": "YOUR_API_KEY",
        "apiGateway": "https://apigateway/path"
    }

Install from npm: `npm install zsh-search-history`.

Configure ZSH to send your commands to ES with something like this in your `.zshrc`:

    function zshaddhistory() {
        zsh-search-history-add <<< $1 >> ~/.zhistory-json-dump &!
    }
