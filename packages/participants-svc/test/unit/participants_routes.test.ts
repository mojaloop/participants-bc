/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
**/

"use strict";


import express, {Express} from "express";
import { ExpressRoutes } from "../../src/application/routes";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantAggregate } from "../../src/domain/participant_agg";
import request from "supertest";
import {
    MemoryConfigClientMock,
    ParticipantsRepoMock,
    AccountsBalancesAdapterMock,
    AuditClientMock,
    AuthorizationClientMock,
    MemoryMessageProducer,
    TokenHelperMock,
    mockedParticipantHub,
    mockedParticipant1,
    mockedParticipant2,
    mockedInactiveParticipant,
} from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { HUB_PARTICIPANT_ID, IParticipant, IParticipantAccountChangeRequest, IParticipantContactInfo, IParticipantContactInfoChangeRequest, IParticipantEndpoint, IParticipantStatusChangeRequest, ParticipantAccountTypes, ParticipantEndpointProtocols, ParticipantEndpointTypes } from "@mojaloop/participant-bc-public-types-lib";
import { Server } from "http";
const packageJSON = require("../../package.json");


const APP_VERSION = packageJSON.version;
const SVC_DEFAULT_HTTP_PORT = 3010;
const AUTH_TOKEN = "bearer: MOCKTOKEN";

const authTokenUrl = "mocked_auth_url";
const hasPrivilege = true;

