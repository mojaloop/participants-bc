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

 * Thitsaworks
 - Sithu kyaw <sithu.kyaw@thitsaworks.com>
 - Zwe Htet Myat <zwehtet.myat@thitsaworks.com>

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
    mockedParticipant2
} from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { ApprovalRequestState, HUB_PARTICIPANT_ID, IParticipant, IParticipantAccountChangeRequest, IParticipantContactInfoChangeRequest, IParticipantEndpoint, IParticipantFundsMovement, IParticipantLiquidityBalanceAdjustment, IParticipantNetDebitCapChangeRequest, IParticipantPendingApproval, IParticipantSourceIpChangeRequest, IParticipantStatusChangeRequest, ParticipantAccountTypes, ParticipantAllowedSourceIpsPortModes, ParticipantEndpointProtocols, ParticipantEndpointTypes, ParticipantFundsMovementDirections, ParticipantNetDebitCapTypes } from "@mojaloop/participant-bc-public-types-lib";
import { Server } from "http";
import ExcelJS from "exceljs";

const packageJSON = require("../../package.json");


const APP_VERSION = packageJSON.version;
const SVC_DEFAULT_HTTP_PORT = 3010;
const AUTH_TOKEN = "bearer: MOCKTOKEN";

const authTokenUrl = "mocked_auth_url";
const hasPrivilege = true;

