# participants-bc
**EXPERIMENTAL** vNext Participant Lifecycle Management Bounded Context

# Install
1. Install `npm`
2. Install `nvm` via `https://github.com/nvm-sh/nvm`
    Insted use following command to install nvm
```shell
sudo apt install curl 
curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash 
source ~/.bashrc
```
3. Make use of correct NodeJS (see below `nve`):

## Make use of correct NodeJS:
```shell
nvm install
nvm use
```

# Build

```shell
npm install
npm run build
```

# Test

## Unit: 
```shell
npm run test:unit  
```

## Integration

### Startup supporting services

Use https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-infra

Follow instructions in the docker-compose-infra `README.md` to run the supporting services.  

Use https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-cross-cutting

Follow instructions in the docker-compose-cross-cutting `README.md` to run the supporting services.


After running the docker-compose-infra we can start participants-bc
```shell
npm run start:participants-svc
```

To run participats-bc locally, you need to pass 2 env vars like this in root directory

```shell
export AUDIT_KEY_FILE_PATH=$(pwd)/packages/participants-svc/dist/tmp_key_file
export MONGO_URL=mongodb://root:mongoDbPas42@127.0.0.1:27017
```


## Run the integration test:

```shell
npm run test:integration
```

## Troubleshoot

### Unable to load `dlfcn_load`:
```
 fatal: Error: error:25066067:DSO support routines:dlfcn_load:could not load the shared library
```
Fix: https://github.com/auth0/node-jsonwebtoken/issues/826
`export OPENSSL_CONF=/dev/null`

