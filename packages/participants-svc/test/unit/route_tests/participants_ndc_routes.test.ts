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
import { ApprovalRequestState, HUB_PARTICIPANT_ID, IParticipant, IParticipantNetDebitCapChangeRequest, ParticipantNetDebitCapTypes } from "@mojaloop/participant-bc-public-types-lib";
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

});