const participantSvcUrl = process.env["PARTICIPANTS_SVC_URL"] || `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

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


describe("Participants Routes - Unit Test", () => {
    let app: Express;
    let expressServer: Server;
    let participantAgg;

    const VALID_IP_ADDRESS = process.env.VALID_PARTICIPANT_SOURCE_IP || "";
    const INVALID_IP_ADDRESS = process.env.INVALID_PARTICIPANT_SOURCE_IP || ""; 

    beforeAll(async () => {
        app = express();
        app.use(express.json()); // for parsing application/json
        app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

        //Create mock anb accounts
        await accAndBalAdapterMock.createAccount("1","1234","POSITION","USD");
        await accAndBalAdapterMock.createAccount("2","1234", "SETTLEMENT","USD");

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

        if (expressServer){
            await new Promise((resolve) => {
                expressServer.close(() => {
                    resolve(true);
                });
            });
        }
    });

    
    it("Return error when invalid access token", async () => {
        // Arrange
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce(null);
        
        // Act 
        const response = await request(participantSvcUrl)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(401);
    });

    it("Return error when no necessary privilege", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("GET /participants - Should return an array of participants", async () => {
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(response.body.items.length).toBe(1);
    });

    /** Participants */
    it("GET /participants - Should throw an error if cannot fetch participants", async () => {
        // Arrange
        jest.spyOn(repoPartMock, "searchParticipants").mockRejectedValueOnce(new Error("Error fetching participants"));

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    it("GET /participants/:ids/multi - Should fetch an array of participants by their ids", async () => {
        // Arrange
        const participantIds = `${mockedParticipantHub.id},${mockedParticipant1}`;

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantIds}/multi`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
    });

    it("GET /participants/:ids/multi - Should throw an error if cannot fetch participants by their ids", async () => {
        // Arrange
        const participantIds = `${mockedParticipantHub.id},${mockedParticipant1}`;
        jest.spyOn(repoPartMock, "fetchWhereIds").mockRejectedValueOnce(new Error("Error fetching participants with ids"));

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantIds}/multi`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    it("GET /participants/:id - Should fetch a participants by id", async () => {
        // Arrange
        const participantId = mockedParticipantHub.id;

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.id).toEqual(participantId);
    });

    it("GET /participants/:id - Should throw an error if cannot fetch participant by id", async () => {
        // Arrange
        const participantId = mockedParticipantHub.id;
        jest.spyOn(repoPartMock, "fetchWhereId").mockRejectedValueOnce(new Error("Error fetching participant with id"));

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants - Should be able to create a participant", async () => {
        // Arrange
        const participant1 = mockedParticipant1;

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants`)
            .send(participant1)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants - Should throw ParticipantCreateValidationError if name is empty", async () => {
        // Arrange
        const participant1 = { ...mockedParticipant1 };
        participant1.name = "";

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants`)
            .send(participant1)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    it("POST /participants - Should return error if type is HUB", async () => {
        // Arrange
        const participantHub = { ...mockedParticipantHub };

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants`)
            .send(participantHub)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    it("POST /participants - Should return error if try to create with duplicate name", async () => {
        // Arrange
        const participant1 = mockedParticipant1;

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants`)
            .send(participant1)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    it("POST /participants - Should return error if id is the same as Hub's id", async () => {
        // Arrange
        const participant2 = { ...mockedParticipant2 };
        participant2.id = HUB_PARTICIPANT_ID;

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants`)
            .send(participant2)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    it("POST /participants - Should return error if try to create with duplicate id", async () => {
        // Arrange
        const participant2 = { ...mockedParticipant2 };
        participant2.id = mockedParticipant1.id;

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants`)
            .send(participant2)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(400);
    });

    it("PUT /participants/:id/approve - Should return error if try to approve with same user", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${participantId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("PUT /participants/:id/approve - Should return error if try to approve a hub participant", async () => {
        // Arrange
        const participantId = "hub";

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${participantId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    it("PUT /participants/:id/approve - Should be able to approve a participant", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${participantId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    //**Participant's Endpoint */

    it("GET /participants/:id/endpoints - Should return an array of participant endpoints", async () => {
        // Arrange
        const mockedParticipant = mockedParticipant1;

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${mockedParticipant.id}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
    });

    it("GET /participants/:id/endpoints -Should handle unauthorized error", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("GET /participants/:id/endpoints - Should return 404 if the participant is not found", async () => {
        // Arrange
        const nonExistingParticipant= "none";

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${nonExistingParticipant}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(404);
    });

    it("POST /participants/:id/endpoints - Should be able to create a participant endpoint", async () => {
        // Arrange
        const participant = mockedParticipant1;
        const endpoint:IParticipantEndpoint = {
            id: "3",
            type: ParticipantEndpointTypes.FSPIOP,
            protocol: ParticipantEndpointProtocols["HTTPs/REST"],
            value: "https://172.31.88.169:4045"
        };
        
        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/endpoints`)
            .send(endpoint)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should update a participant endpoints and return status to be 200", async () => {
        // Arrange

        const participant:IParticipant = {
            ...mockedParticipant1
        };

        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'https://56.45.45.162:4041'
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${participant.id}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(200);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 404 if participantId is null or empty", async () => {
        // Arrange
        const emptyParticipantId = "";
        const nullParticipantId = null;
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'https://56.45.45.162:4041'
        }

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        const response2 = await request(participantSvcUrl)
        .put(`/participants/${nullParticipantId}/endpoints/${endpointId}`)
        .set("authorization", AUTH_TOKEN)
        .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(404);
        expect(response2.status).toBe(404);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if participantId is hub participantId", async () => {
        // Arrange
        const emptyParticipantId = "hub";
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'https://56.45.45.162:4041'
        }

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if the participant is not active", async () => {
        // Arrange
       
        const inActiveParticipant: IParticipant= {
            ...mockedParticipant1, 
            isActive: false
        }

        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'https://56.45.45.162:4041'
        }

        repoPartMock.store(inActiveParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${inActiveParticipant.id}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if endpointId not found in participantEndpoints", async () => {
        // Arrange
        const emptyParticipantId = mockedParticipant1.id;
        const endpointId = "4";//Non existing endpoint
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            id: "4",
            type: ParticipantEndpointTypes.FSPIOP,
            protocol: ParticipantEndpointProtocols["HTTPs/REST"],
            value: 'https://56.45.45.162:4041'
        }

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should remove a participant endpoint", async () => {
        // Arrange
        const emptyParticipantId = mockedParticipant1.id;
        const endpointId = "1";

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(participantSvcUrl)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(200);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 404 on empty participantId", async () => {
        // Arrange
        const emptyParticipantId = "5";
        const endpointId = "1";

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(participantSvcUrl)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(404);
    });

    
    
    /**Participant's Accounts */

    it("GET /participants/:id/accounts - Should return an array of participant accounts", async () => {
        // Arrange
        const participant = {
            ...mockedParticipant1,
            id: "3"
        };

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participant.id}/accounts`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /participants/:id/accounts - Should handle unauthorized error", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}/accounts`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/accountChangeRequest - Should be able to create a participant account change request", async () => {
        // Arrange
        const now = Date.now();
        const particpant = mockedParticipant1;
        const participantAccount:IParticipantAccountChangeRequest = {
            id: "3",
            accountId: "3",
            type: ParticipantAccountTypes.POSITION,
            currencyCode: "USD",
            externalBankAccountId: "",
            externalBankAccountName: "",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_ACCOUNT"
        }
        repoPartMock.store(particpant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${particpant.id}/accountChangeRequest`)
            .send(participantAccount)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/accountchangerequests/:changereqid/approve - Should update account requestState to 'APPROVED'", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/approve`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId("2");
        const accountChangeRequest = fetchedParticipant?.participantAccountsChangeRequest.find((item)=> item.id === "1");
        // Assert
        expect(response.status).toBe(200);
        expect(accountChangeRequest?.requestState).toBe(ApprovalRequestState.APPROVED);

    });

    it("POST /participants/:id/accountchangerequests/:changereqid/approve - Should return status 422 on approving participant account change request approval if participant is not active", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });

    it("POST /participants/:id/accountchangerequests/:changereqid/approve - Should return status 500 on non-existing accountChangeRequestId", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        const nonExistingAccChangeReq = "none";

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/accountchangerequests/${nonExistingAccChangeReq}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/accountchangerequests/:changereqid/approve - Should not be able to approve an already approved request", async () => {
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
                    requestState: ApprovalRequestState.APPROVED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
        expect(response.body.msg).toBe(`Participant's account change request with id: ${accountChangeRequestId} is already approved`)
    });
    
    /**Contact Info */

    it("GET /participants/:id/contactInfo - Should return an array of participant contact info", async () => {
        // Arrange
        repoPartMock.store(mockedParticipant1);
        
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${mockedParticipant1.id}/contactInfo`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
    
    it("GET /participants/:id/contactInfo - Should handle unauthorize error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}/contactInfo`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should create a participant contact info", async () => {
        // Arrange
        const now = Date.now();
        const participant = mockedParticipant1;
        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should return status 422 when the participant is not active", async () => {
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
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${inactiveParticipant.id}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(422);
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should return error if the participant is hub participantId", async () => {
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
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        };

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${HUB_PARTICIPANT_ID}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should approve a contact info change request", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(200);
    });
    

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should handle unauthorized error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant1.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should return error for invalid changeRequestId", async () => {
        // Arrange
        const nonExistingChangeReqId = "none";

        const now = Date.now();
        
        const changeRequest: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }

        const participant: IParticipant = {
            ...mockedParticipant1,
            participantContactInfoChangeRequests: [changeRequest]
        };
    

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/${nonExistingChangeReqId}/approve`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should return error when approve by an inactive participant", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should throw error when approving the non existing participant", async () => {
        // Arrange

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/non_exiting_participant/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(404);
    });


    /**Participant Status */

    it("POST /participants/:id/statusChangeRequests - Should create a participant status change request", async () => {
        // Arrange
        const now = Date.now();
        const mockedParticipant = mockedParticipant1;
        const statusChangeRequest: IParticipantStatusChangeRequest = {
            id: "1",
            isActive: false,
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS"
        }

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/statusChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(statusChangeRequest);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
    });

    it("POST /participants/:id/statusChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const statusChangeRequest: IParticipantStatusChangeRequest = {
            id: "1",
            isActive: false,
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS"
        }

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/statusChangeRequests`)
            .set("authorization", AUTH_TOKEN).send(statusChangeRequest);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/statusChangeRequests - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = {
            ...mockedParticipantHub,
            id: HUB_PARTICIPANT_ID,
            isActive: false
        };

        repoPartMock.store(participant);

        const now = Date.now();

        const statusChangeRequest: IParticipantStatusChangeRequest = {
            id: "1",
            isActive: false,
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS"
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/statusChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(statusChangeRequest);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/statusChangeRequests/:changereqid/approve - Should be able to approve the participant status change request", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "CHANGE_PARTICIPANT_STATUS"
                }
            ]
        };

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/statusChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/statusChangeRequests/:changereqid/approve - Should handle unauthorized error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant1.id}/statusChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/statusChangeRequests/:changereqid/approve - Should not perform on the hub participant", async () => {
        // Arrange
        const hubParticipant = HUB_PARTICIPANT_ID;
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${hubParticipant}/statusChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(500);
    });

    /**Source IP */

    it("GET /participants/:id/sourceIps - Should return an array of the participant's source IPs", async () => {
        // Arrange
        const mockedParticipant = mockedParticipant1;

        repoPartMock.store(mockedParticipant);
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${mockedParticipant.id}/sourceIps`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /participants/:id/sourceIps - Should handle unauthorize error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}/sourceIps`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/sourceIpChangeRequests - Should create a participant sourceIP change request", async () => {
        // Arrange
        const now = Date.now();
        const mockedParticipant = mockedParticipant1;

        const sourceIPChangeRequest: IParticipantSourceIpChangeRequest = {
            id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
            allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
            cidr: VALID_IP_ADDRESS,
            portMode: ParticipantAllowedSourceIpsPortModes.ANY,
            ports: [3000, 4000],
            portRange: {rangeFirst: 0, rangeLast: 0},
            createdBy: "admin",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP"
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/sourceIpChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(sourceIPChangeRequest);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
    });

    it("POST /participants/:id/sourceIpChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const sourceIPChangeRequest: IParticipantSourceIpChangeRequest = {
            id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
            allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
            cidr: VALID_IP_ADDRESS,
            portMode: ParticipantAllowedSourceIpsPortModes.ANY,
            ports: [3000, 4000],
            portRange: {rangeFirst: 0, rangeLast: 0},
            createdBy: "admin",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP"
        }

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/sourceIpChangeRequests`)
            .set("authorization", AUTH_TOKEN).send(sourceIPChangeRequest);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/sourceIpChangeRequests - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = {
            ...mockedParticipantHub,
            id: HUB_PARTICIPANT_ID,
            isActive: true
        };

        repoPartMock.store(participant);

        const now = Date.now();

        const sourceIPChangeRequest: IParticipantSourceIpChangeRequest = {
            id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
            allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
            cidr: VALID_IP_ADDRESS,
            portMode: ParticipantAllowedSourceIpsPortModes.ANY,
            ports: [3000, 4000],
            portRange: {rangeFirst: 0, rangeLast: 0},
            createdBy: "admin",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP"
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/sourceIpChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(sourceIPChangeRequest);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/SourceIpChangeRequests/:changereqid/approve - Should be able to approve a participant sourceIP change request", async () => {
        // Arrange
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant2,
            isActive: true,
            participantSourceIpChangeRequests: [{
                id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
                allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
                cidr: VALID_IP_ADDRESS,
                portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                ports: [3000, 4000],
                portRange: { rangeFirst: 0, rangeLast: 0 },
                createdBy: "admin",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                approvedBy: null,
                approvedDate: null,
                rejectedBy: null,
                rejectedDate: null,
                requestType: "ADD_SOURCE_IP"

            }]
        }

        repoPartMock.store(participant);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/SourceIpChangeRequests/908144a9-2505-4787-b39e-60e8f9fe9b99/approve`)
            .set("authorization", AUTH_TOKEN);
            

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/SourceIpChangeRequests/:changereqid/approve - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const sourceIPChangeRequest: IParticipantSourceIpChangeRequest = {
            id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
            allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
            cidr: VALID_IP_ADDRESS,
            portMode: ParticipantAllowedSourceIpsPortModes.ANY,
            ports: [3000, 4000],
            portRange: {rangeFirst: 0, rangeLast: 0},
            createdBy: "admin",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP"
        }

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/SourceIpChangeRequests/908144a9-2505-4787-b39e-60e8f9fe9b99/approve`)
            .set("authorization", AUTH_TOKEN).send(sourceIPChangeRequest);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/SourceIpChangeRequests/:changereqid/approve - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = {
            ...mockedParticipantHub,
            id: HUB_PARTICIPANT_ID,
            isActive: false
        };

        repoPartMock.store(participant);

        const now = Date.now();

        const sourceIPChangeRequest: IParticipantSourceIpChangeRequest = {
            id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
            allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
            cidr: VALID_IP_ADDRESS,
            portMode: ParticipantAllowedSourceIpsPortModes.ANY,
            ports: [3000, 4000],
            portRange: {rangeFirst: 0, rangeLast: 0},
            createdBy: "admin",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP"
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/SourceIpChangeRequests/908144a9-2505-4787-b39e-60e8f9fe9b99/approve`)
            .set("authorization", AUTH_TOKEN)
            .send(sourceIPChangeRequest);

        // Assert
        expect(response.status).toBe(500);
    });

    /**Fund Movement */

    it("POST /participants/:id/funds - Should create a participant fund movement record", async () => {
        // Arrange
        
        const now = Date.now();
        const mockedParticipant = mockedParticipant1;

        const fundMovement: IParticipantFundsMovement = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "15000",
            transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
            extReference: null,
            note: null
        }
        
        repoPartMock.store(mockedParticipant);


        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/funds`)
            .set("authorization", AUTH_TOKEN)
            .send(fundMovement);

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/funds - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        const fundMovement: IParticipantFundsMovement = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "15000",
            transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
            extReference: null,
            note: null
        }

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/funds`)
            .set("authorization", AUTH_TOKEN).send(fundMovement);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/funds - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = {
            ...mockedParticipantHub,
            id: HUB_PARTICIPANT_ID,
            isActive: true
        };

        repoPartMock.store(participant);

        const now = Date.now();

        const fundMovement: IParticipantFundsMovement = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "15000",
            transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
            extReference: null,
            note: null
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/funds`)
            .set("authorization", AUTH_TOKEN)
            .send(fundMovement);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/funds/:fundsMovId/approve - Should be able to approve a participant fund movement request", async () => {
        // Arrange
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant2,
            isActive: true,
            fundsMovements: [{
                id: "1",
                createdBy: "admin",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                approvedBy: null,
                approvedDate: null,
                rejectedBy: null,
                rejectedDate: null,
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                currencyCode: "USD",
                amount: "15000",
                transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
                extReference: null,
                note: null
            }]
        }

        repoPartMock.store(participant);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/funds/1/approve`)
            .set("authorization", AUTH_TOKEN);
            

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/funds/:fundsMovId/approve - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant2,
            isActive: true,
            fundsMovements: [
                {
                    id: "1",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                    currencyCode: "USD",
                    amount: "15000",
                    transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
                    extReference: null,
                    note: null
                }
            ]
        }

        repoPartMock.store(participant);

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/funds/1/approve`)
            .set("authorization", AUTH_TOKEN).send(participant.fundsMovements[0]);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/funds/:fundsMovId/approve - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = {
            ...mockedParticipantHub,
            id: HUB_PARTICIPANT_ID,
            isActive: true
        };

        repoPartMock.store(participant);

        const now = Date.now();

        const fundMovement: IParticipantFundsMovement = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "15000",
            transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
            extReference: null,
            note: null
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/funds/1/approve`)
            .set("authorization", AUTH_TOKEN)
            .send(fundMovement);

        // Assert
        expect(response.status).toBe(500);
    });


    /**Net Debit Cap */

    it("POST /participants/:id/ndcChangeRequests - Should create a participant NDC change request", async () => {
        // Arrange
        const now = Date.now();
        const mockedParticipant = mockedParticipant2;
        const ndcChangeRequest: IParticipantNetDebitCapChangeRequest = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            currencyCode: "USD",
            type: ParticipantNetDebitCapTypes.ABSOLUTE,
            percentage: null,
            fixedValue: 1000000,
            extReference: null,
            note: null
        }

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/ndcChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(ndcChangeRequest);

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/ndcChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant2.id;
        const ndcChangeRequest: IParticipantNetDebitCapChangeRequest = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            currencyCode: "USD",
            type: ParticipantNetDebitCapTypes.ABSOLUTE,
            percentage: null,
            fixedValue: 1000000,
            extReference: null,
            note: null
        }

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/ndcChangeRequests`)
            .set("authorization", AUTH_TOKEN).send(ndcChangeRequest);

        // Assert
        expect(response.status).toBe(403);
    });
     
    it("POST /participants/:id/ndcChangeRequests - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = {
            ...mockedParticipantHub,
            id: HUB_PARTICIPANT_ID,
            isActive: true
        };

        repoPartMock.store(participant);

        const now = Date.now();

        const ndcChangeRequest: IParticipantNetDebitCapChangeRequest = {
            id: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            currencyCode: "USD",
            type: ParticipantNetDebitCapTypes.ABSOLUTE,
            percentage: null,
            fixedValue: 1000000,
            extReference: null,
            note: null
        }

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/ndcChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(ndcChangeRequest);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/ndcChangeRequests - Should be able to approve the NDC change request", async () => {
        // Arrange
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant2,
            isActive: true,
            netDebitCapChangeRequests: [{
                id: "1",
                createdBy: "admin",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                approvedBy: null,
                approvedDate: null,
                rejectedBy: null,
                rejectedDate: null,
                currencyCode: "USD",
                type: ParticipantNetDebitCapTypes.ABSOLUTE,
                percentage: null,
                fixedValue: 50000,
                extReference: null,
                note: null
            }]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/ndcchangerequests/1/approve`)
            .set("authorization", AUTH_TOKEN);
            

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/ndcChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant2,
            isActive: true,
            netDebitCapChangeRequests: [{
                id: "1",
                createdBy: "admin",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                approvedBy: null,
                approvedDate: null,
                rejectedBy: null,
                rejectedDate: null,
                currencyCode: "USD",
                type: ParticipantNetDebitCapTypes.ABSOLUTE,
                percentage: null,
                fixedValue: 1000000,
                extReference: null,
                note: null
            }]
        }

        repoPartMock.store(participant);

        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/ndcchangerequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/ndcChangeRequests - Should not perform on the hub participant", async () => {
        // Arrange
        const participant = mockedParticipantHub;
        const now = Date.now();

        const ndcChangeRequest: IParticipantNetDebitCapChangeRequest = {
            id: "1",
            createdBy: "admin",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            currencyCode: "USD",
            type: ParticipantNetDebitCapTypes.ABSOLUTE,
            percentage: null,
            fixedValue: 1000000,
            extReference: null,
            note: null
        }
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/funds/1/approve`)
            .set("authorization", AUTH_TOKEN)
            .send(ndcChangeRequest);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/ndcChangeRequests - Should return status 422 when the participant is not active", async () => {
        // Arrange
        const now = Date.now();
        const participant:IParticipant = {
            ...mockedParticipant1,
            isActive:false,
            netDebitCapChangeRequests: [
                {
                    id: "1",
                    createdBy: "admin",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    currencyCode: "USD",
                    type: ParticipantNetDebitCapTypes.ABSOLUTE,
                    percentage: null,
                    fixedValue: 1000000,
                    extReference: null,
                    note: null
                }
            ]
        };

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/ndcChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN)
            .send(participant.netDebitCapChangeRequests);

        // Assert
        expect(response.status).toBe(422);
    });


    /**Liquidity Check */

    it("POST /participants/liquidityCheckValidate - Should handle the case when no file is uploaded", async () => {
        // Arrange

        //Act
        await request(participantSvcUrl)
            .post('/participants/liquidityCheckValidate')
            .set("authorization", AUTH_TOKEN)
            .expect(400)
            .expect('Content-Type', /json/)
            .then((response) => {
                expect(response.body).toEqual({ error: 'No file uploaded' });
            });

    });

    it("POST /participants/liquidityCheckValidate - Should return error for invalid excel file", async () => {
        // Arrange
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        worksheet.addRow(['Header1', 'Header2']);
        worksheet.addRow(['Value1', 'Value2']);

        // Save the workbook to a buffer
        const excelBuffer = await workbook.xlsx.writeBuffer();

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckValidate')
            .set("authorization", AUTH_TOKEN)
            .attach('settlementInitiation', Buffer.from(excelBuffer), { filename: 'example.xlsx' }) // Attach the dynamically created Excel file
        
        //Assert

        expect(response.status).toBe(500);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should make adjustment successfully", async () => {
       
        //Arrange

        const participant: IParticipant = {
            ...mockedParticipant1,
            isActive:true
        };

        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "participant1",
                participantName: "Participant 1",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "USD",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        repoPartMock.store(participant);

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(200);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should return 422 when the participant is not active", async () => {
       
        //Arrange
        const participant: IParticipant = {
            ...mockedParticipant1,
            isActive:false
        };

        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "participant1",
                participantName: "Participant 1",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "USD",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        repoPartMock.store(participant);

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(422);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should return 404 if the participant is not found", async () => {
       
        //Arrange
        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "none_existing_participant",
                participantName: "Non existing participant",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "USD",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(404);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should return 500 when the participant's account not found", async () => {
       
        //Arrange
        const participant: IParticipant = {
            ...mockedParticipant1,
            isActive:true
        };

        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "participant1",
                participantName: "Participant 1",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "EUR",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        repoPartMock.store(participant);

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(500);

    });

    /**Participant Pending Approval */

    it("GET /participants/pendingApprovalsSummary - Should return participant's pending approval summary", async () => {
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/pendingApprovalsSummary`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    it("GET /participants/pendingApprovalsSummary - Should handle unauthorized error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/pendingApprovalsSummary`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(403);
    });

    it("GET /participants/pendingApprovals - Should return participant's pending approvals", async () => {
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/pendingApprovals`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    it("GET /participants/pendingApprovals - Should handle unauthorized error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/pendingApprovals`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/pendingApprovals - Should handle the route successfully", async () => {
        //Arrange
        const pendingApprovals:IParticipantPendingApproval = {
            accountsChangeRequest: [],
            fundsMovementRequest: [] ,
            ndcChangeRequests:[],
            ipChangeRequests: [],
            contactInfoChangeRequests: [],
            statusChangeRequests: [],
        }
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/pendingApprovals/approve`)
            .set("authorization", AUTH_TOKEN)
            .send(pendingApprovals);

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/pendingApprovals - Should handle unauthorized error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const pendingApprovals:IParticipantPendingApproval = {
            accountsChangeRequest: [],
            fundsMovementRequest: [] ,
            ndcChangeRequests:[],
            ipChangeRequests: [],
            contactInfoChangeRequests: [],
            statusChangeRequests: [],
        }
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/pendingApprovals/approve`)
            .set("authorization", AUTH_TOKEN)
            .send(pendingApprovals);

        // Assert
        expect(response.status).toBe(500);
    });

    it("GET /searchKeywords/ - Should handle the route successfully", async () => {
        //Arrange
        
        // Act
        const response = await request(participantSvcUrl)
            .get(`/searchKeywords/`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /searchKeywords/ - Should handle unauthorized error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/searchKeywords/`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(403);
    });

   
    /**Participant Contact Info Change Requests - Reject implementations*/
    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/reject - Should reject a contact info change request", async () => {
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/11/contactInfoChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/:id/contactInfoChangeRequests/:changereqid/reject`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/reject - Should throw error if participant is not active", async () => {
        //Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            isActive: false,
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/11/contactInfoChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(422);
    });

    /**Participant Status Change Requests - Reject implementations*/
    it("POST /participants/:id/statusChangeRequests/:changereqid/reject - Should reject participant status change request", async () => {
        // Arrange
        
        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "13",
            isActive: false,
            participantStatusChangeRequests: [
                {
                    id: "1",
                    isActive: true,
                    createdBy: "admin",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "CHANGE_PARTICIPANT_STATUS"
                }
            ]
        };

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/13/statusChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/statusChangeRequests/:changereqid/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/11/statusChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(403);
    });

    /**Participant Account Change Requests - Reject implementations*/
    it("POST /participants/:id/accountchangerequests/:changereqid/reject - Should reject an account change request", async () => {
        // Arrange
        
        const participantId = "2";
        const accountChangeRequestId = "1";

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant2,
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
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/accountchangerequests/${accountChangeRequestId}/reject`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId("2");
        const accountChangeRequest = fetchedParticipant?.participantAccountsChangeRequest.find((item)=> item.id === "1");

        // Assert
        expect(response.status).toBe(200);
        expect(accountChangeRequest?.requestState).toBe(ApprovalRequestState.REJECTED);
    });

    it("POST /participants/:id/accountchangerequests/:changereqid/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "14",
            isActive:true,
            participantAccountsChangeRequest: [
                {
                    id: "1",
                    accountId: "1",
                    type: ParticipantAccountTypes.POSITION,
                    currencyCode: "USD",
                    externalBankAccountId: "",
                    externalBankAccountName: "",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/14/accountchangerequests/1/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/accountchangerequests/:changereqid/reject - Should throw error if participant is not active", async () => {
        //Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "14",
            isActive:false,
            participantAccountsChangeRequest: [
                {
                    id: "1",
                    accountId: "1",
                    type: ParticipantAccountTypes.POSITION,
                    currencyCode: "USD",
                    externalBankAccountId: "",
                    externalBankAccountName: "",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_ACCOUNT"
                }
            ]
        }
        repoPartMock.store(participant);
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/11/contactInfoChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(422);
    });


    /**Participant Fund Movement Change Requests  - Reject implementations*/
    it("POST /participants/:id/funds/:fundsMovId/reject - Should reject an fund movement request", async () => {
        // Arrange
        
        const now = Date.now();
        const mockedParticipant: IParticipant = {
            ...mockedParticipant1,
            fundsMovements: [
                {
                    id: "3",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                    currencyCode: "USD",
                    amount: "200000",
                    transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
                    extReference: null,
                    note: null
                }
            ]
        };
        
        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/funds/3/reject`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId(mockedParticipant1.id);
        const fundMovementChangeRequest = fetchedParticipant?.fundsMovements.find((item)=> item.id === "3");

        // Assert
        expect(response.status).toBe(200);
        expect(fundMovementChangeRequest?.requestState).toBe(ApprovalRequestState.REJECTED);
    });

    it("POST /participants/:id/funds/:fundsMovId/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const now = Date.now();
        const mockedParticipant: IParticipant = {
            ...mockedParticipant1,
            fundsMovements: [
                {
                    id: "3",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                    currencyCode: "USD",
                    amount: "200000",
                    transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
                    extReference: null,
                    note: null
                }
            ]
        };

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/funds/${mockedParticipant.fundsMovements[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/funds/:fundsMovId/reject - Should throw error if participant is not active", async () => {
        //Arrange
        const now = Date.now();
        const mockedParticipant: IParticipant = {
            ...mockedParticipant1,
            isActive: false,
            fundsMovements: [
                {
                    id: "3",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                    currencyCode: "USD",
                    amount: "200000",
                    transferId: "0bc1f9cc-2ad1-4606-8aec-ed284563d1a3",
                    extReference: null,
                    note: null
                }
            ]
        };

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/funds/${mockedParticipant.fundsMovements[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });

    /**Participant NDC Change Requests - Reject implementations*/
     it("POST /participants/:id/ndcchangerequests/:ndcReqId/reject - Should reject a net debitcap change request", async () => {
        // Arrange
        
         const now = Date.now();

         const mockedParticipant: IParticipant = {
             ...mockedParticipant1,
             netDebitCapChangeRequests: [{
                 id: "1",
                 createdBy: "user",
                 createdDate: now,
                 requestState: ApprovalRequestState.CREATED,
                 approvedBy: null,
                 approvedDate: null,
                 rejectedBy: null,
                 rejectedDate: null,
                 currencyCode: "USD",
                 type: ParticipantNetDebitCapTypes.ABSOLUTE,
                 percentage: null,
                 fixedValue: 1000000,
                 extReference: null,
                 note: null
             }
             ]
         };
        
        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/ndcchangerequests/1/reject`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId(mockedParticipant1.id);
        const ndcChangeRequest = fetchedParticipant?.netDebitCapChangeRequests.find((item)=> item.id === "1");

        // Assert
        expect(response.status).toBe(200);
        expect(ndcChangeRequest?.requestState).toBe(ApprovalRequestState.REJECTED);
    });

    it("POST /participants/:id/ndcchangerequests/:ndcReqId/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const now = Date.now();

        const mockedParticipant: IParticipant = {
            ...mockedParticipant1,
            netDebitCapChangeRequests: [{
                id: "1",
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                approvedBy: null,
                approvedDate: null,
                rejectedBy: null,
                rejectedDate: null,
                currencyCode: "USD",
                type: ParticipantNetDebitCapTypes.ABSOLUTE,
                percentage: null,
                fixedValue: 1000000,
                extReference: null,
                note: null
            }
            ]
        };

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/ndcchangerequests/${mockedParticipant.netDebitCapChangeRequests[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/ndcchangerequests/:ndcReqId/reject - Should throw error if participant is not active", async () => {
        //Arrange
        const now = Date.now();
        const mockedParticipant: IParticipant = {
            ...mockedParticipant1,
            isActive:false,
            netDebitCapChangeRequests: [{
                id: "1",
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                approvedBy: null,
                approvedDate: null,
                rejectedBy: null,
                rejectedDate: null,
                currencyCode: "USD",
                type: ParticipantNetDebitCapTypes.ABSOLUTE,
                percentage: null,
                fixedValue: 1000000,
                extReference: null,
                note: null
            }
            ]
        };

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/ndcchangerequests/${mockedParticipant.netDebitCapChangeRequests[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });

    /**Participant Source IP Change Requests - Reject implementations*/
    it("POST /participants/:id/SourceIpChangeRequests/:changereqid/reject - Should reject a sourceIP change request", async () => {
        // Arrange

        jest.spyOn(tokenHelperMock, "getCallSecurityContextFromAccessToken").mockResolvedValueOnce({
            username: "user",
			clientId: "user",
			platformRoleIds: ["user"],
			accessToken: "mock-token",
        });

        const now = Date.now();
        const mockedParticipant:IParticipant = {
            ...mockedParticipant1,
            participantSourceIpChangeRequests: [
                {
                    id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
                    allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
                    cidr: VALID_IP_ADDRESS,
                    portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                    ports: [3000, 4000],
                    portRange: { rangeFirst: 0, rangeLast: 0 },
                    createdBy: "admin",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_SOURCE_IP"

                }
            ]
        };
        
        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/SourceIpChangeRequests/${mockedParticipant.participantSourceIpChangeRequests[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        const fetchedParticipant = await repoPartMock.fetchWhereId(mockedParticipant1.id);
        const sourceIpChangeRequests = fetchedParticipant?.participantSourceIpChangeRequests.find((item)=> item.id === mockedParticipant.participantSourceIpChangeRequests[0].id);

        // Assert
        expect(response.status).toBe(200);
        expect(sourceIpChangeRequests?.requestState).toBe(ApprovalRequestState.REJECTED);
    });

    it("POST /participants/:id/SourceIpChangeRequests/:changereqid/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const now = Date.now();
        const mockedParticipant:IParticipant = {
            ...mockedParticipant1,
            participantSourceIpChangeRequests: [
                {
                    id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
                    allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
                    cidr: VALID_IP_ADDRESS,
                    portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                    ports: [3000, 4000],
                    portRange: { rangeFirst: 0, rangeLast: 0 },
                    createdBy: "admin",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_SOURCE_IP"

                }
            ]
        };

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/SourceIpChangeRequests/${mockedParticipant.participantSourceIpChangeRequests[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/SourceIpChangeRequests/:ndcReqId/reject - Should throw error if participant is not active", async () => {
        //Arrange
        const now = Date.now();
        const mockedParticipant:IParticipant = {
            ...mockedParticipant1,
            isActive: false,
            participantSourceIpChangeRequests: [
                {
                    id: "908144a9-2505-4787-b39e-60e8f9fe9b99",
                    allowedSourceIpId: "fdda19bc-96ab-42bb-af9e-bbdc71889250",
                    cidr: VALID_IP_ADDRESS,
                    portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                    ports: [3000, 4000],
                    portRange: { rangeFirst: 0, rangeLast: 0 },
                    createdBy: "admin",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_SOURCE_IP"

                }
            ]
        };

        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant.id}/SourceIpChangeRequests/${mockedParticipant.participantSourceIpChangeRequests[0].id}/reject`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });


});