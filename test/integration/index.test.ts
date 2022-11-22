/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Coil
 *  - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {ParticipantsHttpClient, UnableToCreateParticipantAccountError} from "@mojaloop/participants-bc-client-lib";
import {
    Participant,
    ParticipantAccount,
    ParticipantEndpoint
} from "@mojaloop/participant-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {MLKafkaRawProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import * as Crypto from "crypto";
import {ConsoleLogger} from "@mojaloop/logging-bc-public-types-lib/dist/console_logger";

/* ********** Constants Begin ********** */

// General:
const BOUNDED_CONTEXT_NAME: string = "participants-bc";
const SERVICE_NAME: string = "integration-tests";
const SERVICE_VERSION: string = "0.0.1";

// Message broker:
const MESSAGE_BROKER_HOST: string = process.env.PARTICIPANTS_MESSAGE_BROKER_HOST ?? "localhost";
const MESSAGE_BROKER_PORT_NO: number =
        parseInt(process.env.PARTICIPANTS_MESSAGE_BROKER_PORT_NO ?? "") || 9092;
const MESSAGE_BROKER_URL: string = `${MESSAGE_BROKER_HOST}:${MESSAGE_BROKER_PORT_NO}`;

// Logging:
const LOGGING_LEVEL: LogLevel = LogLevel.INFO;
const LOGGING_TOPIC: string = `${BOUNDED_CONTEXT_NAME}_${SERVICE_NAME}_logging`;

// Web server:
const WEB_SERVER_HOST: string = process.env.PARTICIPANTS_WEB_SERVER_HOST ?? "localhost";
const WEB_SERVER_PORT_NO: number =
        parseInt(process.env.PARTICIPANTS_WEB_SERVER_PORT_NO ?? "") || 3010;

// Participants HTTP client:
const BASE_URL_PARTICIPANTS_HTTP_SERVICE: string = `http://${WEB_SERVER_HOST}:${WEB_SERVER_PORT_NO}`;
const TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT: number = 10_000;

/* ********** Constants End ********** */

let logger: ILogger;
let participantsHttpClient: ParticipantsHttpClient;

// Make sure these are valid tokens for different users and both all the full set of Participants privileges
const USER1_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InFmWFRRWHhXTHBuZTFaX0VQUkpwbXMtUWc3OXpEVUQzYXNwSmJ1VzM1eE0ifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzZWN1cml0eS1iYy11aSIsInJvbGVzIjpbIjdhYzA5YTI2LTEwZDMtNDBiMC1iZmVlLTJjMTNkMzI0OTk1NCJdLCJpYXQiOjE2NjQ4MzkwMjIsImV4cCI6MTY2NDg0MjYyMiwiYXVkIjoibW9qYWxvb3Audm5leHQuZGVmYXVsdF9hdWRpZW5jZSIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzIwMS8iLCJzdWIiOiJ1c2VyOjp1c2VyIiwianRpIjoiOThlYTg3ZGEtNTE5NC00M2Q0LTljMjQtZjQzODdmOTNjOTQyIn0.P5U9ESj2KtCWq394Ny-5HHUApOSB2NFJw3bfUm8XXSZ0jujvaIVz9HIUdCGjsNprFphLHgo6k8-dlwSeaHHn94XO9MmjppxrkBIcWZLPojipZrbvcN7vyh1VE2qAeRAdLbXlO35BzNYwQLQIvJwChWb38fHIPi2hQVrFP5ZrTAlFc_RxxRifFEc6HJ3bE_IRxskGltaj0uS5CSj7iAzblqduhDhmm1tZ2XUjv5b-xsti8q9kKNMJ93zghl_NmG0p9DOH5DWxM_A4EegTITbng5MuBiRJ6ll4r7VCLyjmBJRuvhLeeuefbd1VF5JMITKqW9b2OgDg3AdduH6W7V1dMw";
const USER2_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InFmWFRRWHhXTHBuZTFaX0VQUkpwbXMtUWc3OXpEVUQzYXNwSmJ1VzM1eE0ifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzZWN1cml0eS1iYy11aSIsInJvbGVzIjpbIjdhYzA5YTI2LTEwZDMtNDBiMC1iZmVlLTJjMTNkMzI0OTk1NCJdLCJpYXQiOjE2NjQ4MzkwNDEsImV4cCI6MTY2NDg0MjY0MSwiYXVkIjoibW9qYWxvb3Audm5leHQuZGVmYXVsdF9hdWRpZW5jZSIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzIwMS8iLCJzdWIiOiJ1c2VyOjphZG1pbiIsImp0aSI6IjM2ZTdmYTk3LTFmODMtNGJlMC1iZWRjLWQwNzM0MTBmY2QxYyJ9.fD55nG4vUtjOkRS8QeL_PMYeXBowMDF3UGa4A8lR1pOfJu4_-VXhs0ljH7QK_hyxchBsQpvd_GK_MmpIB26NInDhy51qY5cYwT-evePQ8-6sv4gSBmfPeSKGvbNV-w94Shnlb_iaEg5KCloIhx3JpKBIPGLeaifnLgpKa3Sla_q9XF5roF83-2jjvMTxrx1ZAucmWvAvZSEDEuHcxBPIjpOG5Rdx9oyc3n7unUzbdSFt1IyZr7nROfnQ9dai6laJwNqsOvl3Gx5SpDIF6hhrWS33d_PituV6mypbcomERIb3D_59TgP-Mpy8yvXYUmU_s55xa3-zMj0wpBl4-xem0Q";

