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
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
	Participant,
	ParticipantAccount,
	ParticipantApproval,
	ParticipantEndpoint
} from "@mojaloop/participant-bc-public-types-lib";
import axios, {AxiosInstance, AxiosResponse, AxiosError} from "axios";
import {
	UnableToApproveParticipantError,
	UnableToCreateParticipantAccountError,
	UnableToCreateParticipantEndpointError,
	UnableToCreateParticipantError, UnableToDeleteParticipantAccountError,
	UnableToDeleteParticipantEndpointError,
	UnableToDisableParticipantError,
	UnableToEnableParticipantError,
	UnableToGetParticipantAccountError,
	UnableToGetParticipantEndpointsError,
	UnableToGetParticipantError,
	UnableToGetParticipantsError
} from "./errors";

export class ParticipantsHttpClient {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	// Other properties.
	private readonly httpClient: AxiosInstance;
	private readonly UNABLE_TO_REACH_SERVER_ERROR_MESSAGE: string = "unable to reach server";

	constructor(
		logger: ILogger,
		baseUrlHttpService: string,
		accessToken: string,
		timeoutMs: number
	) {
		this.logger = logger;

		this.httpClient = axios.create({
			baseURL: baseUrlHttpService,
			headers: {"Authorization": `Bearer ${accessToken}`},
			timeout: timeoutMs
		});
	}
	
	setAccessToken(accessToken: string): void {
		this.httpClient.defaults.headers.common = {"Authorization": `Bearer ${accessToken}`}; // TODO: verify.
	}

	async getAllParticipants(): Promise<Participant[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				'/participants',
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToGetParticipantsError((axiosError.response.data as any).message);
				}
				throw new UnableToGetParticipantsError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToGetParticipantsError((e as any)?.message);
		}
	}

	async getParticipantsByIds(ids : string[]): Promise<Participant[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${ids.toString()}/multi`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToGetParticipantsError((axiosError.response.data as any).message);
				}
				throw new UnableToGetParticipantsError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToGetParticipantsError((e as any)?.message);
		}
	}

	async getParticipantById(participantId: string): Promise<Participant | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${participantId}`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToGetParticipantError((axiosError.response.data as any).message);
				}
				throw new UnableToGetParticipantError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToGetParticipantError((e as any)?.message);
		}
	}

	async createParticipant(participant: Participant): Promise<Participant> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post("/participants", participant);
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToCreateParticipantError((axiosError.response.data as any).message);
				}
				throw new UnableToCreateParticipantError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToCreateParticipantError((e as any)?.message);
		}
	}

	async approveParticipant(partApproval: ParticipantApproval): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.put(
				`/participants/${partApproval.participantId}/approve`, partApproval);
			if (axiosResponse.status !== 200) throw new UnableToApproveParticipantError(
				`Participant ${partApproval.participantId} not approved [${axiosResponse.status}].`
			);
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToApproveParticipantError((axiosError.response.data as any).message);
				}
				throw new UnableToApproveParticipantError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToApproveParticipantError((e as any)?.message);
		}
	}

	async disableParticipant(participantId: string): Promise<void> {
		try {
			const partApproval : ParticipantApproval = {
				participantId,
				lastUpdated: 0,
				maker: "",
				makerLastUpdated: 0,
				checker: "",
				checkerLastUpdated: 0,
				checkerApproved: false,
				feedback: ""
			}
			const axiosResponse: AxiosResponse = await this.httpClient.put(
				`/participants/${partApproval.participantId}/disable`, partApproval);
			if (axiosResponse.status !== 200) throw new UnableToDisableParticipantError(
				`Participant ${partApproval.participantId} not disabled [${axiosResponse.status}].`
			);
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToDisableParticipantError((axiosError.response.data as any).message);
				}
				throw new UnableToDisableParticipantError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToDisableParticipantError((e as any)?.message);
		}
	}

	async enableParticipant(participantId: string): Promise<void> {
		try {
			const partApproval : ParticipantApproval = {
				participantId,
				lastUpdated: 0,
				maker: "",
				makerLastUpdated: 0,
				checker: "",
				checkerLastUpdated: 0,
				checkerApproved: false,
				feedback: ""
			}
			const axiosResponse: AxiosResponse = await this.httpClient.put(
				`/participants/${partApproval.participantId}/enable`, partApproval);
			if (axiosResponse.status !== 200) throw new UnableToEnableParticipantError(
				`Participant ${partApproval.participantId} not enabled [${axiosResponse.status}].`
			);
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToEnableParticipantError((axiosError.response.data as any).message);
				}
				throw new UnableToEnableParticipantError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToEnableParticipantError((e as any)?.message);
		}
	}

	async getParticipantEndpointsById(participantId: string): Promise<ParticipantEndpoint[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${participantId}/endpoints`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToGetParticipantEndpointsError((axiosError.response.data as any).message);
				}
				throw new UnableToGetParticipantEndpointsError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToGetParticipantEndpointsError((e as any)?.message);
		}
	}

	async createParticipantEndpoint(
		participant: Participant,
		partEndpoint: ParticipantEndpoint
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post(
				`/participants/${participant.id}/endpoint`, partEndpoint);
			if (axiosResponse.status !== 200) throw new UnableToCreateParticipantEndpointError(
				`Create Participant Endpoint for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToCreateParticipantEndpointError((axiosError.response.data as any).message);
				}
				throw new UnableToCreateParticipantEndpointError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToCreateParticipantEndpointError((e as any)?.message);
		}
	}

	async deleteParticipantEndpoint(
		participant: Participant,
		partEndpoint: ParticipantEndpoint
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.delete(
				`/participants/${participant.id}/endpoint`,
				{ data : { source: partEndpoint } });
			if (axiosResponse.status !== 200) throw new UnableToDeleteParticipantEndpointError(
				`Delete Participant Endpoint for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToDeleteParticipantEndpointError((axiosError.response.data as any).message);
				}
				throw new UnableToDeleteParticipantEndpointError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToDeleteParticipantEndpointError((e as any)?.message);
		}
	}

	async getParticipantAccountsById(participantId: string): Promise<ParticipantAccount[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${participantId}/accounts`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToGetParticipantAccountError((axiosError.response.data as any).message);
				}
				throw new UnableToGetParticipantAccountError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToGetParticipantAccountError((e as any)?.message);
		}
	}

	async createParticipantAccount(
		participant: Participant,
		partAccount: ParticipantAccount
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post(
				`/participants/${participant.id}/account`, partAccount);
			if (axiosResponse.status !== 200) throw new UnableToCreateParticipantAccountError(
				`Create Participant Account for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToCreateParticipantAccountError((axiosError.response.data as any).message);
				}
				throw new UnableToCreateParticipantAccountError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToCreateParticipantAccountError((e as any)?.message);
		}
	}

	async deleteParticipantAccount(
		participant: Participant,
		partAccount: ParticipantAccount
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.delete(
				`/participants/${participant.id}/account`,
				{ data : { source: partAccount } });
			if (axiosResponse.status !== 200) throw new UnableToDeleteParticipantAccountError(
				`Delete Participant Account for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			if (axios.isAxiosError(e)) {
				const axiosError: AxiosError = e as AxiosError;
				if (axiosError.response !== undefined) {
					throw new UnableToDeleteParticipantAccountError((axiosError.response.data as any).message);
				}
				throw new UnableToDeleteParticipantAccountError(this.UNABLE_TO_REACH_SERVER_ERROR_MESSAGE);
			}
			throw new UnableToDeleteParticipantAccountError((e as any)?.message);
		}
	}
}
