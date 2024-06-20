# participants-bc
**EXPERIMENTAL** vNext Participant Lifecycle Management Bounded Context


The Participant Lifecycle Bounded Context’s primary concern regards anything to do with the management of a Participant within the Mojaloop Environment.  

See the Reference Architecture documentation [Participant Life Cycle Management section](https://mojaloop.github.io/reference-architecture-doc/boundedContexts/participantLifecycleManagement/) for context on this vNext implementation guidelines.  

## Contents
- [participants-bc](#participants-bc)
  - [Contents](#contents)
  - [Packages](#packages)
  - [Running Locally](#running-locally)
  - [Configuration](#configuration)
  - [API](#api)
  - [Logging](#logging)
  - [Tests](#tests)
  - [Auditing Dependencies](#auditing-dependencies)
  - [CI/CD](#cicd-pipelines)
  - [Documentation](#documentation)

## Packages
The participants BC consists of the following packages;

`client-lib`
Client library types.
[README](./packages/client-lib/README.md)
 
`participants-svc`
Participants Service.
[README](packages/participants-svc/README.md) 

`public-types-lib`
Public shared types.
[README](./packages/public-types-lib/README.md)


## Running Locally

Please follow the instruction in [Onboarding Document](Onboarding.md) to setup and run the service locally.

## Configuration

See the README.md file on each services for more Environment Variable Configuration options.

## API

For endpoint documentation, see the [API documentation](https://docs.mojaloop.io/api/fspiop/v1.1/api-definition.html#api-resource-participants).

## Logging

Logs are sent to standard output by default.

## Tests

### Unit Tests

```bash
npm run test:unit
```

### Run Integration Tests

```shell
npm run test:integration
```

### Run all tests at once
Requires integration tests pre-requisites
```shell
npm run test
```

# Collect coverage (from both unit and integration test types)

After running the unit and/or integration tests: 

```shell
npm run posttest
```

You can then consult the html report in:

```shell
coverage/lcov-report/index.html
```

## Auditing Dependencies
We use npm audit to check dependencies for node vulnerabilities. 

To start a new resolution process, run:
```
npm run audit:fix
``` 

You can check to see if the CI will pass based on the current dependencies with:

```
npm run audit:check
```

## CI/CD Pipelines

### Execute locally the pre-commit checks - these will be executed with every commit and in the default CI/CD pipeline 

Make sure these pass before committing any code
```
npm run pre_commit_check
```

### Work Flow 

 As part of our CI/CD process, we use CircleCI. The CircleCI workflow automates the process of publishing changed packages to the npm registry and building Docker images for select packages before publishing them to DockerHub. It also handles versioning, tagging commits, and pushing changes back to the repository.

The process includes five phases. 
1. Setup : This phase initializes the environment, loads common functions, and retrieves commits and git change history since the last successful CI build.

2. Detecting Changed Package.

3. Publishing Changed Packages to NPM.

4. Building Docker Images and Publishing to DockerHub.

5. Pushing Commits to Git.

 All code is automatically linted, built, and unit tested by CircleCI pipelines, where unit test results are kept for all runs. All libraries are automatically published to npm.js, and all Docker images are published to Docker Hub.

 ## Documentation
The following documentation provides insight into the participants Bounded Context.

- **Reference Architecture** - https://mojaloop.github.io/reference-architecture-doc/boundedContexts/participantLifecycleManagement/
- **MIRO Board** - https://miro.com/app/board/o9J_lJyA1TA=/
- **Work Sessions** - https://docs.google.com/document/d/1Nm6B_tSR1mOM0LEzxZ9uQnGwXkruBeYB2slgYK1Kflo/edit#heading=h.6w64vxvw6er4