const server = process.env["PARTICIPANTS_SVC_URL"] || `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

// Create necessary mocks
const logger: ILogger = new ConsoleLogger();
const configClientMock = new MemoryConfigClientMock(logger, authTokenUrl);
const repoPartMock = new ParticipantsRepoMock();
const accAndBalAdapterMock = new AccountsBalancesAdapterMock();
const auditClientMock = new AuditClientMock(logger);
const authZClientMock = new AuthorizationClientMock(logger, hasPrivilege);
const msgProducerMock = new MemoryMessageProducer(logger);
const metricsMock = new MetricsMock();
const tokenHelperMock = new TokenHelperMock(logger);


describe("Participants Service - Unit Test", () => {
    let app: Express;
    let expressServer: Server;
    let participantAgg;

    beforeAll(async () => {
        app = express();
        app.use(express.json()); // for parsing application/json
        app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

        participantAgg = new ParticipantAggregate(
            configClientMock,
            repoPartMock,
            accAndBalAdapterMock,
            auditClientMock,
            authZClientMock,
            msgProducerMock,
            metricsMock,
            logger,
        );

        await participantAgg.init();

        const expressRoutes = new ExpressRoutes(participantAgg, tokenHelperMock, logger);
        app.use("/", expressRoutes.MainRouter);

        let portNum = SVC_DEFAULT_HTTP_PORT;
        if (process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
            portNum = parseInt(process.env["SVC_HTTP_PORT"]);
        }

        return new Promise<void>(resolve => {
            expressServer = app.listen(portNum, () => {
                logger.info(`🚀 Server ready at port: ${portNum}`);
                logger.info(`Participants service v: ${APP_VERSION} started`);
                resolve();
            });
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        jest.clearAllMocks();

        return new Promise<void>(resolve => {
            expressServer.close(() => {
                resolve();
            });
        });
    });

    
    test("Return error when invalid access token", async () => {
        // Arrange
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce(null);

        // Act 
        const response = await request(server)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(401);
    });

    test("Return error when no necessary privilege", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "roleHasPrivilege").mockReturnValue(false);

        // Act
        const response = await request(server)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    test("GET /participants - Should return an array of participants", async () => {
        // Act
        const response = await request(server)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(response.body.items.length).toBe(1);
    });

    test("GET /participants - Should throw an error if cannot fetch participants", async () => {
        // Arrange
        jest.spyOn(repoPartMock, "searchParticipants").mockRejectedValueOnce(new Error("Error fetching participants"));

        // Act
        const response = await request(server)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    test("GET /participants/:ids/multi - Should fetch an array of participants by their ids", async () => {
        // Arrange
        const participantIds = `${mockedParticipantHub.id},${mockedParticipant1}`;

        // Act
        const response = await request(server)
            .get(`/participants/${participantIds}/multi`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
    });

    test("GET /participants/:ids/multi - Should throw an error if cannot fetch participants by their ids", async () => {
        // Arrange
        const participantIds = `${mockedParticipantHub.id},${mockedParticipant1}`;
        jest.spyOn(repoPartMock, "fetchWhereIds").mockRejectedValueOnce(new Error("Error fetching participants with ids"));

        // Act
        const response = await request(server)
            .get(`/participants/${participantIds}/multi`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    test("GET /participants/:id - Should fetch a participants by id", async () => {
        // Arrange
        const participantId = mockedParticipantHub.id;

        // Act
        const response = await request(server)
            .get(`/participants/${participantId}`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.id).toEqual(participantId);
    });

    test("GET /participants/:id - Should throw an error if cannot fetch participant by id", async () => {
        // Arrange
        const participantId = mockedParticipantHub.id;
        jest.spyOn(repoPartMock, "fetchWhereId").mockRejectedValueOnce(new Error("Error fetching participant with id"));

        // Act
        const response = await request(server)
            .get(`/participants/${participantId}`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    test("POST /participants - Should be able to create a participant", async () => {
        // Arrange
        const participant1 = mockedParticipant1;

        // Act
        const response = await request(server)
            .post(`/participants`)
            .send(participant1)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    test("POST /participants - Should return error if name is empty", async () => {
        // Arrange
        const participant1 = { ...mockedParticipant1 };
        participant1.name = "";

        // Act
        const response = await request(server)
            .post(`/participants`)
            .send(participant1)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    test("POST /participants - Should return error if type is HUB", async () => {
        // Arrange
        const participantHub = { ...mockedParticipantHub };

        // Act
        const response = await request(server)
            .post(`/participants`)
            .send(participantHub)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    test("POST /participants - Should return error if try to create with duplicate name", async () => {
        // Arrange
        const participant1 = mockedParticipant1;

        // Act
        const response = await request(server)
            .post(`/participants`)
            .send(participant1)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    test("POST /participants - Should return error if id is the same as Hub's id", async () => {
        // Arrange
        const participant2 = { ...mockedParticipant2 };
        participant2.id = HUB_PARTICIPANT_ID;

        // Act
        const response = await request(server)
            .post(`/participants`)
            .send(participant2)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    test("POST /participants - Should return error if try to create with duplicate id", async () => {
        // Arrange
        const participant2 = { ...mockedParticipant2 };
        participant2.id = mockedParticipant1.id;

        // Act
        const response = await request(server)
            .post(`/participants`)
            .send(participant2)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    test("PUT /participants/:id/approve - Should return error if try to approve with same user", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(server)
            .put(`/participants/${participantId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    test("PUT /participants/:id/approve - Should return error if try to approve a hub participant", async () => {
        // Arrange
        const participantId = "hub";

        // Act
        const response = await request(server)
            .put(`/participants/${participantId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    test("PUT /participants/:id/approve - Should be able to approve a participant", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        // Act
        const response = await request(server)
            .put(`/participants/${participantId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    test("POST /participants/:id/endpoints - Should add an endpoint to the participant", async () => {
        // Arrange
        const participant1 = mockedParticipant1;

        // Act
        const response = await request(server)
            .post(`/participants/${participant1.id}/endpoints`)
            .send(participant1.participantEndpoints[0])
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    //**Participant's Endpoint */

    test("GET /participants/:id/endpoints - Should return an array of participant endpoints", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(server)
            .get(`/participants/${participantId}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should update a participant endpoints and return status to be 200", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'http://56.45.45.162:4041'
        }

        // Act
        const response = await request(server)
            .put(`/participants/${participantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(200);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 404 if participantId is null or empty", async () => {
        // Arrange
        const emptyParticipantId = "";
        const nullParticipantId = null;
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'http://56.45.45.162:4041'
        }

        // Act
        const response = await request(server)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        const response2 = await request(server)
        .put(`/participants/${nullParticipantId}/endpoints/${endpointId}`)
        .set("authorization", AUTH_TOKEN)
        .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(404);
        expect(response2.status).toBe(404);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if participantId is hub participantId", async () => {
        // Arrange
        const emptyParticipantId = "hub";
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'http://56.45.45.162:4041'
        }

        // Act
        const response = await request(server)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if the participant is not active", async () => {
        // Arrange
        const emptyParticipantId = mockedInactiveParticipant.id;
        const endpointId = "1";
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'http://56.45.45.162:4041'
        }

        repoPartMock.store(mockedInactiveParticipant);
        // Act
        const response = await request(server)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if endpointId not found in participantEndpoints", async () => {
        // Arrange
        const emptyParticipantId = mockedParticipant1.id;
        const endpointId = "4";//Non existing endpoint
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            id: "4",
            type: ParticipantEndpointTypes.FSPIOP,
            protocol: ParticipantEndpointProtocols["HTTPs/REST"],
            value: 'http://56.45.45.162:4041'
        }

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(server)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should remove a participant endpoint", async () => {
        // Arrange
        const emptyParticipantId = mockedParticipant1.id;
        const endpointId = "1";

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(server)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(200);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 404 on empty participantId", async () => {
        // Arrange
        const emptyParticipantId = "5";
        const endpointId = "1";

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(server)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(404);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if participantId is hub participantId", async () => {
        // Arrange
        const emptyParticipantId = "hub";
        const endpointId = "1";

        // Act
        const response = await request(server)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(500);
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if participant is not active", async () => {
        // Arrange
        const emptyParticipantId = mockedInactiveParticipant.id;
        const endpointId = "1";

        repoPartMock.store(mockedInactiveParticipant);

        // Act
        const response = await request(server)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(500);
        
    });

    test("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if given endpointId not found.", async () => {
        // Arrange
        const emptyParticipantId = mockedParticipant1.id;
        const endpointId = "none"; //Non existing endpointId

        repoPartMock.store(mockedInactiveParticipant);
        
        // Act
        const response = await request(server)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(500);
    });
    
    /**Participant's Accounts */

    test("GET /participants/:id/accounts - Should return an array of participant accounts", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(server)
            .get(`/participants/${participantId}/accounts`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test("POST /participants/:id/accountChangeRequest - Should be able to create a participant account change request", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const participantAccount:IParticipantAccountChangeRequest = {
            id: "1",
            accountId: "1",
            type: ParticipantAccountTypes.POSITION,
            currencyCode: "USD",
            externalBankAccountId: "",
            externalBankAccountName: "",
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "ADD_ACCOUNT"
        }
        
        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/accountChangeRequest`)
            .send(participantAccount)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    test("POST /participants/:id/accountchangerequests/:changereqid/approve - Should update account change request status to true", async () => {
        // Arrange
        
        const participantId = "2";
        const accountChangeRequestId = "1";

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: participantId,
            participantAccountsChangeRequest: [
                {
                    id: accountChangeRequestId,
                    accountId: "1",
                    type: ParticipantAccountTypes.POSITION,
                    currencyCode: "USD",
                    externalBankAccountId: "",
                    externalBankAccountName: "",
                    createdBy: "user",
                    createdDate: now,
                    approved: false,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/approve`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId("2");
        const accountChangeRequest = fetchedParticipant?.participantAccountsChangeRequest.find((item)=> item.id === "1");
        // Assert
        expect(response.status).toBe(200);
        expect(accountChangeRequest?.approved).toBe(true);

    });

    test("POST /participants/:id/accountchangerequests/:changereqid/approve - Should return status 422 on approving participant account change request approval if participant is not active", async () => {
        // Arrange
        
        const participantId = "2";
        const accountChangeRequestId = "1";

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: participantId,
            isActive: false,
            participantAccountsChangeRequest: [
                {
                    id: accountChangeRequestId,
                    accountId: "1",
                    type: ParticipantAccountTypes.POSITION,
                    currencyCode: "USD",
                    externalBankAccountId: "",
                    externalBankAccountName: "",
                    createdBy: "user",
                    createdDate: now,
                    approved: false,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/approve`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId("2");
        const accountChangeRequest = fetchedParticipant?.participantAccountsChangeRequest.find((item)=> item.id === "1");
        // Assert
        expect(response.status).toBe(422);
        expect(accountChangeRequest?.approved).toBe(false);

    });

    test("POST /participants/:id/accountchangerequests/:changereqid/approve - Should return status 500 on non-existing accountChangeRequestId", async () => {
        // Arrange
        
        const participantId = "1";
        const accountChangeRequestId = "1";
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: participantId,
            participantAccountsChangeRequest: [
                {
                    id: accountChangeRequestId,
                    accountId: "1",
                    type: ParticipantAccountTypes.POSITION,
                    currencyCode: "USD",
                    externalBankAccountId: "",
                    externalBankAccountName: "",
                    createdBy: "user",
                    createdDate: now,
                    approved: false,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        const nonExistingAccChangeReq = "none";

        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/accountchangerequests/${nonExistingAccChangeReq}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    test("POST /participants/:id/accountchangerequests/:changereqid/approve - Should not be able to approve an already approved request", async () => {
        // Arrange
        
        const participantId = "1";
        const accountChangeRequestId = "1";

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: participantId,
            participantAccountsChangeRequest: [
                {
                    id: accountChangeRequestId,
                    accountId: "1",
                    type: ParticipantAccountTypes.POSITION,
                    currencyCode: "USD",
                    externalBankAccountId: "",
                    externalBankAccountName: "",
                    createdBy: "user",
                    createdDate: now,
                    approved: true,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
        expect(response.body.msg).toBe(`Participant's account change request with id: ${accountChangeRequestId} is already approved`)
    });
    
    /**Contact Info */

    test("GET /participants/:id/contactInfo - Should return an array of participant contact info", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(server)
            .get(`/participants/${participantId}/contactInfo`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
    

    test("GET /participants/:id/contactInfo - Should handle unauthorize error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "roleHasPrivilege").mockReturnValue(false);
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(server)
            .get(`/participants/${participantId}/contactInfo`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    test("POST /participants/:id/contactInfoChangeRequests - Should create a participant contact info", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
    });

    test("POST /participants/:id/contactInfoChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        jest.spyOn(authZClientMock, "roleHasPrivilege").mockReturnValue(false);

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(403);
    });

    test("POST /participants/:id/contactInfoChangeRequests - Should return status 422 when the participant is not active", async () => {
        // Arrange
        const inactiveParticipant = {
            ...mockedParticipant1,
            id: "10",
            isActive: false
        };

        repoPartMock.store(inactiveParticipant);

        const now = Date.now();

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(server)
            .post(`/participants/${inactiveParticipant.id}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(422);
    });

    test("POST /participants/:id/contactInfoChangeRequests - Should return error if the participant is hub participantId", async () => {
        // Arrange
        const now = Date.now();

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        };

        // Act
        const response = await request(server)
            .post(`/participants/${HUB_PARTICIPANT_ID}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(500);
    });

    test("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should approve a contact info change request", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            participantContactInfoChangeRequests: [
                {
                    id: "1",
                    name: "someone",
                    email: "someone@test.com",
                    phoneNumber: "0988564554",
                    role: "portal-staff",
                    contactInfoId: "1",
                    createdBy: "user",
                    createdDate: now,
                    approved: false,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(server)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(200);
    });

    test("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should handle unauthorized error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "roleHasPrivilege").mockReturnValue(false);

        // Act
        const response = await request(server)
            .post(`/participants/${mockedParticipant1.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(403);
    });

    test("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should return error for invalid changeRequestId", async () => {
        // Arrange
        const nonExistingChangeReqId = "none";
        // Act
        const response = await request(server)
            .post(`/participants/${mockedParticipant1.id}/contactInfoChangeRequests/${nonExistingChangeReqId}/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(500);
    });

    test("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should return error when approve by an inactive participant", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            isActive:false,
            participantContactInfoChangeRequests: [
                {
                    id: "1",
                    name: "someone",
                    email: "someone@test.com",
                    phoneNumber: "0988564554",
                    role: "portal-staff",
                    contactInfoId: "1",
                    createdBy: "user",
                    createdDate: now,
                    approved: false,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(server)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });


    /**Participant Status */

    test("POST /participants/:id/statusChangeRequests - Should create a participant status change request", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const statusChangeRequest: IParticipantStatusChangeRequest = {
            id: "1",
            isActive: false,
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS"
        }

        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/statusChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(statusChangeRequest);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
    });

    test("POST /participants/:id/statusChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const statusChangeRequest: IParticipantStatusChangeRequest = {
            id: "1",
            isActive: false,
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS"
        }

        jest.spyOn(authZClientMock, "roleHasPrivilege").mockReturnValue(false);

        // Act
        const response = await request(server)
            .post(`/participants/${participantId}/statusChangeRequests`)
            .set("authorization", AUTH_TOKEN).send(statusChangeRequest);

        // Assert
        expect(response.status).toBe(403);
    });

    test("POST /participants/:id/statusChangeRequests - Should not perform on the hub participant", async () => {
        // Arrange
        const inactiveParticipant = {
            ...mockedParticipant1,
            id: HUB_PARTICIPANT_ID,
            isActive: false
        };

        repoPartMock.store(inactiveParticipant);

        const now = Date.now();

        const statusChangeRequest: IParticipantStatusChangeRequest = {
            id: "1",
            isActive: false,
            createdBy: "user",
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS"
        }

        // Act
        const response = await request(server)
            .post(`/participants/${inactiveParticipant.id}/statusChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(statusChangeRequest);

        // Assert
        expect(response.status).toBe(500);
    });


    test("POST /participants/:id/statusChangeRequests/:changereqid/approve - Should be able to approve the participant status change request", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "13",
            isActive: false,
            participantStatusChangeRequests: [
                {
                    id: "1",
                    isActive: true,
                    createdBy: "user",
                    createdDate: now,
                    approved: false,
                    approvedBy: null,
                    approvedDate: null,
                    requestType: "CHANGE_PARTICIPANT_STATUS"
                }
            ]
        };

        repoPartMock.store(participant);

        // Act
        const response = await request(server)
            .post(`/participants/${participant.id}/statusChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(200);
    });

    test("POST /participants/:id/statusChangeRequests/:changereqid/approve - Should handle unauthorized error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "roleHasPrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(server)
            .post(`/participants/${mockedParticipant1.id}/statusChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(403);
    });

    test("POST /participants/:id/statusChangeRequests/:changereqid/approve - Should not perform on the hub participant", async () => {
        // Arrange
        const hubParticipant = HUB_PARTICIPANT_ID;
        
        // Act
        const response = await request(server)
            .post(`/participants/${hubParticipant}/statusChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    /**Source IP */
});