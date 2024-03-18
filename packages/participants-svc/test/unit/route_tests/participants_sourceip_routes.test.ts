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
import { ApprovalRequestState, HUB_PARTICIPANT_ID, IParticipant, IParticipantSourceIpChangeRequest, ParticipantAllowedSourceIpsPortModes } from "@mojaloop/participant-bc-public-types-lib";
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


describe("Participants SourceIp Routes - Unit Test", () => {
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
            cidr: "192.168.20.10/32",
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
            cidr: "192.168.20.10/32",
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
            cidr: "192.168.20.10/32",
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
                cidr: "192.168.20.10/32",
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
            cidr: "192.168.20.10/32",
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
            cidr: "192.168.20.10/32",
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

});