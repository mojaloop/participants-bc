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
} from "../../packages/client-lib/src";
import { IParticipant as Participant } from "../../packages/public-types-lib/src";
import { AuthenticatedHttpRequester } from "@mojaloop/security-bc-client-lib";
import { ConsoleLogger } from "@mojaloop/logging-bc-public-types-lib";

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
const CACHE_TIMEOUT_MS: number = 10_000;

/* ********** Constants End ********** */

let logger: ILogger;
let participantsHttpClient: ParticipantsHttpClient;
let authenticatedHttpRequester: AuthenticatedHttpRequester;

const AUTH_N_SVC_BASEURL =
  process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token";

const CLIENT_ID = "security-bc-ui";
const USERNAME = "user";
const PASSWORD = "superPass";

let participants: Participant[];

describe("participant - integration tests", () => {

  beforeAll(async () => {
    console.log(`Integration tests for endpoint: ${BASE_URL_PARTICIPANTS_HTTP_SERVICE}`);
    logger = new ConsoleLogger();

    authenticatedHttpRequester = new AuthenticatedHttpRequester(
      logger,
      AUTH_N_SVC_TOKEN_URL
    );
    authenticatedHttpRequester.setUserCredentials(
        CLIENT_ID,
        USERNAME,
        PASSWORD
    );

    participantsHttpClient = new ParticipantsHttpClient(
      logger,
      BASE_URL_PARTICIPANTS_HTTP_SERVICE,
      authenticatedHttpRequester,
      CACHE_TIMEOUT_MS
    );
  });

  afterAll(async () => {
    // await logger.destroy();
  });

/*  // Create participant:
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
      netDebitCaps: [],
      netDebitCapChangeRequests: []
    };
    const participantReceived = await participantsHttpClient.createParticipant(
      participant
    );
    expect(participantReceived?.id).toEqual(participantId);
  });*/

  // Get participant by id (non-existing):
  test("get non-existent participant by id", async () => {
    const participant: Participant | null =
      await participantsHttpClient.getParticipantById("non-existing__participantID");
    expect(participant).toBeNull();
  });

    // Get participant by id (non-existing):
    test("get all participants", async () => {
        participants =await participantsHttpClient.getAllParticipants();
        expect(participants).toBeDefined();
        expect(participants.length).toBeGreaterThanOrEqual(1);
    });

  // Get participant by id:
  test("get existing participant by id", async () => {
    // participantsHttpClient.setAccessToken(USER1_TOKEN);
    const spy = jest.spyOn(authenticatedHttpRequester, "fetch");

    const partById = await participantsHttpClient.getParticipantById(
        participants[0].id
    );

    // this is supposed to be cached at this moment - should be after get all participants
    expect(spy).not.toBeCalled();

    expect(partById).toBeDefined();
    if (partById) {
      expect(partById.id).toEqual(participants[0].id);
      expect(partById.name).toEqual(participants[0].name);
      expect(partById.isActive).toEqual(participants[0].isActive);
    }
  });

    // Get participant by id:
  test("get existing participant by ids (array)", async () => {
    const partsById = await participantsHttpClient.getParticipantsByIds([
        participants[0].id, participants[1].id
    ]);

    expect(partsById).toBeDefined();
    if (partsById) {
      expect(partsById.length).toEqual(2);
      expect(partsById[0].id).toEqual(participants[0].id);
      expect(partsById[0].name).toEqual(participants[0].name);
      expect(partsById[0].isActive).toEqual(participants[0].isActive);
    }
  });

/*
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
      netDebitCaps: [],
      netDebitCapChangeRequests: []
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
    const found = filteredParticipants.find(item => item.id === participant.id);
    if(!found) fail("Could not find created participant");

    expect(found).toBeDefined();

    // check the filtered response
    expect(found.id).toEqual(participant.id);
    expect(found.name).toEqual(participant.name);
    expect(found.approved).toEqual(participant.approved);
  });
  */
});
