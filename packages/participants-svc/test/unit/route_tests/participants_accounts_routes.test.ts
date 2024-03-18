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
    mockedParticipant1,
    mockedParticipant2
} from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { ApprovalRequestState, IParticipant, IParticipantAccountChangeRequest, ParticipantAccountTypes } from "@mojaloop/participant-bc-public-types-lib";
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


describe("Participants Accounts' Routes - Unit Test", () => {
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

    /**Participant Accounts - Reject implementations*/

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
    
});