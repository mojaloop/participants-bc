# participants-bc
**EXPERIMENTAL** vNext Participant Lifecycle Management Bounded Context

# Install
1. Install `npm`
2. Install `nvm` via `https://github.com/nvm-sh/nvm`
3. Make use of correct NodeJS (see below `nve`):

## Make use of correct NodeJS:
```shell
nvm install
nvm use
```

# Build
Run: `npm install`
Then: `npm run build`

# Test

## Unit: 
```shell
npm run test:unit  
```

## Integration:

1. Startup supporting services via (See `README.md`);
```shell
cd docker-compose
docker-compose up -d
docker-compose logs -f # tail the logs
```
2. Clone `https://github.com/mojaloop/security-bc`
3. Setup and start `security-bc`
4. Execute the `requests/Mojaloop-vNext.postman_collection.json` Postman collection to create all necessary security configuration
5. Update authentication file on the `security-bc` to associate your user with the `participant-bc` role
6. Start the `participants-bc` service:
```shell
npm run start
```
7. Run the integration tests:
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

