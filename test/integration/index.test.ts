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

import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {
  ParticipantsHttpClient,
  UnableToCreateParticipantAccountError,
} from "@mojaloop/participants-bc-client-lib";
import { IParticipant as Participant } from "@mojaloop/participant-bc-public-types-lib";
import { KafkaLogger } from "@mojaloop/logging-bc-client-lib";
import { MLKafkaRawProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AuthenticatedHttpRequester } from "@mojaloop/security-bc-client-lib";
import * as Crypto from "crypto";
import { ConsoleLogger } from "@mojaloop/logging-bc-public-types-lib/dist/console_logger";

/* ********** Constants Begin ********** */

// General:
const BOUNDED_CONTEXT_NAME: string = "participants-bc";
const SERVICE_NAME: string = "integration-tests";
const SERVICE_VERSION: string = "0.0.1";

// Message broker:
const MESSAGE_BROKER_HOST: string =
  process.env.PARTICIPANTS_MESSAGE_BROKER_HOST ?? "localhost";
const MESSAGE_BROKER_PORT_NO: number =
  parseInt(process.env.PARTICIPANTS_MESSAGE_BROKER_PORT_NO ?? "") || 9092;
const MESSAGE_BROKER_URL: string = `${MESSAGE_BROKER_HOST}:${MESSAGE_BROKER_PORT_NO}`;

// Logging:
const LOGGING_LEVEL: LogLevel = LogLevel.INFO;
const LOGGING_TOPIC: string = `${BOUNDED_CONTEXT_NAME}_${SERVICE_NAME}_logging`;

// Web server:
const WEB_SERVER_HOST: string =
  process.env.PARTICIPANTS_WEB_SERVER_HOST ?? "localhost";
const WEB_SERVER_PORT_NO: number =
  parseInt(process.env.PARTICIPANTS_WEB_SERVER_PORT_NO ?? "") || 3010;

// Participants HTTP client:
const BASE_URL_PARTICIPANTS_HTTP_SERVICE: string = `http://${WEB_SERVER_HOST}:${WEB_SERVER_PORT_NO}`;
const TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT: number = 10_000;

/* ********** Constants End ********** */

let logger: ILogger;
let participantsHttpClient: ParticipantsHttpClient;
let authenticatedHttpRequester: AuthenticatedHttpRequester;

const AUTH_N_SVC_BASEURL =
  process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token";

describe("participant - integration tests", () => {
  console.log(
    `Integration tests for endpoint: ${BASE_URL_PARTICIPANTS_HTTP_SERVICE}`
  );
  beforeAll(async () => {
    logger = new ConsoleLogger();

    authenticatedHttpRequester = new AuthenticatedHttpRequester(
      logger,
      AUTH_N_SVC_TOKEN_URL
    );
    authenticatedHttpRequester.setUserCredentials(
      "security-bc-ui",
      "user",
      "superPass"
    );

    participantsHttpClient = new ParticipantsHttpClient(
      logger,
      BASE_URL_PARTICIPANTS_HTTP_SERVICE,
      authenticatedHttpRequester,
      TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT
    );
  });

  afterAll(async () => {
    // await logger.destroy();
  });

  // Create participant:
  test("create non-existent participant", async () => {
    // participantsHttpClient.setAccessToken(USER1_TOKEN);

    const participantId: string = Crypto.randomUUID().replace(/-/g, ""); // to match with the server side
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
      type: "DFSP",
      fundsMovements: [],
      changeLog: [],
    };
    const participantReceived = await participantsHttpClient.createParticipant(
      participant
    );
    expect(participantReceived?.id).toEqual(participantId);
  });

  // Get participant by id (non-existing):
  test("get non-existent participant by id", async () => {
    // participantsHttpClient.setAccessToken(USER1_TOKEN);

    const id: string = Crypto.randomUUID().replace(/-/g, ""); // to match with the server side
    const participant: Participant | null =
      await participantsHttpClient.getParticipantById(id);
    expect(participant).toBeNull();
  });

  // Get participant by id:
  test("get existing participant by id", async () => {
    // participantsHttpClient.setAccessToken(USER1_TOKEN);

    const participantId: string = Crypto.randomUUID().replace(/-/g, ""); // to match with the server side
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
      type: "DFSP",
      fundsMovements: [],
    };
    const participantCreated = await participantsHttpClient.createParticipant(
      participant
    );
    expect(participantCreated?.id).toBeDefined();
    expect(participantCreated?.id).toEqual(participantId);

    const partById = await participantsHttpClient.getParticipantById(
      participantId
    );
    expect(partById).toBeDefined();
    if (partById) {
      expect(partById.id).toEqual(participantId);
      expect(partById.name).toEqual(participant.name);
      expect(partById.isActive).toEqual(false);
    }

    const partsById = await participantsHttpClient.getParticipantsByIds([
      participantId,
    ]);
    expect(partsById).toBeDefined();
    if (partsById) {
      expect(partsById.length).toEqual(1);
      expect(partsById[0].id).toEqual(participantId);
      expect(partsById[0].name).toEqual(participant.name);
      expect(partsById[0].isActive).toEqual(false);
    }
  });

  test("GET - should get a list of filtered participants", async () => {
    const participantId: string = Crypto.randomUUID().replace(/-/g, ""); // to match with the server side
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
      type: "DFSP",
      fundsMovements: [],
    };
    const participantCreated = await participantsHttpClient.createParticipant(
      participant
    );

    // check the created participant
    expect(participantCreated?.id).toBeDefined();
    expect(participantCreated?.id).toEqual(participantId);

    // filter participants
    const filteredParticipants =
      await participantsHttpClient.searchParticipants(
        participant.id,
        participant.name,
        participant.approved ? "APPROVED" : "NOTAPPROVED"
      );

    // check it's empty or not
    expect(filteredParticipants).not.toHaveLength(0);

    // check the filtered response
    expect(filteredParticipants[0].id).toEqual(participant.id);
    expect(filteredParticipants[0].name).toEqual(participant.name);
    expect(filteredParticipants[0].approved).toEqual(participant.approved);
  });
});