describe("participant - integration tests", () => {
    console.log(`Integration tests for endpoint: ${BASE_URL_PARTICIPANTS_HTTP_SERVICE}`)
    beforeAll(async () => {
        logger = new ConsoleLogger()
        participantsHttpClient = new ParticipantsHttpClient(
                logger,
                BASE_URL_PARTICIPANTS_HTTP_SERVICE,
                USER1_TOKEN,
                TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT
        );
    });

    afterAll(async () => {
        // await logger.destroy();
    });

    // Create participant:
    test("create non-existent participant", async () => {
        participantsHttpClient.setAccessToken(USER1_TOKEN);

        const participantId: string = Crypto.randomUUID();
        const participant: Participant = {
            id: participantId,
            name: `Peter Pan - ${participantId}`,
            isActive: false,
            description: "",
            createdDate: 0,
            createdBy: "",
            lastUpdated: 0,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            participantAllowedSourceIps: [],
            participantEndpoints: [],
            participantAccounts: [],
            changeLog: [],
            type: "HUB",
            fundsMovements: []
        };
        const participantReceived: Participant|null = await participantsHttpClient.createParticipant(participant);
        expect(participantReceived?.id).toEqual(participantId);
    });

    // Get participant by id (non-existing):
    test("get non-existent participant by id", async () => {
        participantsHttpClient.setAccessToken(USER1_TOKEN);

        const id: string = Crypto.randomUUID();
        const participant: Participant | null = await participantsHttpClient.getParticipantById(id);
        expect(participant).toBeNull();
    });

    // Get participant by id:
    test("get existing participant by id", async () => {
        participantsHttpClient.setAccessToken(USER1_TOKEN);

        const participantId: string = Crypto.randomUUID();
        const participant: Participant = {
            id: participantId,
            name: `Alice in Wonderland - ${participantId}`,
            isActive: true,
            description: "",
            createdDate: 0,
            createdBy: "",
            lastUpdated: 0,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            participantAllowedSourceIps: [],
            participantEndpoints: [],
            participantAccounts: [],
            changeLog: [],
            type: "HUB",
            fundsMovements: []
        };
        const participantCreated: Participant|null = await participantsHttpClient.createParticipant(participant);
        expect(participantCreated).toBeDefined();
        expect(participantCreated?.id).toEqual(participantId);

        const partById = await participantsHttpClient.getParticipantById(participantId);
        expect(partById).toBeDefined()
        if (partById) {
            expect(partById.id).toEqual(participantId);
            expect(partById.name).toEqual(participant.name);
            expect(partById.isActive).toEqual(false);
        }

        const partsById = await participantsHttpClient.getParticipantsByIds([participantId]);
        expect(partsById).toBeDefined()
        if (partsById) {
            expect(partsById.length).toEqual(1)
            expect(partsById[0].id).toEqual(participantId);
            expect(partsById[0].name).toEqual(participant.name);
            expect(partsById[0].isActive).toEqual(false);
        }
    });

});
