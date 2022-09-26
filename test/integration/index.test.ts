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
import {ParticipantsHttpClient, UnableToCreateParticipantAccountError} from "@mojaloop/participants-bc-client";
import {
	Participant,
	ParticipantAccount,
	ParticipantApproval,
	ParticipantEndpoint
} from "@mojaloop/participant-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {MLKafkaProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
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
const VALID_ACCESS_TOKEN: string = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNSMHVoT2hpM05VbmJlMTF5SDZtOUZtcFpNN2JiRVl2czdpbGNfanN1MHMifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzZWN1cml0eS1iYy11aSIsInJvbGVzIjpbXSwiaWF0IjoxNjYxMzM4MDUxLCJleHAiOjE2NjEzNDE2NTEsImF1ZCI6Im1vamFsb29wLnZuZXh0LmRlZmF1bHRfYXVkaWVuY2UiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjMyMDEvIiwic3ViIjoidXNlcjo6dXNlciIsImp0aSI6IjA0NWQwOTc0LWZkMDUtNGZhYS1iNzRkLTIzZGEwNjhhMjNlMSJ9.hYXBLADnY8DeSzyXMKvQyByAy8pjeV_x35f4eedpTR68w2Igessqmb4JNYCftU0K8bvrhIeZKxzUPdWUHDxFYJLJPlK_fvlbk7_3Utou5sPa9ubH-SH87ITNevbeJXA6PnvlgE0eqDFaCs4YQ2EELW3b1uuFoEif2zFIsq32PFcjcMSEj5shNMDTpctyhwP4-1i7SRaxbclOXXRpYw0nIp-QenJ7IJOnCAOAolH4yxoHdf7y7BkXNlbn4XYQv6GOmEABIgqu3ftUI1Gg25YRyVgy-HROT3LlYbnly8mZ6kE595WngrMEp_RXYN9hQnqoWKzd0FXzKlsSVgIqBzpdbQ";

