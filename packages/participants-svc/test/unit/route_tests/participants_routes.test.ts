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
import { ExpressRoutes } from "../../../src/application/routes";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantAggregate } from "../../../src/domain/participant_agg";
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
import { HUB_PARTICIPANT_ID, IParticipantPendingApproval } from "@mojaloop/participant-bc-public-types-lib";
import { Server } from "http";

const packageJSON = require("../../../package.json");


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

});