describe("participant - integration tests", () => {
	console.log(`Integration tests for endpoint: ${BASE_URL_PARTICIPANTS_HTTP_SERVICE}`)
	beforeAll(async () => {
		logger = new ConsoleLogger()
		participantsHttpClient = new ParticipantsHttpClient(
			logger,
			BASE_URL_PARTICIPANTS_HTTP_SERVICE,
			VALID_ACCESS_TOKEN,
			TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT
		);
	});

	afterAll(async () => {
		// await logger.destroy();
	});

	// Create participant:
	test("create non-existent participant", async () => {
		const participantId: string = Crypto.randomUUID();
		const participant: Participant = {
			id: participantId,
			name: "Peter Pan",
			isActive: false,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantReceived: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantReceived.id).toEqual(participantId);
	});

	// Get participant by id (non-existing):
	test("get non-existent participant by id", async () => {
		const id: string = Crypto.randomUUID();
		const participant: Participant | null = await participantsHttpClient.getParticipantById(id);
		expect(participant).toBeNull();
	});

	// Get participant by id:
	test("get existing participant by id", async () => {
		const participantId: string = Crypto.randomUUID();
		const participant: Participant = {
			id: participantId,
			name: "Alice in Wonderland",
			isActive: true,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantCreated: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantCreated.id).toEqual(participantId);

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

	// Test participant approval:
	test("approve participant by id", async () => {
		const participantId: string = Crypto.randomUUID();
		const participant: Participant = {
			id: participantId,
			name: "Snow White",
			isActive: true,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantCreated: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantCreated.id).toEqual(participantId);

		const approval : ParticipantApproval = {
			participantId: participantId,
			lastUpdated: 0,
			maker: "",
			makerLastUpdated: 0,
			checker: "Johnny",
			checkerLastUpdated: 0,
			checkerApproved: true,
			feedback: ""
		}

		await participantsHttpClient.approveParticipant(approval);
		const partById = await participantsHttpClient.getParticipantById(participantId);

		expect(partById).toBeDefined()
		if (partById) {
			expect(partById.id).toEqual(participantId);
			expect(partById.name).toEqual(participant.name);
			expect(partById.isActive).toEqual(true);
		}
	});

	// Test participant disable/enable:
	test("disable and enable participant by id", async () => {
		const participantId: string = Crypto.randomUUID();
		const participant: Participant = {
			id: participantId,
			name: "Mickey Mouse",
			isActive: true,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantCreated: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantCreated.id).toEqual(participantId);

		const approval : ParticipantApproval = {
			participantId: participantId,
			lastUpdated: 0,
			maker: "",
			makerLastUpdated: 0,
			checker: "Johnny Vans",
			checkerLastUpdated: 0,
			checkerApproved: true,
			feedback: "You have been approved."
		}

		await participantsHttpClient.approveParticipant(approval);
		const partById = await participantsHttpClient.getParticipantById(participantId);

		expect(partById).toBeDefined()
		if (partById) {
			expect(partById.id).toEqual(participantId);
			expect(partById.name).toEqual(participant.name);
			expect(partById.isActive).toEqual(true);
		}

		await participantsHttpClient.disableParticipant(participantId);
		const partDisabledById = await participantsHttpClient.getParticipantById(participantId);
		expect(partDisabledById).toBeDefined()
		if (partDisabledById) {
			expect(partDisabledById.id).toEqual(participantId);
			expect(partDisabledById.name).toEqual(participant.name);
			expect(partDisabledById.isActive).toEqual(false);
		}

		await participantsHttpClient.enableParticipant(participantId);
		const partEnabledById = await participantsHttpClient.getParticipantById(participantId);
		expect(partEnabledById).toBeDefined()
		if (partEnabledById) {
			expect(partEnabledById.id).toEqual(participantId);
			expect(partEnabledById.name).toEqual(participant.name);
			expect(partEnabledById.isActive).toEqual(true);
		}
	});

	// Create participant endpoint by id:
	test("create/delete/get participant endpoint for participant", async () => {
		const participantId: string = Crypto.randomUUID();
		const participant: Participant = {
			id: participantId,
			name: "Aladdin",
			isActive: true,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantCreated: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantCreated.id).toEqual(participantId);

		const partEnd : ParticipantEndpoint = {
			type: "main",
			value: "http://txn"
		}

		await participantsHttpClient.createParticipantEndpoint(participant, partEnd);

		const partEndById = await participantsHttpClient.getParticipantEndpointsById(participantId);
		expect(partEndById).toBeDefined();
		if (partEndById) {
			expect(partEndById.length).toEqual(1);
			expect(partEndById[0].type).toEqual(partEnd.type);
			expect(partEndById[0].value).toEqual(partEnd.value);
		}

		await participantsHttpClient.deleteParticipantEndpoint(participant, partEnd);
		const endpointsPostDel = await participantsHttpClient.getParticipantEndpointsById(participantId);
		expect(endpointsPostDel).toBeNull();
	});

	// Create participant account by id:
	test("create/delete/get participant account for participant", async () => {
		const participantId: string = Crypto.randomUUID();
		const participant: Participant = {
			id: participantId,
			name: "Robin Hood",
			isActive: true,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantCreated: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantCreated.id).toEqual(participantId);

		const accId: string = Crypto.randomUUID();
		const partAcc : ParticipantAccount = {
			id: accId,
			type: 1,
			currency: 710
		}

		try {
			await participantsHttpClient.createParticipantAccount(participant, partAcc);
		} catch (err: any) {
			expect(err.message).toEqual(`'${participantId}' is not active.`);
		}

		await participantsHttpClient.approveParticipant({
			participantId: participantId,
			lastUpdated: 0,
			maker: "",
			makerLastUpdated: 0,
			checker: "Johnny Vans",
			checkerLastUpdated: 0,
			checkerApproved: true,
			feedback: "Great work."
		});
		await participantsHttpClient.createParticipantAccount(participant, partAcc);

		const partAccsById = await participantsHttpClient.getParticipantAccountsById(participantId);
		expect(partAccsById).toBeDefined();
		if (partAccsById) {
			expect(partAccsById.length).toEqual(1);
			expect(partAccsById[0].id).toEqual(partAcc.id);
			expect(partAccsById[0].type).toEqual(partAcc.type);
			expect(partAccsById[0].currency).toEqual(partAcc.currency);
		}

		await participantsHttpClient.deleteParticipantAccount(participant, partAcc);
		const accountsPostDel = await participantsHttpClient.getParticipantAccountsById(participantId);
		expect(accountsPostDel).toBeNull();
	});
});
